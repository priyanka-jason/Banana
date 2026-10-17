-- DRAFT ONLY. Nothing runs this file automatically.
--
-- A proposed table layout for Banana, written to match backend/src/types.ts.
-- The person setting up Supabase can copy it, change it, or ignore it. If the
-- layout changes, tell the backend owner so the TypeScript code can follow.
--
-- Not yet run against a real database. Needs Postgres 15 or newer ("nulls not
-- distinct" below). Supabase projects are on 15 or newer.
--
-- NOTE: this draft is the FINAL layer that the website reads, using our shared
-- categories. Each store's own data, with the store's own category names (see
-- RawItem.storeCategories), is meant to be kept as scraped in a separate raw
-- layer that is not drafted yet. Combining store categories into the shared
-- ones is a later step, so the category check below applies to this layer only.

-- Extensions. In Supabase these live in the "extensions" schema.
create extension if not exists postgis with schema extensions;   -- map locations and radius search
create extension if not exists pg_trgm with schema extensions;   -- fast "contains this text" search

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
-- "category" must match PRODUCT_CATEGORIES in backend/src/categories.ts.
create table products (
  id         bigint generated always as identity primary key,
  chain_slug text not null references chains (slug),
  sku        text not null,
  name       text not null,
  brand      text,
  size       text,
  upc        text,
  category   text check (category in (
    'fruits', 'vegetables', 'meat', 'seafood', 'dairy-eggs', 'bakery',
    'frozen', 'beverages', 'snacks', 'pantry', 'household', 'other'
  )),
  image_url  text,
  unique (chain_slug, sku)
);
create index products_name_trgm_idx on products using gin (name gin_trgm_ops);
create index products_category_idx on products (category);

-- The latest price for a product. This draft keeps only the newest price
-- (saving again overwrites). Keep history later if the team wants price trends.
-- location_id null means the price applies to every store in the chain.
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
