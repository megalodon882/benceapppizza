alter table public.profiles
add column if not exists email text;

update public.profiles
set email = auth_users.email
from auth.users as auth_users
where public.profiles.id = auth_users.id
  and public.profiles.email is null;

alter table public.profiles
alter column email set not null;

create unique index if not exists profiles_email_unique_idx
on public.profiles(email);

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
