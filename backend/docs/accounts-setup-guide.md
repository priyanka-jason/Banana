# Setup Guide: Supabase Google SSO & User Accounts Setup

This guide provides instructions for configuring Google Single Sign-On (SSO) and running the database migration for user accounts in Supabase (Project ID: `wkqxnxjsvrnnpikibrfh`).

---

## Step 1: Database Migration in Supabase

1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard/project/wkqxnxjsvrnnpikibrfh).
2. Open the **SQL Editor** from the left navigation menu.
3. Click **New query**.
4. Paste the contents of `backend/sql/migrations/004_user_accounts.sql`:

```sql
begin;

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

alter table public.user_accounts enable row level security;

drop policy if exists "Users can view their own account" on public.user_accounts;
drop policy if exists "Users can insert their own account" on public.user_accounts;
drop policy if exists "Users can update their own account" on public.user_accounts;

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

grant select, insert, update, delete on public.user_accounts to authenticated;
grant select, insert, update on public.user_accounts to anon;
grant all on public.user_accounts to service_role;

commit;
```

5. Click **Run** to execute the script and create the `user_accounts` table.

---

## Step 2: Google OAuth SSO Setup in Google Cloud Console

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Select or create a Google Cloud project.
3. Navigate to **APIs & Services** > **OAuth consent screen**:
   - Configure the consent screen (User type: External or Internal).
   - Provide Application Name (e.g. `Banana Grocery`), support email, and developer contact information.
   - Save and continue.
4. Navigate to **APIs & Services** > **Credentials**:
   - Click **Create Credentials** > **OAuth client ID**.
   - Select Application type: **Web application**.
   - Name: `Banana Supabase Auth`.
   - Under **Authorized redirect URIs**, add:
     `https://wkqxnxjsvrnnpikibrfh.supabase.co/auth/v1/callback`
   - Click **Create**.
5. Copy the generated **Client ID** and **Client Secret**.

---

## Step 3: Enable Google Provider in Supabase

1. In your [Supabase Dashboard](https://supabase.com/dashboard/project/wkqxnxjsvrnnpikibrfh), go to **Authentication** > **Providers**.
2. Locate **Google** in the list of providers and toggle it **Enabled**.
3. Paste your **Client ID** and **Client Secret** obtained from Google Cloud.
4. Under **Site URL** and **Redirect URLs** in **Authentication** > **URL Configuration**:
   - Set **Site URL** to `http://localhost:5173` (or your production URL).
   - Add `http://localhost:5173/**` to **Redirect URLs**.
5. Click **Save**.

---

## Step 4: Verification

1. Start the Banana web application (`cd frontend && npm run dev`).
2. Click **Sign in** in the top-right header.
3. Click **Continue with Google**.
4. You will be redirected to Google to authenticate and then returned to Banana.
5. You should now see the **My Account** dropdown menu on the top right, with **Profile**, **Memberships**, and **Sign out** options.
