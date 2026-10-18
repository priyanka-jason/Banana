-- DRAFT ONLY. Nothing runs this file automatically.
--
-- A proposed table layout for Banana, written to match backend/src/types.ts and
-- backend/src/pipeline/types.ts. The person setting up Supabase can copy it,
-- change it, or ignore it. If the layout changes, tell the backend owner so the
-- TypeScript code can follow.
--
-- Not yet run against a real database. Needs Postgres 15 or newer ("nulls not
-- distinct" below). Supabase projects are on 15 or newer.
--
-- TWO LAYERS
--   1. PER-STORE LAYER (schema "raw"): one table per store. Each row has the
--      cleaned item as JSON (with the store's own category names) and, in its own
--      column, the store's original data exactly as received. Private: the
--      website never reads it.
--   2. FINAL LAYER (schema "public"): checked, combined data with our shared
--      categories and the size split into separate columns. The only layer the
--      website reads.
-- The combine step (backend/src/pipeline/combine.ts) reads layer 1 and writes
-- layer 2, using the admin (service role) key.

-- Extensions. In Supabase these live in the "extensions" schema.
create extension if not exists postgis with schema extensions;   -- map locations and radius search
create extension if not exists pg_trgm with schema extensions;   -- fast "contains this text" search


-- ===========================================================================
-- LAYER 1: PER-STORE (schema "raw")
-- ===========================================================================

create schema if not exists raw;

-- One table per store chain, all the same shape (it matches StoreRecord in
-- backend/src/pipeline/types.ts). The table name is the chain slug with "-"
-- turned into "_" (real-canadian-superstore -> raw.real_canadian_superstore).
-- To add a store, copy one and change the name. Five today: Save-On-Foods,
-- Walmart, Costco, No Frills and Real Canadian Superstore. All five feed the one
-- final layer below.
--   payload  the cleaned item as the connector saved it: normally a RawItem (without
--            "original") plus any extra store-specific fields, with the store's own
--            category names in "storeCategories".
--   original the store's data for the item exactly as received, untouched (for
--            example Walmart's "$5.47" text and its "was" price). Connectors should
--            always set it; it is null only if one didn't.
-- Saving again with the same sku replaces the row.
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

-- Keep this layer private. Row level security with no policies means the
-- website's keys can neither read nor write it. Taking away privileges is a
-- second lock. The service role key skips row level security but still needs
-- privileges on this schema.
alter table raw.save_on_foods enable row level security;
alter table raw.walmart       enable row level security;
alter table raw.costco        enable row level security;
alter table raw.no_frills     enable row level security;
alter table raw.real_canadian_superstore enable row level security;

revoke all on schema raw from anon, authenticated;
revoke all on all tables in schema raw from anon, authenticated;
alter default privileges in schema raw revoke all on tables from anon, authenticated;

grant usage on schema raw to service_role;
grant all on all tables in schema raw to service_role;
alter default privileges in schema raw grant all on tables to service_role;

-- DECISION for whoever sets up Supabase: how does the backend reach "raw"?
--   a) Add "raw" to "Exposed schemas" in the API settings, so supabase-js can
--      use .schema('raw'). The privileges and row level security above still
--      keep the website's anon key out, so those two locks must stay.
--   b) Leave "raw" unexposed (by default only "public" is exposed; check the API
--      settings) and have the backend connect to Postgres directly with the
--      database connection string.
-- Either way, the website only ever talks to the final layer below.


-- ===========================================================================
-- LAYER 2: FINAL (schema "public"), the only layer the website reads
-- ===========================================================================

-- One store brand, e.g. Save-On-Foods.
create table chains (
  slug               text primary key,
  name               text not null,
  parent_company     text not null,
  has_member_pricing boolean not null default false
);

-- One physical store. "id" is a stable text id the connector supplies, e.g.
-- 'costco-123' (chain + the chain's own store number), so prices and stores
-- can be matched without the database inventing ids the connector can't know.
-- "location" holds longitude and latitude for distance searches and map markers.
create table store_locations (
  id          text primary key,
  chain_slug  text not null references chains (slug),
  name        text not null,
  address     text,
  city        text,
  postal_code text,
  location    geography(Point, 4326) not null
);
create index store_locations_location_idx on store_locations using gist (location);
create index store_locations_chain_idx on store_locations (chain_slug);

-- An item as one chain sells it. The same product at two chains is two rows.
-- The id shown to shoppers is chain_slug || ':' || sku (see itemId() in
-- backend/src/pricing.ts), so a search query can build it from these two columns.
-- "category" is our shared category and must match PRODUCT_CATEGORIES in
-- backend/src/categories.ts. "store_categories" keeps the store's own category
-- names (broadest first) so we can see where the shared category came from.
--
-- SIZE. "size" is the text as the store wrote it ("2 x 4 L") and is what people
-- see. The combine step splits it once into the columns below, so the database
-- can sort and filter on it:
--   pack_count        how many packs are bundled: 2 in "2 x 4 L" (1 for a single pack)
--   size_amount       amount in one pack, in size_unit: 4
--   size_unit         from a fixed list (g, kg, lb, oz, ml, l, fl oz, ct)
--   size_kind         weight, volume or count
--   size_total_base   everything in the pack in a base unit: grams for weight,
--                     millilitres for volume, items for count (8000 here)
--   priced_by_weight  true when the price is per unit of weight ("per lb", "per kg")
--                     rather than for a package
-- If the size text can't be read, the four size columns stay empty together.
create table products (
  id               bigint generated always as identity primary key,
  chain_slug       text not null references chains (slug),
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
create index products_name_trgm_idx on products using gin (name gin_trgm_ops);
create index products_category_idx on products (category);
create index products_size_idx on products (size_kind, size_total_base);

-- The latest price for a product. This draft keeps only the newest price
-- (saving again overwrites). Keep history later if the team wants price trends.
-- location_id null means the price applies to every store in the chain.
-- What a shopper pays, the discount and the comparable unit price are worked out
-- when reading (they depend on member or non-member), so they are not stored.
create table prices (
  id                  bigint generated always as identity primary key,
  product_id          bigint not null references products (id) on delete cascade,
  location_id         text references store_locations (id),
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
create index prices_location_idx on prices (location_id);

-- Physical stores within a radius of a point, nearest first.
-- The website calls it with: supabase.rpc('stores_within_radius', { user_lat, user_lng, radius_km })
-- The point comes from the visitor's browser location request, which they can
-- refuse, so the website must work without calling this.
create or replace function stores_within_radius(
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
as $$
  select
    s.id,
    s.chain_slug,
    s.name,
    s.address,
    s.city,
    s.postal_code,
    st_y(s.location::geometry),
    st_x(s.location::geometry),
    st_distance(s.location, st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography) / 1000.0
  from store_locations s
  where st_dwithin(
    s.location,
    st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
    radius_km * 1000.0
  )
  order by
    st_distance(s.location, st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography);
$$;

-- Row level security: anyone (including the website with the anon key) can
-- read. Nobody can write except with the service role key, which only the
-- backend scripts hold.
alter table chains          enable row level security;
alter table store_locations enable row level security;
alter table products        enable row level security;
alter table prices          enable row level security;

create policy "public read chains"          on chains          for select using (true);
create policy "public read store_locations" on store_locations for select using (true);
create policy "public read products"        on products        for select using (true);
create policy "public read prices"          on prices          for select using (true);
