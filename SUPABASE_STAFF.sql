create table if not exists public.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'worker',
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table public.staff enable row level security;

drop policy if exists staff_admin_all on public.staff;

create policy staff_admin_all on public.staff
for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and lower(coalesce(p.role,''))='admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and lower(coalesce(p.role,''))='admin'));
