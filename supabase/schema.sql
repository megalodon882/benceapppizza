create extension if not exists "pgcrypto";

create type public.user_role as enum ('courier', 'manager');
create type public.order_color as enum ('black', 'white');
create type public.order_status as enum ('new', 'active', 'completed', 'cancelled');
create type public.settlement_status as enum ('open', 'paid');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  email text not null unique,
  role public.user_role not null default 'courier',
  requested_role public.user_role not null default 'courier',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  address text not null,
  phone text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint addresses_address_not_empty check (length(trim(address)) > 0)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  address_id uuid references public.addresses(id) on delete set null,
  courier_id uuid not null references public.profiles(id) on delete restrict,
  address_snapshot text not null,
  phone_snapshot text,
  color public.order_color not null default 'black',
  details text,
  price numeric(12, 2) not null check (price >= 0),
  status public.order_status not null default 'new',
  checked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_address_not_empty check (length(trim(address_snapshot)) > 0)
);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  courier_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(12, 2) not null check (amount >= 0),
  period_start date not null,
  period_end date not null,
  status public.settlement_status not null default 'open',
  created_at timestamptz not null default now(),
  constraint settlements_valid_period check (period_end >= period_start)
);

create index addresses_owner_id_idx on public.addresses(owner_id);
create index orders_courier_id_idx on public.orders(courier_id);
create index orders_created_at_idx on public.orders(created_at desc);
create index orders_status_idx on public.orders(status);
create index orders_checked_idx on public.orders(checked);
create index settlements_courier_id_idx on public.settlements(courier_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger addresses_set_updated_at
before update on public.addresses
for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

alter publication supabase_realtime add table public.orders;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'manager'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  requested_username text;
begin
  requested_role := new.raw_user_meta_data ->> 'role';
  requested_username := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, username, email, role, requested_role)
  values (
    new.id,
    requested_username,
    new.email,
    case when requested_role = 'manager' then 'manager'::public.user_role else 'courier'::public.user_role end,
    case when requested_role = 'manager' then 'manager'::public.user_role else 'courier'::public.user_role end
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.settlements enable row level security;

create policy "profiles can view own profile"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_manager());

create policy "users can update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid() or public.is_manager())
with check (id = auth.uid() and role = (select role from public.profiles current_profile where current_profile.id = auth.uid()));

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

create policy "users can create own addresses"
on public.addresses for insert
to authenticated
with check (owner_id = auth.uid());

create policy "users can update own addresses"
on public.addresses for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "users can delete own addresses"
on public.addresses for delete
to authenticated
using (owner_id = auth.uid());

create policy "users can view permitted orders"
on public.orders for select
to authenticated
using (courier_id = auth.uid() or (public.is_manager() and checked = true));

create policy "couriers can create own orders"
on public.orders for insert
to authenticated
with check (courier_id = auth.uid());

create policy "couriers can update assigned orders"
on public.orders for update
to authenticated
using (courier_id = auth.uid())
with check (courier_id = auth.uid());

create policy "couriers can delete assigned orders"
on public.orders for delete
to authenticated
using (courier_id = auth.uid());

create policy "couriers can view own settlements"
on public.settlements for select
to authenticated
using (courier_id = auth.uid() or public.is_manager());

create policy "managers can create settlements"
on public.settlements for insert
to authenticated
with check (public.is_manager());

create policy "managers can update settlements"
on public.settlements for update
to authenticated
using (public.is_manager())
with check (public.is_manager());

