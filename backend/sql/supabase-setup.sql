-- Banana: database setup for Supabase.
--
-- Run once in the Supabase SQL Editor (paste it all, then Run). It is one
-- transaction: if any line fails, nothing at all is created, and it can be
-- fixed and run again. Running it a second time after it succeeded fails on
-- "already exists" and changes nothing.
--
-- It only ADDS things. It never touches public.grocery_items or anything else
-- already in "public". Everything of ours lives in two schemas of our own
-- (a schema is a named section of the database):
--
--   raw     PER-STORE LAYER. One table per store chain, private. Each row is
--           one item as that store's connector saved it, plus the store's
--           original data untouched.
--   banana  FINAL LAYER. Checked, combined data with shared categories and
--           sizes split into columns. The only layer the website reads
--           (through the backend API).
--
-- The combine step (backend/src/pipeline/combine.ts) reads "raw" and writes
-- "banana". This file is backend/sql/draft-schema.sql adapted for Supabase:
-- the final layer moved from "public" to "banana", and the PostGIS and pg_trgm
-- names are written with their "extensions." prefix, where Supabase keeps them.

begin;

-- Add-ons. Supabase keeps them in the "extensions" schema.
create extension if not exists postgis with schema extensions;   -- map locations and radius search
create extension if not exists pg_trgm with schema extensions;   -- fast "name contains this text" search

-- Supabase already lets its roles use the add-ons; saying it again is harmless and
-- makes this file work on a plain Postgres too.
grant usage on schema extensions to anon, authenticated, service_role;


-- ===========================================================================
-- LAYER 1: PER-STORE (schema "raw")
-- ===========================================================================

create schema raw;

-- One table per chain, all the same shape (StoreRecord in backend/src/pipeline/types.ts).
-- The table name is the chain slug with "-" turned into "_" (rawTableName() in
-- backend/src/db/storeData.ts). Saving again with the same sku replaces the row.
--   payload   the cleaned item (a RawItem without "original"), with the store's
--             own category names in "storeCategories"
--   original  the store's data exactly as received
create table raw.save_on_foods (
  sku        text primary key,
  scraped_at timestamptz not null,
  payload    jsonb not null check (jsonb_typeof(payload) = 'object'),
  original   jsonb check (original is null or jsonb_typeof(original) = 'object')
);

create table raw.walmart (
  sku        text primary key,
  scraped_at timestamptz not null,
  payload    jsonb not null check (jsonb_typeof(payload) = 'object'),
  original   jsonb check (original is null or jsonb_typeof(original) = 'object')
);

create table raw.costco (
  sku        text primary key,
  scraped_at timestamptz not null,
  payload    jsonb not null check (jsonb_typeof(payload) = 'object'),
  original   jsonb check (original is null or jsonb_typeof(original) = 'object')
);

create table raw.no_frills (
  sku        text primary key,
  scraped_at timestamptz not null,
  payload    jsonb not null check (jsonb_typeof(payload) = 'object'),
  original   jsonb check (original is null or jsonb_typeof(original) = 'object')
);

create table raw.real_canadian_superstore (
  sku        text primary key,
  scraped_at timestamptz not null,
  payload    jsonb not null check (jsonb_typeof(payload) = 'object'),
  original   jsonb check (original is null or jsonb_typeof(original) = 'object')
);

-- Private: row level security with no policies keeps the website's keys out, and
-- taking away privileges is a second lock. Only the backend (service role key, or
-- a direct database connection) reads and writes here.
alter table raw.save_on_foods            enable row level security;
alter table raw.walmart                  enable row level security;
alter table raw.costco                   enable row level security;
alter table raw.no_frills                enable row level security;
alter table raw.real_canadian_superstore enable row level security;

revoke all on schema raw from public, anon, authenticated;
revoke all on all tables in schema raw from public, anon, authenticated;
grant usage on schema raw to service_role;
grant all on all tables in schema raw to service_role;
alter default privileges in schema raw revoke all on tables from public, anon, authenticated;
alter default privileges in schema raw grant all on tables to service_role;


-- ===========================================================================
-- LAYER 2: FINAL (schema "banana"), the only layer the website reads
-- ===========================================================================

create schema banana;

-- One store brand, e.g. Save-On-Foods.
create table banana.chains (
  slug               text primary key,
  name               text not null,
  parent_company     text not null,
  has_member_pricing boolean not null default false
);

-- One physical store. "id" is the stable text id the connector supplies,
-- e.g. 'walmart-sim-metrotown'. "location" is longitude and latitude.
create table banana.store_locations (
  id          text primary key,
  chain_slug  text not null references banana.chains (slug),
  name        text not null,
  address     text,
  city        text,
  postal_code text,
  location    extensions.geography(Point, 4326) not null
);
create index store_locations_location_idx on banana.store_locations using gist (location);
create index store_locations_chain_idx on banana.store_locations (chain_slug);

