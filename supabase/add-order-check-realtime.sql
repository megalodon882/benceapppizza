alter table public.orders
add column if not exists checked boolean not null default false;

create index if not exists orders_checked_idx on public.orders(checked);

alter table public.orders replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;

update public.orders
set checked = true
where status = 'completed' and checked = false;

drop policy if exists "users can view permitted orders" on public.orders;

create policy "users can view permitted orders"
on public.orders for select
to authenticated
using (courier_id = auth.uid() or (public.is_manager() and checked = true));

drop policy if exists "users can view permitted addresses" on public.addresses;

create policy "users can view permitted addresses"
on public.addresses for select
to authenticated
using (
  owner_id = auth.uid()
  or (
    public.is_manager()
    and exists (
      select 1 from public.orders
      where orders.address_id = addresses.id and orders.checked = true
    )
  )
);
