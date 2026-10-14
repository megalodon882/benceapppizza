create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  requested_username text;
  active_role public.user_role;
begin
  requested_role := new.raw_user_meta_data ->> 'role';
  requested_username := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    split_part(new.email, '@', 1)
  );
  active_role := case
    when requested_role = 'manager' then 'manager'::public.user_role
    else 'courier'::public.user_role
  end;

  insert into public.profiles (id, username, email, role, requested_role)
  values (new.id, requested_username, new.email, active_role, active_role);

  return new;
end;
$$;

update public.profiles
set role = 'manager'
where requested_role = 'manager' and role <> 'manager';

drop policy if exists "users can view own addresses" on public.addresses;
drop policy if exists "users can create own addresses" on public.addresses;
drop policy if exists "users can update own addresses" on public.addresses;
drop policy if exists "users can delete own addresses" on public.addresses;
drop policy if exists "couriers can view assigned orders" on public.orders;
drop policy if exists "couriers can create own orders" on public.orders;
drop policy if exists "couriers can update assigned orders" on public.orders;
drop policy if exists "couriers can delete assigned orders" on public.orders;

drop policy if exists "users can view permitted addresses" on public.addresses;
drop policy if exists "users can view permitted orders" on public.orders;

create policy "users can view permitted addresses"
on public.addresses for select
to authenticated
using (
  owner_id = auth.uid()
  or (
    public.is_manager()
    and exists (
      select 1 from public.orders
      where orders.address_id = addresses.id and orders.status = 'completed'
    )
  )
);

create policy "couriers can create own addresses"
on public.addresses for insert
to authenticated
with check (owner_id = auth.uid());

create policy "couriers can update own addresses"
on public.addresses for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "couriers can delete own addresses"
on public.addresses for delete
to authenticated
using (owner_id = auth.uid());

create policy "users can view permitted orders"
on public.orders for select
to authenticated
using (courier_id = auth.uid() or (public.is_manager() and status = 'completed'));

create policy "couriers can create own orders"
on public.orders for insert
to authenticated
with check (courier_id = auth.uid());

create policy "couriers can update own orders"
on public.orders for update
to authenticated
using (courier_id = auth.uid())
with check (courier_id = auth.uid());

create policy "couriers can delete own orders"
on public.orders for delete
to authenticated
using (courier_id = auth.uid());
