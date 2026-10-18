# Banana: backend handoff to the frontend (direct Supabase)

Reply to "Banana: direct Supabase handoff" (October 17, 2026). **Everything below is live in Supabase and
was verified with the publishable key.** The website can now replace its mock data with these reads.

## In one paragraph

Read the `banana` schema directly with the project URL and the **publishable key**. Plain table reads give
chains and stores (with numeric `lat`/`lng`); three read-only functions (RPCs) do the work that plain
reads can't: `search_offers` (Search page, Home discounts, branch "Browse items"), `stores_within_radius`
(Locations) and `price_shopping_list` (comparing a whole list). Visitors cannot change anything, cannot
read saved lists and cannot reach the private `raw` data. `public.grocery_items` / `public.store_branches`
are placeholders: don't use them.

## Setup on your side

```ts
// frontend/.env.local (and the same two in Cloudflare Pages > banana > Settings > Variables)
VITE_SUPABASE_URL=https://wkqxnxjsvrnnpikibrfh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   // Supabase > Project Settings > API Keys
```

The publishable key is browser-safe by design. **Never** put the service-role / `sb_secret_` key, a database
password or `DATABASE_URL` in frontend code, `VITE_` variables or chat.

With `@supabase/supabase-js`:

```ts
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  db: { schema: 'banana' },
})
```

Or plain `fetch`: send `apikey: <key>` plus `Accept-Profile: banana` (GET) or `Content-Profile: banana` (POST).

## What to call, page by page

| Page / piece | Call |
|---|---|
| **Home** "Nearby discounts" | `rpc('search_offers', { p_near_lat, p_near_lng, p_radius_km, p_on_sale_only: true, p_sort_by: 'discount', p_limit: 4 })` |
| **Search items** (text, category, store, radius, discounts only, sort, paging) | `rpc('search_offers', { p_query, p_categories, p_chain_slugs, p_near_lat, p_near_lng, p_radius_km, p_on_sale_only, p_sort_by, p_sort_order, p_limit, p_offset })` |
| **Locations**: stores near an address / "Use my location" | `rpc('stores_within_radius', { user_lat, user_lng, radius_km })` |
| **Locations**: "Browse items" for a branch | `rpc('search_offers', { p_location_ids: [branchId] })` |
| Map pins for every branch | `from('store_locations').select('id,chain_slug,name,address,city,postal_code,lat,lng').order('id')` |
| Store filter + "View flyer / View offer" link | `from('chains').select('slug,name,parent_company,website_url').order('name')` |
| Category filter | the 12 slugs below (fixed list) |
| Shopping list comparison | `rpc('price_shopping_list', { p_items, p_near_lat, p_near_lng, p_radius_km })` |

Sort names: Featured / Recommended → `p_sort_by: 'discount'`; Price low→high → `'price'`; high→low →
`'price'` with `p_sort_order: 'desc'`; Distance → `'distance'` (needs a location, otherwise it falls back to
price); also `'name'` and `'unitPrice'`.

Location: send it only in these POST bodies, rounded to 2 decimals (about 1 km), and keep it in memory only.
Radius: more than 0, at most 10 km. Limit: 1 to 100.

## `search_offers` rows → your `Offer`

Real row (Home discounts near Mount Pleasant): `save-on-foods:sim-bananas`, `price_cents` 49, `regular_price_cents`
79, `discount_percent` 38, `sale_end` 2026-10-22, `distance_km` 0.6, `unit_per` 100g, `unit_cents` 10.8.

| Your field | From the row |
|---|---|
| `id` | `id` (`chain:sku`, stable) |
| `name`, `pack` | `name`, `size` |
| `category` | `category` (slug, see below) |
| `image` | your local image keyed by `sku` (e.g. `sim-gala-apples` → `gala-apples`), else a category image |
| `price` | `price_cents / 100`: what the shopper pays today |
| `regularPrice` | `regular_price_cents / 100`, only when `discount_cents` is not null |
| `unitPrice` | from `unit_per` + `unit_cents`: `100g` → `$x/kg` (× 10) or `$x/lb` (× 4.536 when `size_unit` is `lb`/`oz`); `100ml` → `$x/L` (× 10); `each` → `$x each`. Omit when null |
| `storeId` | `chain_slug` (your `superstore` = `real-canadian-superstore`; map it in one place) |
| `distance` | `distance_km` (only when you sent a location or a branch) |
| store line under the price | `nearest_store_name` (and `nearest_store_id`): the branch the distance is to, or the branch picked. Null without a location or branch. **Arrives with migration 003** (see "Still open") |
| "Valid until" | `sale_end` (only while the sale is active) |
| "Updated …" | `scraped_at` |
| result count | `total_count` (same on every row: matches before paging) |

Rules the function already applies: the price is the sale price only if it's below the regular price **and
today is within its start/end dates**; every word of `p_query` must appear in the name, brand, size or store
name (case and accents ignored); distance is straight-line to the chain's nearest branch in range.

## "Where is this item cheapest near me?"

[`backend/src/client/itemSearch.ts`](../src/client/itemSearch.ts) is a drop-in replacement for the earlier
`itemSearch.ts` that used the service-role key: same function, `searchItemPricesWithinProximityTS(term, lat, lng, km)`,
same result fields (`chainSlug`, `chainName`, `productName`, `sku`, `basePriceCents`, `discountedPriceCents`,
`discountAmountCents`), plus `id`, `size`, `distanceKm`, `storeId`, `storeName` and `saleEnd` (`storeId`/`storeName` stay null until migration 003 is applied). It calls
`search_offers` with the publishable key, so it needs no secret and gets the same sale rules and distances as
every other page. Copy it into `frontend/src/api/` and create it once:

