-- WiV1 V0.6: stage this migration before deploying the V0.6 API.
-- No existing production schema is changed by committing this file.
-- Functions run as INVOKER; service_role is the only caller granted EXECUTE.

create or replace function public.wiv1_create_card_atomic(
  p_business_name text, p_location_name text, p_address text,
  p_card_code text, p_slug text, p_ssid text,
  p_encrypted_password text, p_security_type text, p_instructions text
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare v_business_id uuid; v_location_id uuid; v_card_id uuid;
begin
  if p_security_type not in ('WPA2','WPA3','Open') or
     length(coalesce(p_encrypted_password,'')) = 0 then
    raise exception 'Invalid network configuration';
  end if;
  insert into public.businesses(name) values(p_business_name) returning id into v_business_id;
  insert into public.locations(business_id,name,address)
    values(v_business_id,p_location_name,nullif(p_address,'')) returning id into v_location_id;
  insert into public.wifi_cards(business_id,location_id,card_code,slug,status)
    values(v_business_id,v_location_id,p_card_code,p_slug,'active') returning id into v_card_id;
  insert into public.wifi_networks(card_id,ssid,encrypted_password,security_type,instructions)
    values(v_card_id,p_ssid,p_encrypted_password,p_security_type,nullif(p_instructions,''));
  return jsonb_build_object('id',v_card_id,'card_code',p_card_code,'slug',p_slug,'status','active');
end;
$$;

revoke all on function public.wiv1_create_card_atomic(text,text,text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.wiv1_create_card_atomic(text,text,text,text,text,text,text,text,text) to service_role;

create or replace function public.wiv1_record_event_limited(
  p_card_id uuid, p_event_type public.wifi_event_type, p_source text,
  p_ip_hash text, p_user_agent text
) returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare v_count integer; v_card_count integer;
begin
  -- Serialize requests for one card/IP to prevent concurrent rate-limit bypass.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_card_id::text, 0));
  if not exists (select 1 from public.wifi_cards where id = p_card_id and status = 'active') then
    return false;
  end if;
  select count(*) into v_count from public.wifi_events
   where card_id = p_card_id and ip_hash = p_ip_hash
     and created_at > pg_catalog.now() - interval '1 minute';
  if v_count >= 30 then
    return false;
  end if;
  -- Additional card-wide cap limits spoofed-IP traffic.
  -- Transaction advisory locks serialize card-wide checks across concurrent requests.
  select count(*) into v_card_count from public.wifi_events
   where card_id = p_card_id
     and created_at > pg_catalog.now() - interval '1 minute';
  if v_card_count >= 300 then
    return false;
  end if;
  insert into public.wifi_events(card_id,event_type,source,ip_hash,user_agent)
    values(p_card_id,p_event_type,p_source,p_ip_hash,left(p_user_agent,512));
  return true;
end;
$$;

revoke all on function public.wiv1_record_event_limited(uuid,public.wifi_event_type,text,text,text) from public, anon, authenticated;
grant execute on function public.wiv1_record_event_limited(uuid,public.wifi_event_type,text,text,text) to service_role;

create index if not exists idx_wifi_events_card_ip_created
on public.wifi_events(card_id,ip_hash,created_at desc);
