-- Isolated ephemeral CI database only.
do $$
declare
 v_business uuid;
 v_client uuid := gen_random_uuid();
 v_provider uuid := gen_random_uuid();
 v_second_client uuid := gen_random_uuid();
 v_result jsonb;
begin
 select id into v_business from public.businesses limit 1;
 if v_business is null then raise exception 'WiV1 QA fixture missing'; end if;
 insert into auth.users(id,email,email_confirmed_at) values
   (v_client,'client-qa@example.test',now()),
   (v_provider,'provider-qa@example.test',now()),
   (v_second_client,'second-client@example.test',now());
 insert into public.admin_users(user_id,role) values (v_provider,'admin');

 v_result := public.wiv1_assign_business_owner(v_business,'client-qa@example.test');
 if (v_result->>'assigned')::boolean is not true then
   raise exception 'Confirmed client was not assigned'; end if;
 if (select count(*) from public.wiv1_business_owners where user_id=v_client and business_id=v_business) <> 1 then
   raise exception 'Owner mapping missing'; end if;

 -- Duplicate assignments idempotent.
 perform public.wiv1_assign_business_owner(v_business,'client-qa@example.test');
 if (select count(*) from public.wiv1_business_owners where user_id=v_client) <> 1 then
   raise exception 'Duplicate owner mapping'; end if;
 v_result := public.wiv1_assign_business_owner(v_business,'second-client@example.test');
 if v_result->>'reason' <> 'already_owned' then raise exception 'Provider silently added another owner'; end if;
 if (select count(*) from public.wiv1_business_owners where business_id=v_business) <> 1 then
   raise exception 'Second owner mapping was created'; end if;
 -- Direct service-role writes cannot bypass the single-owner invariant.
 begin
   insert into public.wiv1_business_owners(business_id,user_id) values (v_business,v_second_client);
   raise exception 'Direct second-owner insert unexpectedly succeeded';
 exception when unique_violation then
   null;
 end;
 v_result := public.wiv1_assign_business_owner(v_business,'not-registered@example.test');
 if v_result->>'reason' <> 'user_not_found' then raise exception 'Unregistered user assigned'; end if;
 v_result := public.wiv1_assign_business_owner(v_business,'provider-qa@example.test');
 if v_result->>'reason' <> 'provider_account' then raise exception 'Provider accepted as owner'; end if;

 if has_function_privilege('anon','public.wiv1_assign_business_owner(uuid,text)','EXECUTE')
   or has_function_privilege('authenticated','public.wiv1_assign_business_owner(uuid,text)','EXECUTE') then
   raise exception 'Client can self-assign ownership via RPC'; end if;
 if has_table_privilege('anon','public.wiv1_business_owners','INSERT')
   or has_table_privilege('authenticated','public.wiv1_business_owners','INSERT') then
   raise exception 'Client can self-assign via direct SQL'; end if;
 if not (select relrowsecurity from pg_class where oid='public.wiv1_business_owners'::regclass) then
   raise exception 'Owner mapping RLS not enabled'; end if;
end $$;