```ts
import { createItemSearch } from './itemSearch'
export const { searchItemPricesWithinProximityTS } = createItemSearch({
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
})
```

Fixed on the way: it no longer needs the admin key (or prints it in an error), no longer decodes PostGIS bytes,
respects sale dates, never turns a missing price into $0, names the chain (not a random branch) in
`chainName`, filters in the database instead of downloading every product, and treats `%` and `_` in the
search text as plain characters.

## Categories

`fruits`, `vegetables`, `meat`, `seafood`, `dairy-eggs`, `bakery`, `frozen`, `beverages`, `snacks`, `pantry`,
`household`, `other`. Your `Category` type (`Produce`/`Dairy`/`Eggs`) needs to switch to these. Labels:
Fruits, Vegetables, Meat, Seafood, Dairy & Eggs, Bakery, Frozen, Beverages, Snacks, Pantry, Household, Other.

## Shopping list

```ts
supabase.rpc('price_shopping_list', {
  p_items: [
    { query: 'milk', amount: { value: 2, unit: 'l' } }, // enough whole packs for 2 L
    { query: 'bananas', quantity: 2 },                 // 2 of whatever matches (per-lb items: 2 lb)
    { itemId: 'walmart:sim-gala-apples' },             // one exact item
  ],
  p_near_lat: 49.26, p_near_lng: -123.11, p_radius_km: 5,
})
```

Units: `g`, `kg`, `lb`, `oz`, `ml`, `l`, `fl oz`, `ct`. Returns `entries` (cheapest `matches` per line with
`line_cents` and `packs`), `chains` (total at each chain, `itemsFound`, `missingIndexes`, `nearestStore`
`{ id, name, distanceKm }`; fewest missing first, then cheapest) and `cheapestMix` (split across chains).
Live example near Mount Pleasant: Save-On-Foods $4.97 (nearest: Cambie, 0.6 km), No Frills $6.47, Costco
$11.27; cheapest mix $4.47.

## Errors and empty states

- Bad input → HTTP 400 with a readable `message` (e.g. "p_radius_km must be more than 0 and at most 10").
- No matches → an empty list (`total_count` is on rows, so 0 rows means 0).
- Network or permission failure → show an error state. Never fall back to mock prices.
- No active discounts (the simulated sales end Oct 22, Costco Nov 1) → show an honest empty state.

## The data, honestly

- **Prices, discounts and dates are simulated** (283 offers, 5 chains). Keep the "Sample prices" label.
- **Stores are real**: your 38 branches, same ids. Prices are chain-wide: every branch of a chain shares them.
- **No images or flyer links** in the database; images stay in the frontend. A plan for one picture per
  product (AVIF with WebP fallback, keyed by product) is ready if you want it.
- `scraped_at` is when the data was last loaded. A daily update job exists and switches on once the project
  owner adds its secret.

## Verified live with the publishable key (October 17, 2026)

| Check | Result |
|---|---|
| Read chains (with `website_url`), stores (with `lat`/`lng`), products, prices with embedding | ✅ 5 chains, 38 stores, 283 offers |
| `search_offers`: discounts near Mount Pleasant | ✅ 61 results, biggest discount first, distances and unit prices filled |
| `search_offers`: text "milk walmart" | ✅ `walmart:sim-milk-2-4l` |
| `search_offers`: branch `nofrills-joti` | ✅ 49 offers, all No Frills, paged |
| `stores_within_radius` 1 km | ✅ Save-On Main St 0.19 km, Kingsgate 0.34 km, Joti's No Frills 0.89 km |
| `itemSearch.ts` drop-in, "bananas" within 5 km | ✅ 6 offers, cheapest first, with chain names, savings and distances |
| `price_shopping_list` with an amount | ✅ totals per chain with nearest store |
| Invalid input | ✅ clear 400 message |
| Visitors change prices or stores | ✅ refused (`permission denied`) |
| Visitors read saved lists or `raw` | ✅ refused |
| Same answers as the backend's tested search | ✅ 15 searches compared, identical (backend tests) |

## Still open (backend / project owner)

- Migration 003 (`sql/migrations/003_search_nearest_store.sql`): adds `nearest_store_id` / `nearest_store_name` to `search_offers`. Tested; applied after it is merged.

- Daily update: add `DATABASE_URL` as a GitHub repository secret.
- Real prices: not collected yet; needs a decision on the store sites' terms.
- `raw` is listed under Supabase's exposed schemas (still locked); the owner may switch that off.
- The custom API / Cloudflare Worker (`banana-api`) is no longer needed by the website.

## Your checklist

- [ ] Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (locally and in Cloudflare Pages)
- [ ] Replace `mockOffers` / `storeLocations` reads with the calls above
- [ ] Switch categories to the 12 slugs; map `superstore` ↔ `real-canadian-superstore` once
- [ ] Loading, empty, no-discounts and error states (no fallback to mock prices)
- [ ] Keep the visitor's location in memory only, rounded, POST bodies only
- [ ] Images keyed by `sku`, with a category fallback

Questions: ask the backend owner. More detail: [`api-contract.md`](api-contract.md) (field meanings) and
[`accounts.md`](accounts.md) (optional sign-in and saved lists, later).
