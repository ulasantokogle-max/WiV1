-- WiV1 security hardening: only one initial owner assignment by Provider.
-- Once claimed, ownership cannot be silently changed/expanded by Provider.
-- A future owner-approved transfer workflow must be designed separately.
create or replace function public.wiv1_assign_business_owner(
  p_business_id uuid, p_email text
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_email text := lower(btrim(p_email));
  v_existing_owner uuid;
begin
  -- Lock the business row to serialize concurrent Provider assignments.
  perform 1 from public.businesses where id=p_business_id for update;
  if not found then raise exception 'Business not found' using errcode='P0002'; end if;
  if v_email = '' or length(v_email) > 320 then
    raise exception 'Invalid email' using errcode='22023'; end if;

  select id into v_user_id from auth.users
    where lower(email)=v_email and email_confirmed_at is not null limit 1;
  if v_user_id is null then
    return jsonb_build_object('assigned', false, 'reason', 'user_not_found');
  end if;
  if exists (select 1 from public.admin_users where user_id=v_user_id and role='admin') then
    return jsonb_build_object('assigned', false, 'reason', 'provider_account');
  end if;

  select user_id into v_existing_owner
    from public.wiv1_business_owners
    where business_id = p_business_id limit 1;
  if v_existing_owner is not null then
    if v_existing_owner = v_user_id then
      return jsonb_build_object('assigned', true, 'business_id',p_business_id);
    end if;
    return jsonb_build_object('assigned', false, 'reason', 'already_owned');
  end if;

  insert into public.wiv1_business_owners(business_id,user_id)
    values (p_business_id,v_user_id);
  return jsonb_build_object('assigned', true, 'business_id',p_business_id);
end;
$$;
revoke all on function public.wiv1_assign_business_owner(uuid,text) from public,anon,authenticated;
grant execute on function public.wiv1_assign_business_owner(uuid,text) to service_role;
