-- WiV1 only: provider / client tenancy. Applied to isolated WiV1 staging first.
-- Existing admin_users (role=admin) remain providers. An Auth user becomes a client
-- only after an explicit assignment to a business.
create table if not exists public.wiv1_business_owners (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index if not exists wiv1_business_owners_user_idx
  on public.wiv1_business_owners (user_id, business_id);
alter table public.wiv1_business_owners enable row level security;

-- Users cannot self-assign businesses, even via PostgREST RPC.
revoke all on public.wiv1_business_owners from public, anon, authenticated;
grant select, insert, delete on public.wiv1_business_owners to service_role;

create or replace function public.wiv1_assign_business_owner(
  p_business_id uuid, p_email text
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_email text := lower(btrim(p_email));
begin
  if not exists (select 1 from public.businesses where id = p_business_id)
    then raise exception 'Business not found' using errcode='P0002'; end if;
  if v_email = '' or length(v_email) > 320 then
    raise exception 'Invalid email' using errcode='22023'; end if;

  select id into v_user_id
  from auth.users
  where lower(email) = v_email and email_confirmed_at is not null
  limit 1;
  if v_user_id is null then
    return jsonb_build_object('assigned', false, 'reason', 'user_not_found');
  end if;
  if exists (select 1 from public.admin_users where user_id=v_user_id and role='admin') then
    return jsonb_build_object('assigned', false, 'reason', 'provider_account');
  end if;
  insert into public.wiv1_business_owners(business_id,user_id)
    values (p_business_id,v_user_id)
    on conflict do nothing;
  return jsonb_build_object('assigned', true, 'business_id', p_business_id);
end;
$$;
revoke all on function public.wiv1_assign_business_owner(uuid,text) from public,anon,authenticated;
grant execute on function public.wiv1_assign_business_owner(uuid,text) to service_role;
comment on table public.wiv1_business_owners is
  'WiV1 client-to-business mapping. Provider provisioning is server-authorized. Clients cannot self-assign.';
