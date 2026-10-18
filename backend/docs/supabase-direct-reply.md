# Banana: backend reply to the direct Supabase handoff

Reply to "Banana: direct Supabase handoff" (October 17, 2026). The frontend reads Supabase directly
with the publishable key; this answers the backend tasks, verification and migration plan it asked for.

## Summary

- **`banana` is the canonical dataset.** `public.grocery_items` / `public.store_branches` are placeholders.
- **Verified live with the publishable key (read-only):** catalogue reads, embedding, the radius RPC,
  and that visitors cannot write or read saved lists. Results below.
- **New migration** [`sql/migrations/002_browser_reads.sql`](../sql/migrations/002_browser_reads.sql) adds what
  plain table reads can't do well: `search_offers` (search, filters, effective-price sorting, distance, paging) and
  `price_shopping_list` (basket per chain), plus `lat`/`lng` columns on stores and `website_url` on chains.
  It only adds; nothing is deleted or opened up. Tested against the same data: for 15 different searches it
  returns exactly the same rows, prices, discounts, distances and unit prices as the backend's tested search code.
- **Status of the migration:** in a pull request. It is applied to Supabase only after it is merged
  (GitHub first, then Supabase). Until then, use the table reads and the existing radius RPC.
- **Daily updates:** a free GitHub Actions job (`.github/workflows/daily-ingest.yml`) runs the ingest against
  Supabase every morning. It needs one repository secret, `DATABASE_URL`, added by the project owner.

## Current live data (verified October 17, 2026)

| Table | Rows | Notes |
|---|---|---|
| `banana.chains` | 5 | `save-on-foods`, `walmart`, `costco`, `no-frills`, `real-canadian-superstore` |
| `banana.products` | 283 | simulated, stable `chain:sku` ids |
| `banana.prices` | 283 | all chain-wide (`location_id` null), whole CAD cents |
| `banana.store_locations` | **38** | **real branches** from the frontend's `storeLocations.ts`, same ids (not 37 simulated ones as the handoff says) |
| `banana.shopping_lists`, `banana.shopping_list_items` | 0 | private, owner-only |

Simulated sales run Oct 16 to Oct 22, 2026 (Costco to Nov 1). After those dates there are no active
discounts: show the empty state. Nothing extends them.

## Verification with the publishable key (live, read-only)

| Check | Result |
|---|---|
| Read `chains` | ✅ 5 rows |
| Read `prices` with `products!inner(...)` and `products(chains(name))` embedded, `Prefer: count=exact` | ✅ `content-range: 0-1/283` |
| Read `store_locations` | ✅ 38 rows; `location` comes back as hex WKB, so use the new `lat`/`lng` columns (after the migration) or the RPC |
| `POST rpc/stores_within_radius` | ✅ numeric `lat`, `lng`, `distance_km`, nearest first |
| Insert / update / delete catalogue rows | ✅ refused: `permission denied` (401); data unchanged |
| Read or create `shopping_lists` | ✅ refused: `permission denied` |
| Read `raw` (private per-store data) | ✅ refused: `permission denied for schema raw` |

**One setting to review:** `raw` is listed under Project Settings > API > Exposed schemas. It is still locked
(no grants to visitors), but the handoff asks that it not be exposed. Removing it is a dashboard setting, left
for the project owner to decide. Note that a separate scraper script that writes `raw` through the Data API
would stop working if it is removed; the backend's own ingest connects directly and is not affected.

## Schema confirmation and differences

The deployed tables match `backend/sql/supabase-setup.sql`. Differences from the handoff's field list:

- `store_locations.location` is PostGIS `geography`; REST returns it encoded. **Migration 002 adds `lat` and `lng`**
  (generated from `location`, always in step).
- `chains.website_url` does not exist yet. **Migration 002 adds it** and fills the five websites.
- `products` also has `brand`, `upc`, `store_categories`, `image_url` (empty); `prices` also has
  `member_price_cents`, `unit_price_cents`, `unit_label`, `source_url` (empty for simulated data).

## How the website reads (after migration 002)

All requests send `apikey: <PUBLISHABLE_KEY>` and use `Accept-Profile: banana` (GET) or
`Content-Profile: banana` (POST). Location only ever goes in a POST body, rounded to 2 decimals.

### Search items, Home discounts, branch "Browse items": `rpc/search_offers`

```http
POST https://wkqxnxjsvrnnpikibrfh.supabase.co/rest/v1/rpc/search_offers
apikey: <PUBLISHABLE_KEY>
Content-Profile: banana
Content-Type: application/json

{ "p_query": "milk", "p_categories": ["dairy-eggs"], "p_chain_slugs": ["no-frills"],
  "p_near_lat": 49.26, "p_near_lng": -123.11, "p_radius_km": 5,
  "p_on_sale_only": false, "p_sort_by": "price", "p_sort_order": "asc",
  "p_limit": 20, "p_offset": 0 }
```

Every parameter is optional. Also: `p_parent_companies`, `p_location_ids` (a picked branch: that chain's
offers), `p_member` (member prices), `p_as_of` (a date; default today in Vancouver).

