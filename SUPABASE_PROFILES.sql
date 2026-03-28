
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key,
  email text not null,
  full_name text,
  company text,
  phone text,
  created_at timestamptz default now()
);

create index if not exists idx_profiles_email on public.profiles (email);

-- Включаем RLS
alter table public.profiles enable row level security;

-- Политика: разрешить вставку только аутентифицированным пользователям и только с id = auth.uid()
create policy "insert_own_profile" on public.profiles
  for insert
  with check (auth.uid() = id);

-- Политика: разрешить обновление своего профиля
create policy "update_own_profile" on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Политика: разрешить чтение своего профиля
create policy "select_own_profile" on public.profiles
  for select
  using (auth.uid() = id);

-- (Опционально) Политика: разрешить администраторам читать все профили
-- Пример, если у вас есть роль в jwt или custom_claim, настройте условие под вашу схему.

-- Примечание:
-- Если вы используете клиентскую вставку (anon key) после signUp(), то auth.uid() будет доступен и политики позволят вставлять профиль.
-- Если вы предпочитаете делать вставку на сервере (Netlify Function) с service_role key, то не включайте строгие RLS-чек-политики или учтите, что service_role обходит RLS.
