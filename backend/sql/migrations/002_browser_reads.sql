-- Banana migration 002: everything the website needs to read Supabase directly.
--
-- Run once in the Supabase SQL Editor, after supabase-setup.sql and accounts-setup.sql.
-- One transaction. It only ADDS columns and functions and replaces stores_within_radius
-- with the same inputs and outputs. It never deletes data, never touches "raw" or
-- "public", and never weakens access: visitors can still only read the catalogue.
--
--   1. store_locations.lat / lng: numeric coordinates, so map pins need no decoding.
--   2. chains.website_url: each chain's public website.
--   3. stores_within_radius: same contract; straight-line distance, only chains with prices.
--   4. search_offers(...): search, filters, sorting, paging, distance and unit prices.
--   5. price_shopping_list(...): what a whole list costs at each chain.
--
-- Rules shared with the backend's TypeScript (src/search/search.ts) so both give the same
-- answers, checked by backend tests:
--   * Money is whole cents. A sale counts only if it is below the regular price and today
--     (or p_as_of) is within its start and end dates. Member prices only for members.
--   * Distance: straight line on a sphere (radius 6371 km), shown to 0.1 km; a chain's
--     distance is to its nearest store in range. Prices are chain-wide.
--   * Text search: every word must appear in the name, brand, size or store name,
--     ignoring case and accents. Categories are not searched.

begin;

create extension if not exists unaccent with schema extensions;   -- accent-insensitive search

-- 1. Numeric coordinates, kept in step with "location" automatically.
alter table banana.store_locations
  add column lat double precision generated always as (extensions.st_y(location::extensions.geometry)) stored,
  add column lng double precision generated always as (extensions.st_x(location::extensions.geometry)) stored;