-- An item as one chain sells it. The id shown to shoppers is chain_slug || ':' || sku.
-- "category" must match PRODUCT_CATEGORIES in backend/src/categories.ts.
-- Size: "size" is the store's text ("2 x 4 L"); the other size columns are that
-- text split up once by the combine step (pack_count 2, size_amount 4, size_unit l,
-- size_kind volume, size_total_base 8000 ml). If the size can't be read, the four
-- size columns stay empty together.
create table banana.products (
  id               bigint generated always as identity primary key,
  chain_slug       text not null references banana.chains (slug),
  sku              text not null,
  name             text not null,
  brand            text,
  size             text,
  pack_count       integer not null default 1 check (pack_count >= 1),
  size_amount      numeric check (size_amount > 0),
  size_unit        text check (size_unit in ('g', 'kg', 'lb', 'oz', 'ml', 'l', 'fl oz', 'ct')),
  size_kind        text check (size_kind in ('weight', 'volume', 'count')),
  size_total_base  numeric check (size_total_base > 0),
  priced_by_weight boolean not null default false,
  upc              text,
  category         text check (category in (
    'fruits', 'vegetables', 'meat', 'seafood', 'dairy-eggs', 'bakery',
    'frozen', 'beverages', 'snacks', 'pantry', 'household', 'other'
  )),
  store_categories text[] not null default '{}',
  image_url        text,
  unique (chain_slug, sku),
  check (
    (size_amount is null) = (size_unit is null)
    and (size_unit is null) = (size_kind is null)
    and (size_kind is null) = (size_total_base is null)
  )
);
create index products_name_trgm_idx on banana.products using gin (name extensions.gin_trgm_ops);
create index products_category_idx on banana.products (category);
create index products_size_idx on banana.products (size_kind, size_total_base);

-- The latest price for a product (saving again overwrites). location_id null means
-- the price applies at every store of the chain, which is how prices work today.
-- Money is whole cents. What a shopper pays, the discount and the comparable unit
-- price are worked out when reading, so they are not stored.
create table banana.prices (
  id                  bigint generated always as identity primary key,
  product_id          bigint not null references banana.products (id) on delete cascade,
  location_id         text references banana.store_locations (id),
  regular_price_cents integer not null check (regular_price_cents >= 0),
  sale_price_cents    integer check (sale_price_cents >= 0),
  member_price_cents  integer check (member_price_cents >= 0),
  unit_price_cents    integer check (unit_price_cents >= 0),
  unit_label          text,
  sale_start          date,
  sale_end            date,
  source_url          text,
  scraped_at          timestamptz not null default now(),
  unique nulls not distinct (product_id, location_id)
);
create index prices_location_idx on banana.prices (location_id);

-- Physical stores within a radius of a point, nearest first.
-- The point comes from a visitor who allowed location (or a neighbourhood centre).
-- It is only used for this calculation and never stored.
create function banana.stores_within_radius(
  user_lat  double precision,
  user_lng  double precision,
  radius_km double precision
)
returns table (
  id          text,
  chain_slug  text,
  name        text,
  address     text,
  city        text,
  postal_code text,
  lat         double precision,
  lng         double precision,
  distance_km double precision
)
language sql
stable
set search_path = ''
as $$
  select
    s.id,
    s.chain_slug,
    s.name,
    s.address,
    s.city,
    s.postal_code,
    extensions.st_y(s.location::extensions.geometry),
    extensions.st_x(s.location::extensions.geometry),
    extensions.st_distance(
      s.location,
      extensions.st_setsrid(extensions.st_makepoint(user_lng, user_lat), 4326)::extensions.geography
    ) / 1000.0
  from banana.store_locations s
  where extensions.st_dwithin(
    s.location,
    extensions.st_setsrid(extensions.st_makepoint(user_lng, user_lat), 4326)::extensions.geography,
    radius_km * 1000.0
  )
  order by 9;
$$;

-- Anyone may read the final layer; only the backend may write it.
alter table banana.chains          enable row level security;
alter table banana.store_locations enable row level security;
alter table banana.products        enable row level security;
alter table banana.prices          enable row level security;

create policy "anyone can read chains"          on banana.chains          for select using (true);
create policy "anyone can read store_locations" on banana.store_locations for select using (true);
create policy "anyone can read products"        on banana.products        for select using (true);
create policy "anyone can read prices"          on banana.prices          for select using (true);

grant usage on schema banana to anon, authenticated, service_role;
grant select on all tables in schema banana to anon, authenticated;
grant all on all tables in schema banana to service_role;
grant all on all sequences in schema banana to service_role;
grant execute on function banana.stores_within_radius(double precision, double precision, double precision)
  to anon, authenticated, service_role;

commit;

-- After running: nothing else is required for the backend if it connects with the
-- database connection string. Only if the website or supabase-js should reach these
-- tables through Supabase's automatic API, add "banana" (and, for the backend's
-- writes, "raw") under Project Settings > API > Exposed schemas.
