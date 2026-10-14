-- 1. A profiles tábla legyen kompatibilis az Auth email címmel.
alter table public.profiles
add column if not exists email text;

-- 2. A már létező Auth felhasználók profiljainak pótlása.
insert into public.profiles (id, username, email, role, requested_role)
select
  au.id,
  coalesce(
    nullif(trim(au.raw_user_meta_data ->> 'username'), ''),
    split_part(au.email, '@', 1)
  ),
  au.email,
  case when au.raw_user_meta_data ->> 'role' = 'manager'
    then 'manager'::public.user_role
    else 'courier'::public.user_role
  end,
  case when au.raw_user_meta_data ->> 'role' = 'manager'
    then 'manager'::public.user_role
    else 'courier'::public.user_role
  end
from auth.users au
left join public.profiles p on p.id = au.id
where p.id is null
on conflict (id) do nothing;

-- 3. Új regisztrációkhoz működő profil-trigger.
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
  values (new.id, requested_username, new.email, active_role, active_role)
  on conflict (id) do update set
    email = excluded.email,
    username = excluded.username,
    requested_role = excluded.requested_role;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 4. Ellenőrzés: minden Auth-felhasználóhoz tartozik-e profil.
select
  au.id,
  au.email,
  p.username,
  p.role,
  p.requested_role,
  case when p.id is null then 'HIÁNYZÓ PROFIL' else 'OK' end as profile_status
from auth.users au
left join public.profiles p on p.id = au.id
order by au.created_at desc;
