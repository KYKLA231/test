-- Выполнить в SQL Editor, если в Authentication → Users есть люди, а в public.profiles для них нет строк
-- (триггер не сработал или схема без колонки role и т.п.).

alter table public.profiles add column if not exists role text default 'admin';

-- Если full_name в таблице NOT NULL, пустое имя из metadata заменяем на часть email или «Пользователь»
insert into public.profiles (id, email, full_name, company, phone, username, role)
select
  u.id,
  coalesce(nullif(trim(u.email), ''), 'unknown@local'),
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(split_part(trim(coalesce(u.email, '')), '@', 1), ''),
    'Пользователь'
  ),
  nullif(trim(u.raw_user_meta_data->>'company'), ''),
  nullif(trim(u.raw_user_meta_data->>'phone'), ''),
  nullif(trim(u.raw_user_meta_data->>'username'), ''),
  coalesce(
    nullif(trim(lower(u.raw_user_meta_data->>'role')), ''),
    'admin'
  )
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do update set
  email = excluded.email,
  full_name = coalesce(public.profiles.full_name, excluded.full_name),
  company = coalesce(public.profiles.company, excluded.company),
  phone = coalesce(public.profiles.phone, excluded.phone),
  username = coalesce(public.profiles.username, excluded.username),
  role = coalesce(public.profiles.role, excluded.role);

update public.profiles set role = 'admin' where role is null or trim(role) = '';
