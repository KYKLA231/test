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

alter table public.profiles enable row level security;

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

