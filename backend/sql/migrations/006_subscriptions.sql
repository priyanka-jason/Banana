-- Banana migration 006: Premium subscriptions paid through Stripe.
--
-- Run once in the Supabase SQL Editor. One transaction: if any line fails,
-- nothing changes.
--
-- One row per person who has subscribed. Only the stripe-webhook Edge Function
-- writes here (as service_role, inside Supabase); a signed-in person can read
-- their own row and nothing else, and nobody can write from the website, so no
-- one can make themselves Premium from the browser. No card details are stored:
-- Stripe keeps those.

begin;

create table if not exists banana.subscriptions (
  user_id                uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  status                 text not null check (status in (
    'incomplete', 'incomplete_expired', 'trialing', 'active',
    'past_due', 'canceled', 'unpaid', 'paused'
  )),
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  updated_at             timestamptz not null default now()
);

alter table banana.subscriptions enable row level security;

drop policy if exists "people read their own subscription" on banana.subscriptions;
create policy "people read their own subscription" on banana.subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on banana.subscriptions from public, anon, authenticated;
grant select on banana.subscriptions to authenticated;
grant all on banana.subscriptions to service_role;

commit;

-- Tell the Data API about the new table.
notify pgrst, 'reload schema';
