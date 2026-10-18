-- Banana: saved shopping lists for signed-in shoppers.
--
-- Run once in the Supabase SQL Editor, AFTER supabase-setup.sql (it needs the
-- "banana" schema). One transaction: if any line fails, nothing is created.
-- It only adds two tables; nothing existing is changed.
--
-- Accounts themselves are Supabase Auth's job: when someone signs in with Google
-- or Apple, Supabase creates their row in auth.users. We never see or store a
-- password. Our tables only point at that row by its id, and deleting the account
-- deletes the person's lists with it.
--
-- Privacy: a list belongs to one person, and row level security makes every row
-- visible and changeable only by its owner. The website's public (anon) key gets
-- nothing at all. Nothing here stores a location.

begin;

-- One saved list, e.g. "Weekly groceries".
create table banana.shopping_lists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shopping_lists_user_idx on banana.shopping_lists (user_id);

-- One line on a list, in order. Same shape as an entry of POST /api/prices/list:
-- either a search ("milk", optionally limited to some categories) or one exact
-- item id ("walmart:sim-bananas"), never both. Limits match backend/src/search/shoppingList.ts.
create table banana.shopping_list_items (
  id         bigint generated always as identity primary key,
  list_id    uuid not null references banana.shopping_lists (id) on delete cascade,
  position   integer not null check (position between 0 and 49),
  query      text check (char_length(query) between 1 and 100),
  item_id    text check (char_length(item_id) between 1 and 200),
  categories text[] not null default '{}' check (categories <@ array[
    'fruits', 'vegetables', 'meat', 'seafood', 'dairy-eggs', 'bakery',
    'frozen', 'beverages', 'snacks', 'pantry', 'household', 'other'
  ]::text[]),
  quantity   integer not null default 1 check (quantity between 1 and 99),
  check ((query is null) <> (item_id is null)),
  check (item_id is null or categories = '{}'),
  unique (list_id, position)
);

-- Owner-only. "(select auth.uid())" is the signed-in person's id from their login token.
alter table banana.shopping_lists      enable row level security;
alter table banana.shopping_list_items enable row level security;

create policy "owners read their lists"   on banana.shopping_lists for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "owners add lists"          on banana.shopping_lists for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "owners change their lists" on banana.shopping_lists for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "owners delete their lists" on banana.shopping_lists for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "owners use their list items" on banana.shopping_list_items for all to authenticated
  using (exists (
    select 1 from banana.shopping_lists l where l.id = list_id and l.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from banana.shopping_lists l where l.id = list_id and l.user_id = (select auth.uid())
  ));

revoke all on banana.shopping_lists, banana.shopping_list_items from public, anon;
grant select, insert, update, delete on banana.shopping_lists, banana.shopping_list_items to authenticated;
grant usage on sequence banana.shopping_list_items_id_seq to authenticated;
grant all on banana.shopping_lists, banana.shopping_list_items to service_role;
grant all on sequence banana.shopping_list_items_id_seq to service_role;

commit;