| Your need | Parameters |
|---|---|
| Home "Nearby discounts" | `p_near_*`, `p_radius_km`, `p_on_sale_only: true`, `p_sort_by: "discount"`, `p_limit: 4` |
| Sort "Featured" / "Recommended" | `p_sort_by: "discount"` |
| Price low→high / high→low | `p_sort_by: "price"`, `p_sort_order: "asc"` / `"desc"` |
| Distance | `p_sort_by: "distance"` (needs `p_near_*`; otherwise falls back to price) |
| Branch "Browse items" | `p_location_ids: ["nofrills-joti"]` |

Each row: `id` (`chain:sku`), `chain_slug`, `chain_name`, `sku`, `name`, `size`, `category`,
`price_cents` (what the shopper pays today), `regular_price_cents`, `discount_cents`/`discount_percent`
(only when discounted), `sale_price_cents`/`sale_start`/`sale_end` (only while the sale is active),
`unit_per` (`100g`, `100ml`, `each`) and `unit_cents` (only when the size is understood), `distance_km`
(only with a location; to the chain's nearest branch in range, 0.1 km), `scraped_at`, and `total_count`
(matches before paging, for "N offers").

Rules: the effective price is the sale price only if it is below the regular price and today is within
the sale dates; text search needs every word in the name, brand, size or store name (case and accents
ignored); limit 1 to 100; radius up to 10 km; distances are straight-line.

### Locations: `rpc/stores_within_radius` (unchanged contract)

```http
POST https://wkqxnxjsvrnnpikibrfh.supabase.co/rest/v1/rpc/stores_within_radius
Content-Profile: banana
Content-Type: application/json

{ "user_lat": 49.26, "user_lng": -123.10, "radius_km": 5 }
```

After migration 002: straight-line distance (the same formula as search, so a branch shows the same km on
every page), and only chains that have prices.

Map pins for every branch: `GET /rest/v1/store_locations?select=id,chain_slug,name,address,city,postal_code,lat,lng&order=id`.

### Shopping list: `rpc/price_shopping_list`

```http
POST https://wkqxnxjsvrnnpikibrfh.supabase.co/rest/v1/rpc/price_shopping_list
Content-Profile: banana
Content-Type: application/json

{ "p_items": [
    { "query": "milk", "amount": { "value": 2, "unit": "l" } },
    { "query": "bananas", "quantity": 2 },
    { "itemId": "walmart:sim-gala-apples" } ],
  "p_near_lat": 49.26, "p_near_lng": -123.11, "p_radius_km": 5 }
```

Each entry is a search (`query`, optional `categories`) or one exact `itemId`, with a `quantity`
(1 to 99) **or** an `amount` in `g`, `kg`, `lb`, `oz`, `ml`, `l`, `fl oz` or `ct`. With an amount, a match
costs enough whole packs to cover it (or the exact weight for items priced per lb/kg), and sizes that can't
cover it are left out. Returns:

- `entries`: per entry, the cheapest `matches` (each with `line_cents` and `packs`) and `total`.
- `chains`: buying everything at one chain: `totalCents`, `itemsFound`, `missingIndexes`, `picks`, and
  `nearestStore` `{ id, name, distanceKm }`. Fewest missing items first, then cheapest.
- `cheapestMix`: the cheapest pick for each entry across chains (splitting the trip).

This replaces the shopping-list script that read Supabase with the service-role key: no key beyond the
publishable one is needed, and matching works across chains by search term rather than exact sku.

## Remaining data gaps

- Prices, discounts and dates are **simulated** (label them). Real collection is not set up; the store
  sites' terms and bot checks need a team decision first.
- No images, flyer links (`source_url`) or branch phone numbers in the database.
- Member prices: chains have none in the simulated data, so `p_member` changes nothing yet.

## Migration plan: what still depends on a laptop

| Local dependency | Hosted destination | What's needed | Owner | How to check |
|---|---|---|---|---|
| Catalogue data (chains, products, prices, stores) | Supabase `banana` | Done | Backend | Publishable-key reads above |
| Search, filters, effective-price sort, distance | Supabase RPC `search_offers` | Merge the PR, then run migration 002 in the SQL Editor | Backend (run), owner (merge) | Same results as the backend search (tests); a publishable-key call |
| Nearby stores | Supabase RPC `stores_within_radius` | Updated by migration 002 | Backend | RPC call returns only chains with prices |
| Shopping-list totals | Supabase RPC `price_shopping_list` | Migration 002 | Backend | RPC call with an amount entry |
| Daily data update | GitHub Actions, daily 6 AM Vancouver | Add `DATABASE_URL` as a repository secret | Project owner | Actions tab: a green run; `scraped_at` moves forward |
| Real price collection | Not decided | Terms review per store; then plug into the same ingest | Team | — |
| Custom Node API / Cloudflare Worker `banana-api` | Not needed by the website any more | Keep for local tools, or remove later | Team | — |
| Saved lists API (`/api/lists`) | Supabase tables `shopping_lists`, `shopping_list_items` with owner-only RLS | Already in Supabase; the website can use them directly once sign-in exists | Frontend | A signed-in user sees only their lists |

Local tooling (in-memory mode, `npm run api`, tests) stays for offline development.
