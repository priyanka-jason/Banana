-- Banana migration 003: search results say which branch a price is for.
--
-- Run once in the Supabase SQL Editor, after 002_browser_reads.sql. One transaction.
-- banana.search_offers gets two more columns, nearest_store_id and nearest_store_name:
-- the closest branch of that chain within the radius, or the branch picked with
-- p_location_ids (null when neither a location nor a branch was given). Everything else
-- about the function is unchanged. Adding columns changes the function's result type,
-- so it is dropped and created again in the same transaction; the grant is re-applied.
-- No data is changed.

begin;

drop function banana.search_offers(text, text[], text[], text[], text[], double precision, double precision, double precision, boolean, boolean, text, text, integer, integer, date);

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
  nearest_store_id    text,
  nearest_store_name  text,
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
  -- The branch a chain-wide price is shown for: the nearest one in range, or the one picked.
  nearest_store as (
    select distinct on (r.chain_slug) r.chain_slug, r.id, s.name
    from in_range r
    join banana.store_locations s on s.id = r.id
    where p_location_ids is null or cardinality(p_location_ids) = 0 or r.id = any(p_location_ids)
    order by r.chain_slug, r.km nulls last, r.id collate "C"
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
      end as raw_km,
      case
        when pr.location_id is not null then pr.location_id
        when v_near or cardinality(coalesce(p_location_ids, '{}')) > 0
          then (select ns.id from nearest_store ns where ns.chain_slug = p.chain_slug)
      end as ns_id,
      case
        when pr.location_id is not null then (select s.name from banana.store_locations s where s.id = pr.location_id)
        when v_near or cardinality(coalesce(p_location_ids, '{}')) > 0
          then (select ns.name from nearest_store ns where ns.chain_slug = p.chain_slug)
      end as ns_name
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
    o.u_per, o.u_cents, o.unit_price_cents, o.unit_label, o.source_url, o.scraped_at, o.km, o.ns_id, o.ns_name, o.total
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

grant execute on function banana.search_offers(text, text[], text[], text[], text[], double precision, double precision, double precision, boolean, boolean, text, text, integer, integer, date)
  to anon, authenticated, service_role;

-- Ask Supabase's web API to pick up the new columns right away.
notify pgrst, 'reload schema';

commit;
