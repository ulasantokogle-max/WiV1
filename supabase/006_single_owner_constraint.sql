-- WiV1 staging: enforce the single-owner invariant even for direct service-role writes.
-- Fail closed if a preexisting business has multiple owners; never delete or choose owners.
do $$
begin
  if exists (
    select business_id from public.wiv1_business_owners
    group by business_id having count(*) > 1
  ) then
    raise exception 'WiV1 business has multiple owners: resolve manually before applying';
  end if;
end $$;

create unique index if not exists wiv1_single_owner_per_business
  on public.wiv1_business_owners (business_id);
