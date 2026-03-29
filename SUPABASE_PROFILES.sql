-- Скрипт для SQL Editor в Supabase (оставьте RLS; профиль создаётся триггером при регистрации).
--
-- Если новые пользователи НЕ появляются в Authentication → Users:
-- триггер handle_new_user() вставляет колонку role. Убедитесь, что в public.profiles есть role
-- (блок ALTER … add column ниже) и что функция/триггер выполнены без ошибки (Database → Postgres Logs).

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  company text,
  phone text,
  username text,
  role text default 'admin',
  created_at timestamptz default now()
);

-- Если таблица profiles уже существовала без части колонок, CREATE TABLE не меняет её — добавляем поля вручную.
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists company text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists role text;

create index if not exists idx_profiles_email on public.profiles (email);

alter table public.profiles enable row level security;

drop policy if exists "insert_own_profile" on public.profiles;
drop policy if exists "update_own_profile" on public.profiles;
drop policy if exists "select_own_profile" on public.profiles;

-- Вставка из браузера разрешена только когда JWT уже есть и совпадает с id строки.
create policy "insert_own_profile" on public.profiles
  for insert
  with check (auth.uid() = id);

create policy "update_own_profile" on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "select_own_profile" on public.profiles
  for select
  using (auth.uid() = id);

-- Надёжное создание профиля при любом новом пользователе Auth (обходит RLS).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  v_role := lower(coalesce(nullif(trim(new.raw_user_meta_data->>'role'), ''), 'admin'));
  if v_role is null or v_role not in ('admin', 'manager', 'worker') then
    v_role := 'admin';
  end if;

  insert into public.profiles (id, email, full_name, company, phone, username, role)
  values (
    new.id,
    coalesce(nullif(trim(new.email), ''), 'unknown@local'),
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(split_part(trim(coalesce(new.email, '')), '@', 1), ''),
      'Пользователь'
    ),
    nullif(trim(new.raw_user_meta_data->>'company'), ''),
    nullif(trim(new.raw_user_meta_data->>'phone'), ''),
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    v_role
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    company = coalesce(excluded.company, public.profiles.company),
    phone = coalesce(excluded.phone, public.profiles.phone),
    username = coalesce(excluded.username, public.profiles.username),
    role = coalesce(excluded.role, public.profiles.role);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Уже существующие строки без роли (выполните после добавления колонки role):
update public.profiles set role = 'admin' where role is null or trim(role) = '';
