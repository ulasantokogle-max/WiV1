-- Runs only in disposable CI PostgreSQL. Never against user projects.
create extension if not exists pgcrypto;
do $$
declare
 v_first jsonb;
 v_card uuid;
 v_before bigint;
 v_after bigint;
 v_accepted boolean;
 v_idx int;
 v_error boolean := false;
begin
 -- One successful atomic creation, including Open WiFi.
 v_first := public.wiv1_create_card_atomic(
   'QA Business','QA Location','','QA-001','qa-001','Guest-WiFi','encrypted-empty','Open','');
 v_card := (v_first->>'id')::uuid;
 if v_first->>'status' <> 'active' then raise exception 'card creation status mismatch'; end if;
 if (select security_type from public.wifi_networks where card_id=v_card) <> 'Open'
    then raise exception 'Open network not created'; end if;
 if (select count(*) from public.businesses) <> 1
    or (select count(*) from public.locations) <> 1
    or (select count(*) from public.wifi_cards) <> 1
    or (select count(*) from public.wifi_networks) <> 1
    then raise exception 'atomic create rows missing'; end if;

 -- Duplicate slug must abort all 4 inserts in the function call.
 select count(*) into v_before from public.businesses;
 begin
   perform public.wiv1_create_card_atomic(
    'Should Roll Back','Test','','QA-002','qa-001','Test','encrypted','WPA2','');
 exception when unique_violation then v_error := true;
 end;
 if not v_error then raise exception 'duplicate slug was incorrectly allowed'; end if;
 select count(*) into v_after from public.businesses;
 if v_after <> v_before then raise exception 'partial business row remained after failure'; end if;

 -- Card / IP throttle: exactly 30 successes in 60 seconds.
 for v_idx in 1..30 loop
   v_accepted := public.wiv1_record_event_limited(v_card,'page_view','qr','ip-A','qa-test');
   if not v_accepted then raise exception 'event blocked early at %',v_idx; end if;
 end loop;
 if public.wiv1_record_event_limited(v_card,'page_view','qr','ip-A','qa-test')
    then raise exception 'per-IP 31st event accepted'; end if;

 -- 270 additional events from 9 independent IP hashes reaches the card limit of 300.
 for v_idx in 1..270 loop
   v_accepted := public.wiv1_record_event_limited(
     v_card,'page_view','qr','ip-' || (1 + ((v_idx-1)/30))::text,'qa-test');
   if not v_accepted then raise exception 'card limit blocked early at %',v_idx; end if;
 end loop;
 if public.wiv1_record_event_limited(v_card,'page_view','qr','ip-new','qa-test')
    then raise exception 'per-card 301st event accepted'; end if;
 if (select count(*) from public.wifi_events where card_id=v_card) <> 300
    then raise exception 'incorrect accepted event count'; end if;

 update public.wifi_cards set status='suspended' where id=v_card;
 if public.wiv1_record_event_limited(v_card,'page_view','qr','ip-new2','qa-test')
    then raise exception 'suspended card event accepted'; end if;
end
$$;

-- Prevent direct execution by public client roles.
do $$
declare
 v_one text := 'public.wiv1_create_card_atomic(text,text,text,text,text,text,text,text,text)';
 v_two text := 'public.wiv1_record_event_limited(uuid,public.wifi_event_type,text,text,text)';
begin
 if has_function_privilege('anon', v_one, 'EXECUTE')
  or has_function_privilege('authenticated', v_one, 'EXECUTE')
  or has_function_privilege('anon', v_two, 'EXECUTE')
  or has_function_privilege('authenticated', v_two, 'EXECUTE')
  then raise exception 'excessive RPC execute privilege'; end if;
 if not has_function_privilege('service_role', v_one, 'EXECUTE')
  or not has_function_privilege('service_role', v_two, 'EXECUTE')
  then raise exception 'service role RPC access missing'; end if;
end
$$;