-- 2. Chain websites (public addresses; the backend's src/chainSites.ts has the same list).
alter table banana.chains add column website_url text check (website_url is null or website_url like 'https://%');
update banana.chains c set website_url = v.url
from (values
  ('save-on-foods', 'https://www.saveonfoods.com/'),
  ('walmart', 'https://www.walmart.ca/'),
  ('costco', 'https://www.costco.ca/'),
  ('no-frills', 'https://www.nofrills.ca/'),
  ('real-canadian-superstore', 'https://www.realcanadiansuperstore.ca/')
) as v(slug, url)
where c.slug = v.slug and c.website_url is null;

-- Straight-line distance in km between two points (haversine, radius 6371 km).
create function banana.distance_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 2 * 6371 * asin(sqrt(least(1,
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )))
$$;

-- Lowercase, no accents, single spaces: how text is compared everywhere.
create function banana.normalize_text(value text)
returns text
language sql
stable
set search_path = ''
as $$
  select btrim(regexp_replace(lower(extensions.unaccent(coalesce(value, ''))), '\s+', ' ', 'g'))
$$;

-- 3. Same inputs and outputs as before.
create or replace function banana.stores_within_radius(
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
  select s.id, s.chain_slug, s.name, s.address, s.city, s.postal_code, s.lat, s.lng,
    banana.distance_km(user_lat, user_lng, s.lat, s.lng)
  from banana.store_locations s
  where banana.distance_km(user_lat, user_lng, s.lat, s.lng) <= radius_km
    -- Only chains that have something to sell.
    and exists (select 1 from banana.products p join banana.prices pr on pr.product_id = p.id where p.chain_slug = s.chain_slug)
  order by 9, s.id collate "C"
$$;

-- 4. Search. All parameters are optional; empty arrays mean "no filter".
create function banana.search_offers(
  p_query            text default null,
  p_categories       text[] default null,
  p_chain_slugs      text[] default null,
  p_parent_companies text[] default null,
  p_location_ids     text[] default null,
  p_near_lat         double precision default null,
  p_near_lng         double precision default null,
  p_radius_km        double precision default null,
  p_on_sale_only     boolean default false,
  p_member           boolean default false,
  p_sort_by          text default 'price',
  p_sort_order       text default null,
  p_limit            integer default 50,
  p_offset           integer default 0,
  p_as_of            date default null
)
returns table (
  id                  text,
  chain_slug          text,
  chain_name          text,
  parent_company      text,
  location_id         text,
  sku                 text,
  name                text,
  brand               text,
  size                text,
  size_amount         numeric,
  size_unit           text,
  size_kind           text,
  size_total_base     numeric,
  pack_count          integer,
  priced_by_weight    boolean,
  category            text,
  image_url           text,
  price_cents         integer,
  regular_price_cents integer,
  discount_cents      integer,
  discount_percent    integer,
  sale_price_cents    integer,
  member_price_cents  integer,
  sale_start          date,
  sale_end            date,
  unit_per            text,
  unit_cents          numeric,
  unit_price_cents    integer,
  unit_label          text,
  source_url          text,
  scraped_at          timestamptz,
  distance_km         numeric,
  total_count         bigint
)
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_as_of   date := coalesce(p_as_of, (now() at time zone 'America/Vancouver')::date);
  v_near    boolean := p_near_lat is not null and p_near_lng is not null and p_radius_km is not null;
  v_sort    text := coalesce(p_sort_by, 'price');
  v_natural text;
  v_sign    integer;
  v_words   text[];
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then raise exception 'p_limit must be from 1 to 100' using errcode = '22023'; end if;
  if p_offset is null or p_offset < 0 then raise exception 'p_offset must be 0 or more' using errcode = '22023'; end if;
  if p_radius_km is not null and (p_radius_km <= 0 or p_radius_km > 10) then
    raise exception 'p_radius_km must be more than 0 and at most 10' using errcode = '22023';
  end if;
  if v_sort not in ('price', 'name', 'unitPrice', 'distance', 'discount') then
    raise exception 'p_sort_by must be price, name, unitPrice, distance or discount' using errcode = '22023';
  end if;
  if p_sort_order is not null and p_sort_order not in ('asc', 'desc') then
    raise exception 'p_sort_order must be asc or desc' using errcode = '22023';
  end if;
  -- Distance needs a location; without one, sort by price.
  if v_sort = 'distance' and not v_near then v_sort := 'price'; end if;
  v_natural := case when v_sort = 'discount' then 'desc' else 'asc' end;
  v_sign := case when p_sort_order is null or p_sort_order = v_natural then 1 else -1 end;
  v_words := array_remove(string_to_array(banana.normalize_text(p_query), ' '), '');

  return query
  with stores as (
    select s.id, s.chain_slug,
      case when v_near then banana.distance_km(p_near_lat, p_near_lng, s.lat, s.lng) end as km
    from banana.store_locations s
  ),
  in_range as (
    select st.* from stores st where not v_near or st.km <= p_radius_km
  ),
  nearest as (
    select r.chain_slug, min(r.km) as km from in_range r group by r.chain_slug
  ),
  base as (
    select
      p.chain_slug || ':' || p.sku as id,
      c.slug as chain_slug, c.name as chain_name, c.parent_company,
      pr.location_id, p.sku, p.name, p.brand, p.size, p.size_amount, p.size_unit, p.size_kind,
      p.size_total_base, p.pack_count, p.priced_by_weight, p.category, p.image_url,
      pr.regular_price_cents,
      (pr.sale_price_cents is not null and pr.sale_price_cents < pr.regular_price_cents
        and (pr.sale_start is null or pr.sale_start <= v_as_of)
        and (pr.sale_end is null or pr.sale_end >= v_as_of)) as sale_active,
      pr.sale_price_cents as raw_sale, pr.member_price_cents, pr.sale_start as raw_start, pr.sale_end as raw_end,
      pr.unit_price_cents, pr.unit_label, pr.source_url, pr.scraped_at,
      case
        when not v_near then null
        when pr.location_id is not null then (select r.km from in_range r where r.id = pr.location_id)
        else (select n.km from nearest n where n.chain_slug = p.chain_slug)
      end as raw_km
    from banana.prices pr
    join banana.products p on p.id = pr.product_id
    join banana.chains c on c.slug = p.chain_slug
    where (p_chain_slugs is null or cardinality(p_chain_slugs) = 0 or p.chain_slug = any(p_chain_slugs))
      and (p_parent_companies is null or cardinality(p_parent_companies) = 0
           or banana.normalize_text(c.parent_company) = any(array(select banana.normalize_text(x) from unnest(p_parent_companies) x)))
      and (p_categories is null or cardinality(p_categories) = 0 or p.category = any(p_categories))
      and (cardinality(v_words) = 0 or not exists (
            select 1 from unnest(v_words) w
            where position(w in banana.normalize_text(concat_ws(' ', p.name, p.brand, p.size, c.name))) = 0))
      and (p_location_ids is null or cardinality(p_location_ids) = 0 or (
            case when pr.location_id is not null then pr.location_id = any(p_location_ids)
                 else exists (select 1 from banana.store_locations s where s.id = any(p_location_ids) and s.chain_slug = p.chain_slug)
            end))
  ),
  priced as (
    select b.*,
      case
        when p_member and b.member_price_cents is not null
          then least(case when b.sale_active then b.raw_sale else b.regular_price_cents end, b.member_price_cents)
        else case when b.sale_active then b.raw_sale else b.regular_price_cents end
      end as price
    from base b
    where not v_near or b.raw_km is not null
  ),
  rows as (
    select pd.*,
      case when pd.regular_price_cents > 0 and pd.price < pd.regular_price_cents then pd.regular_price_cents - pd.price end as disc_cents,
      case when pd.regular_price_cents > 0 and pd.price < pd.regular_price_cents
        then round((pd.regular_price_cents - pd.price) * 100.0 / pd.regular_price_cents)::integer end as disc_percent,
      case when pd.size_kind is not null and pd.size_total_base > 0
        then case pd.size_kind when 'weight' then '100g' when 'volume' then '100ml' else 'each' end end as u_per,
      case when pd.size_kind is not null and pd.size_total_base > 0
        then case when pd.size_kind = 'count' then round(pd.price / pd.size_total_base, 2)
                  else round(pd.price * 100 / pd.size_total_base, 2) end end as u_cents,
      case when pd.raw_km is not null then round(pd.raw_km::numeric, 1) end as km
    from priced pd
  ),
  filtered as (
    select r.* from rows r where not p_on_sale_only or r.disc_cents is not null
  ),
  ordered as (
    select f.*,
      count(*) over () as total,
      -- Rows missing the sort value always come last, in both directions.
      case v_sort when 'unitPrice' then (f.u_per is null) when 'distance' then (f.km is null) when 'discount' then (f.disc_cents is null) else false end as missing,
      case when v_sort = 'unitPrice' then case f.u_per when '100g' then 0 when '100ml' then 1 when 'each' then 2 end end as grp,
      case v_sort when 'price' then f.price when 'unitPrice' then f.u_cents when 'distance' then f.km when 'discount' then -f.disc_percent end as key1,
      case when v_sort = 'discount' then -f.disc_cents end as key2,
      case when v_sort in ('distance', 'discount') or (v_sort = 'unitPrice' and f.u_per is null) then f.price end as tie_price,
      banana.normalize_text(f.name) as norm_name
    from filtered f
  )
  select o.id, o.chain_slug, o.chain_name, o.parent_company, o.location_id, o.sku, o.name, o.brand, o.size,
    o.size_amount, o.size_unit, o.size_kind, o.size_total_base, o.pack_count, o.priced_by_weight, o.category, o.image_url,
    o.price, o.regular_price_cents, o.disc_cents, o.disc_percent,
    case when o.sale_active then o.raw_sale end,
    o.member_price_cents,
    case when o.sale_active then o.raw_start end,
    case when o.sale_active then o.raw_end end,
    o.u_per, o.u_cents, o.unit_price_cents, o.unit_label, o.source_url, o.scraped_at, o.km, o.total
  from ordered o
  order by
    o.missing,
    o.grp,
    o.key1 * v_sign,
    o.key2 * v_sign,
    case when v_sort = 'name' and v_sign = 1 then o.norm_name end collate "C" asc,
    case when v_sort = 'name' and v_sign = -1 then o.norm_name end collate "C" desc,
    o.tie_price,
    case when v_sort <> 'name' then o.norm_name end collate "C",
    o.id collate "C"
  limit p_limit offset p_offset;
end;
$$;

-- 5. Price a whole shopping list. p_items is a JSON list of entries:
--      { "query": "milk", "categories": ["dairy-eggs"], "quantity": 2 }      2 of whatever matches
--      { "query": "milk", "amount": { "value": 2, "unit": "l" } }             enough packs for 2 L
--      { "itemId": "walmart:sim-bananas", "quantity": 1 }                    one exact item
--    With an amount, each match costs enough whole packs to cover it (or the weight, for items
--    priced per lb/kg), and matches whose size can't cover it (wrong kind, unknown size) are left out.
--    Returns { entries, chains, cheapestMix }: per entry the cheapest matches; per chain the total
--    buying everything there plus its nearest store in range; and the cheapest mix across chains.
create function banana.price_shopping_list(
  p_items            jsonb,
  p_chain_slugs      text[] default null,
  p_location_ids     text[] default null,
  p_near_lat         double precision default null,
  p_near_lng         double precision default null,
  p_radius_km        double precision default null,
  p_member           boolean default false,
  p_matches_per_item integer default 5,
  p_as_of            date default null
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_entry    jsonb;
  v_index    integer := 0;
  v_quantity integer;
  v_amount   numeric;
  v_kind     text;
  v_entries  jsonb := '[]'::jsonb;
  v_lines    jsonb := '[]'::jsonb;  -- every usable match: index, chain, cost, row
  v_matches  jsonb;
  v_total    integer;
  v_near     boolean := p_near_lat is not null and p_near_lng is not null and p_radius_km is not null;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'p_items must be a list of 1 to 50 entries' using errcode = '22023';
  end if;
  if p_matches_per_item is null or p_matches_per_item < 1 or p_matches_per_item > 20 then
    raise exception 'p_matches_per_item must be from 1 to 20' using errcode = '22023';
  end if;

  for v_entry in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_entry) <> 'object' or ((v_entry ? 'query') = (v_entry ? 'itemId')) then
      raise exception 'entry % must have "query" or "itemId", not both', v_index using errcode = '22023';
    end if;
    v_quantity := coalesce((v_entry ->> 'quantity')::integer, 1);
    if v_quantity < 1 or v_quantity > 99 then raise exception 'entry %: quantity must be from 1 to 99', v_index using errcode = '22023'; end if;

    v_amount := null;
    v_kind := null;
    if v_entry ? 'amount' then
      if v_entry ? 'quantity' then raise exception 'entry %: use "quantity" or "amount", not both', v_index using errcode = '22023'; end if;
      -- The amount in base units: grams, millilitres or items.
      select (v_entry #>> '{amount,value}')::numeric * f.factor, f.kind into v_amount, v_kind
      from (values ('g', 1::numeric, 'weight'), ('kg', 1000, 'weight'), ('lb', 453.59237, 'weight'), ('oz', 28.349523125, 'weight'),
                   ('ml', 1, 'volume'), ('l', 1000, 'volume'), ('fl oz', 29.5735295625, 'volume'), ('ct', 1, 'count'))
           as f(unit, factor, kind)
      where f.unit = lower(v_entry #>> '{amount,unit}');
      if v_amount is null or v_amount <= 0 then
        raise exception 'entry %: amount needs a positive value and a unit (g, kg, lb, oz, ml, l, fl oz, ct)', v_index using errcode = '22023';
      end if;
    end if;

    with found as (
      select s.*,
        case
          when v_amount is null then s.price_cents * v_quantity
          when s.size_kind is distinct from v_kind or not (s.size_total_base > 0) then null
          -- Sold by weight: pay for exactly the weight wanted.
          when s.priced_by_weight then round(s.price_cents * v_amount / s.size_total_base)::integer
          -- Sold in packs: buy enough whole packs.
          else (ceil(v_amount / s.size_total_base) * s.price_cents)::integer
        end as line_cents,
        case when v_amount is not null and not s.priced_by_weight and s.size_kind = v_kind and s.size_total_base > 0
          then ceil(v_amount / s.size_total_base)::integer end as packs
      from banana.search_offers(
        p_query => case when v_entry ? 'query' then v_entry ->> 'query' end,
        p_categories => case when v_entry ? 'categories' then array(select jsonb_array_elements_text(v_entry -> 'categories')) end,
        p_chain_slugs => p_chain_slugs, p_location_ids => p_location_ids,
        p_near_lat => p_near_lat, p_near_lng => p_near_lng, p_radius_km => p_radius_km,
        p_member => p_member, p_sort_by => 'price', p_limit => 100, p_as_of => p_as_of) s
      where not (v_entry ? 'itemId') or s.id = v_entry ->> 'itemId'
    ),
    usable as (
      select f.* from found f where f.line_cents is not null
    )
    select
      coalesce(jsonb_agg(to_jsonb(u) - 'total_count' order by u.line_cents, u.price_cents, banana.normalize_text(u.name) collate "C", u.id collate "C")
        filter (where true), '[]'::jsonb),
      count(*)
    into v_matches, v_total
    from usable u;

    v_entries := v_entries || jsonb_build_object(
      'index', v_index,
      'quantity', case when v_amount is null then v_quantity end,
      'amount', v_entry -> 'amount',
      'total', v_total,
      'matches', coalesce((select jsonb_agg(m) from (select m from jsonb_array_elements(v_matches) m limit p_matches_per_item) x), '[]'::jsonb)
    );
    v_lines := v_lines || coalesce((select jsonb_agg(jsonb_build_object('index', v_index, 'row', m)) from jsonb_array_elements(v_matches) m), '[]'::jsonb);
    v_index := v_index + 1;
  end loop;

  return (
    with lines as (
      select (l ->> 'index')::integer as idx, l -> 'row' as rw, (l #>> '{row,line_cents}')::integer as cost,
        l #>> '{row,chain_slug}' as chain_slug, l #>> '{row,chain_name}' as chain_name,
        l #>> '{row,name}' as name, l #>> '{row,id}' as id
      from jsonb_array_elements(v_lines) l
    ),
    best_per_chain as (
      select distinct on (chain_slug, idx) * from lines
      order by chain_slug, idx, cost, banana.normalize_text(name) collate "C", id collate "C"
    ),
    best_overall as (
      select distinct on (idx) * from lines
      order by idx, cost, banana.normalize_text(name) collate "C", id collate "C"
    ),
    nearest_store as (
      select distinct on (s.chain_slug) s.chain_slug, s.id, s.name,
        case when v_near then round(banana.distance_km(p_near_lat, p_near_lng, s.lat, s.lng)::numeric, 1) end as km
      from banana.store_locations s
      where (not v_near or banana.distance_km(p_near_lat, p_near_lng, s.lat, s.lng) <= p_radius_km)
        and (p_location_ids is null or cardinality(p_location_ids) = 0 or s.id = any(p_location_ids))
      order by s.chain_slug, case when v_near then banana.distance_km(p_near_lat, p_near_lng, s.lat, s.lng) end, s.id collate "C"
    ),
    chains as (
      select b.chain_slug, min(b.chain_name) as chain_name, sum(b.cost)::integer as total_cents,
        jsonb_agg(jsonb_build_object('index', b.idx, 'lineCents', b.cost, 'row', b.rw) order by b.idx) as picks,
        array(select i from generate_series(0, v_index - 1) i except select x.idx from best_per_chain x where x.chain_slug = b.chain_slug order by 1) as missing
      from best_per_chain b
      group by b.chain_slug
    )
    select jsonb_build_object(
      'entries', v_entries,
      'chains', coalesce((
        select jsonb_agg(jsonb_build_object(
            'chainSlug', c.chain_slug, 'chainName', c.chain_name, 'totalCents', c.total_cents,
            'itemsFound', jsonb_array_length(c.picks), 'missingIndexes', to_jsonb(c.missing), 'picks', c.picks,
            'nearestStore', case when ns.id is not null then jsonb_build_object('id', ns.id, 'name', ns.name, 'distanceKm', ns.km) end)
          order by cardinality(c.missing), c.total_cents, c.chain_name collate "C")
        from chains c left join nearest_store ns on ns.chain_slug = c.chain_slug), '[]'::jsonb),
      'cheapestMix', jsonb_build_object(
        'totalCents', coalesce((select sum(o.cost) from best_overall o), 0),
        'picks', coalesce((select jsonb_agg(jsonb_build_object('index', o.idx, 'lineCents', o.cost, 'row', o.rw) order by o.idx) from best_overall o), '[]'::jsonb),
        'missingIndexes', to_jsonb(array(select i from generate_series(0, v_index - 1) i except select o.idx from best_overall o order by 1)))
    )
  );
end;
$$;

-- Visitors may call these (they only read; row level security on the tables still applies).
grant execute on function banana.distance_km(double precision, double precision, double precision, double precision) to anon, authenticated, service_role;
grant execute on function banana.normalize_text(text) to anon, authenticated, service_role;
grant execute on function banana.search_offers(text, text[], text[], text[], text[], double precision, double precision, double precision, boolean, boolean, text, text, integer, integer, date)
  to anon, authenticated, service_role;
grant execute on function banana.price_shopping_list(jsonb, text[], text[], double precision, double precision, double precision, boolean, integer, date)
  to anon, authenticated, service_role;

commit;
