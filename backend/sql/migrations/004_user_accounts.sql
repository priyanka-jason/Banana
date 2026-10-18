-- Banana migration 004: User Accounts & Profiles Table
-- Run in Supabase SQL Editor for project wkqxnxjsvrnnpikibrfh

begin;

-- Create user_accounts table linked to Supabase Auth users
create table if not exists public.user_accounts (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text,
  name           text,
  use_location   boolean not null default false,
  location_label text,
  latitude       double precision,
  longitude      double precision,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Enable Row Level Security (RLS)
alter table public.user_accounts enable row level security;

-- Drop existing policies if re-running
drop policy if exists "Users can view their own account" on public.user_accounts;
drop policy if exists "Users can insert their own account" on public.user_accounts;
drop policy if exists "Users can update their own account" on public.user_accounts;
drop policy if exists "Allow public read access for user accounts" on public.user_accounts;

-- Policies for authenticated users to view, insert, and update their own account profile
create policy "Users can view their own account" on public.user_accounts
  for select to authenticated
  using (auth.uid() = id);

create policy "Users can insert their own account" on public.user_accounts
  for insert to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own account" on public.user_accounts
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Grant appropriate permissions
grant select, insert, update, delete on public.user_accounts to authenticated;
grant select, insert, update on public.user_accounts to anon;
grant all on public.user_accounts to service_role;

commit;
