# Banana: direct Supabase handoff

October 17, 2026 · For backend teammates and their coding agents

## Decision

The frontend will call the **hosted Supabase Data API directly**, using the project URL and publishable key. Visitor reads will not depend on the custom Node Banana API, `DATABASE_URL`, or a teammate's computer staying online.

This supersedes the separate-API connection and hosting directions in the earlier handoffs. Keep your ingestion and normalization code: the backend team still owns daily updates, data consistency, migrations, and access policies. Custom API hosting and CORS work are no longer prerequisites for the website.

## Confirmed facts and remaining verification

- Project: `wkqxnxjsvrnnpikibrfh`; URL: `https://wkqxnxjsvrnnpikibrfh.supabase.co`.
- The dashboard currently lists `banana.chains`, `banana.products`, `banana.prices`, `banana.store_locations`, `banana.shopping_lists`, and `banana.shopping_list_items`, with Data API exposure indicators.
- Use **`banana`**, as specified in your backend handoff. The older `public.grocery_items` and `public.store_branches` are placeholders, not the intended source.
- The checked-in `backend/sql/supabase-setup.sql` supplies the column and RPC definitions below. Please confirm the deployed definitions match.
- Your handoff reports 283 simulated offers, 37 simulated branches, and five chains. Those counts passed the local in-memory API test; live database counts have not been independently verified.
- Administrator dashboard visibility does **not** prove anonymous browser access. Publishable-key reads, relationships, RLS and RPC execution still need verification.
- No live database data, schema, or access policies were changed to prepare this document.

## Backend team's first tasks

1. Confirm `banana` is the canonical dataset and report any column differences.
2. Verify anonymous read-only Data API access to the four catalogue tables below. The dashboard already indicates exposure; verify before changing settings.
3. Verify foreign-key embedding works for `prices → products → chains`.
4. Verify the existing `banana.stores_within_radius` function works through POST RPC and returns numeric coordinates and distances.
5. Verify visitors cannot insert, update or delete catalogue rows, and cannot read other users' shopping lists.
6. Reply with results and remaining data gaps. Do not send database passwords or administrative keys.

Do not expose `raw`, disable RLS, grant visitor writes, or rerun the full setup script against an existing database. Use targeted reviewed migrations if needed. Avoid broad grants on every table in `banana`: this schema also contains private user-list tables.

## Initial data contract — reuse existing tables

No new table or view is required merely to begin. The frontend will isolate these reads in a dedicated adapter.

| Source                   | Fields needed                                                                                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `banana.chains`          | `slug`, `name`, `parent_company`, `has_member_pricing`; website URL optional if added later                                                                                   |
| `banana.products`        | `id`, `chain_slug`, `sku`, `name`, `size`, `category`, `pack_count`, `priced_by_weight`, `size_amount`, `size_unit`, `size_kind`, `size_total_base`                           |
| `banana.prices`          | `id`, `product_id`, `location_id`, `regular_price_cents`, `sale_price_cents`, `sale_start`, `sale_end`, `scraped_at`; optional `unit_price_cents`, `unit_label`, `source_url` |
| `banana.store_locations` | `id`, `chain_slug`, `name`, `address`, `city`, `postal_code`, `location`; numeric coordinates supplied by the radius RPC                                                      |

Relationships: `prices.product_id → products.id`; `products.chain_slug → chains.slug`; `store_locations.chain_slug → chains.slug`.

- Stable offer identity: `chain_slug + ':' + sku`. Preserve IDs across daily updates.
- Money: whole **CAD cents**. Convert 349 to $3.49 exactly once in the frontend adapter.
- Five canonical chains: `save-on-foods`, `walmart`, `costco`, `no-frills`, `real-canadian-superstore`. Frontend maps its old `superstore` links centrally.
- Categories: `fruits`, `vegetables`, `meat`, `seafood`, `dairy-eggs`, `bakery`, `frozen`, `beverages`, `snacks`, `pantry`, `household`, `other`.
- Initial prices are chain-wide (`prices.location_id IS NULL`). Branch-specific pricing is outside this release; tell us before changing that assumption.

## Example Data API reads

These requests follow the checked-in schema; they are **not yet verified successful against the live publishable-key API**. The key placeholder means the browser-safe publishable key, never a secret/service-role key.

```http
GET https://wkqxnxjsvrnnpikibrfh.supabase.co/rest/v1/chains?select=slug,name,parent_company,has_member_pricing&order=name
apikey: <PUBLISHABLE_KEY>
Accept-Profile: banana
```

```http
GET https://wkqxnxjsvrnnpikibrfh.supabase.co/rest/v1/prices?select=id,product_id,location_id,regular_price_cents,sale_price_cents,sale_start,sale_end,scraped_at,products!inner(id,chain_slug,sku,name,size,category,pack_count,priced_by_weight,size_amount,size_unit,size_kind,size_total_base)&location_id=is.null&order=id&limit=20
apikey: <PUBLISHABLE_KEY>
Accept-Profile: banana
Prefer: count=exact
```

Use explicit fields and pagination, with deterministic ordering. Do not silently stop at the default row cap or download an unlimited catalogue. Product/category/chain filters can use embedded product fields. Search across multiple joined fields and sorting by a computed effective sale price may need an additional read-only SQL RPC; agree its contract if needed rather than moving an ever-growing dataset into the browser.

### Nearby stores: existing RPC

```http
POST https://wkqxnxjsvrnnpikibrfh.supabase.co/rest/v1/rpc/stores_within_radius
apikey: <PUBLISHABLE_KEY>
Content-Profile: banana
Content-Type: application/json

{"user_lat":49.26,"user_lng":-123.10,"radius_km":5}
```

Expected rows: `id`, `chain_slug`, `name`, `address`, `city`, `postal_code`, `lat`, `lng`, `distance_km`, nearest first. The existing SQL uses PostGIS and invoker permissions. Verify explicit execution grants and table read policies; do not bypass access errors by switching to unrestricted privileged execution.

Show only branches whose chains have usable item prices, through RPC filtering or frontend filtering initially. Keep coordinates in the POST body, not the URL. Initially preserve the earlier handoff's two-decimal rounding before transmission and keep the user's origin in frontend memory. Radius boundaries are approximate, especially at 1 km. Do not persist visitor addresses or locations in catalogue tables; avoid logging location request bodies and verify logging behavior rather than claiming requests are never logged.

## Page behavior

**Home:** use active discounts from Supabase. A sale must be lower than regular price and within supplied start/end dates. Never invent discounts or extend expired simulated sales. If there are no active discounts, show an honest empty state or clearly labelled regular-price groceries. Show actual `scraped_at` timestamps.

**Search items:** support query, category, chain, radius, sale filter, sorting and pagination. Use the same effective-price rule everywhere. Compare units only when pack, quantity and units are sufficient; otherwise omit unit pricing. Unknown categories must not break the page.

**Locations:** show only supported chains with item-price data. Each branch has its own location/address; branches of the same chain share the same offers. Selecting a branch changes its distance and location context, not the brand catalogue.

## Incomplete data and images

- Images remain in the frontend, mapped by SKU. No backend image storage or uploads needed. Use a neutral placeholder when a matching local image is absent.
- Missing price: omit the offer, never convert null to $0.
- Missing address: show the available branch/area label, never invent a street address.
- Missing coordinates: omit pin/distance, never substitute an arbitrary point.
- Missing original price, expiry, unit data or website: omit that UI detail.
- Keep simulated prices and branch locations clearly labelled simulated.
- Loading, no matches, and permission/network failures are distinct states. Never silently replace a failed Supabase request with mock prices.

## Access and configuration

Frontend configuration will use `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or a documented legacy anon equivalent). These values are browser-visible by design. Grants and RLS enforce access.

Never put `DATABASE_URL`, database passwords, service-role keys, `sb_secret_...`, or ingestion credentials in frontend files or VITE variables. The daily-update process keeps its private configuration separately.

Public catalogue reads need no login. Accounts and saved lists are outside this change: preserve owner-only access to private user data. Any later views must have reviewed privilege behavior, using invoker security where appropriate, rather than accidentally bypassing RLS.

## Backend migration plan requested: move beyond local-only operation

Please plan and implement Supabase as the shared source of truth, rather than keeping required app data or request-time logic only in local files, in-memory repositories, or a developer's Node server.

- Inventory what currently exists only locally: seed/demo groceries, prices, chains, branches, search calculations, and update jobs. Report what is already in Supabase and what still needs moving.
- Load any required simulated/demo dataset into Supabase through a repeatable, non-destructive seed or upsert process. Preserve stable IDs, label simulated records, and do not overwrite real data accidentally.
- Move database-side filtering, joins, effective-price sorting, and nearby-store calculations needed by the app into suitable Supabase queries, views, or read-only SQL RPCs. Use Supabase Edge Functions only where server-side code is actually needed. Do not require the browser to call a locally running server.
- Plan unattended daily updates using suitable hosted scheduling/execution within the project's free-service constraint. Supabase should store the results; collection scripts may need a separate free hosted runner if their runtime does not fit Supabase. Identify service limits and unresolved hosting choices instead of assuming every existing script can run inside Supabase.
- Keep ingestion secrets in the hosted job/function's private configuration. Never move those secrets into frontend code.
- Keep local fixtures and offline development optional. The shared deployed app must continue reading its Supabase dataset when every teammate's computer is off; scheduled updates must also run independently once their hosted setup is complete.
- Keep grocery images in the frontend as agreed; this migration does not request Supabase image storage.

Return a short migration plan listing each remaining local dependency, its hosted destination, required migration/configuration, owner, and validation step. Prioritize getting the existing demo data readable by the frontend first, then move the remaining logic and scheduled updates incrementally. Do not delete local tooling until its replacement is verified.

## Acceptance checklist

- Publishable-key reads work for chains and paginated products/prices in `banana`.
- Same product at different chains yields separate stable offers.
- Prices convert correctly from cents; supplied sale dates and timestamps are respected.
- Radius RPC returns usable coordinates/distances; unsupported chains are excluded.
- Same-chain branches share offers for this release.
- Missing values stay missing and simulated data stays labelled.
- Visitors cannot modify catalogue rows or read private lists.
- A database change appears after frontend refresh without a teammate's computer or Node API running.

## Ownership and response requested

**Frontend:** Supabase adapter, local images, three-page wiring, UI filters, loading/error/empty states, incomplete-data handling and frontend tests. Repository changes remain in `frontend/`.

**Backend:** canonical data, stable IDs, daily ingestion, database consistency, reviewed migrations, read permissions, radius RPC and any agreed SQL search functions. No custom read-API hosting or image work needed for this approach.

Please return: canonical schema confirmation, column differences, publishable-key read/RPC verification, remaining data gaps, and the migration plan for local-only data, logic, and scheduled jobs. Work can proceed in parallel; perfect data is not required before integration begins.

## Frontend integration update

The frontend now reads the `banana` catalogue directly with the publishable key. Chain reads, product/price joins, and the radius RPC succeeded against the live project. No database permissions or records were changed.

The running website shows a Supabase data-readiness panel and per-offer missing-field labels based on database responses. Store website links must come from `chains.website_url` when available; the frontend no longer supplies hardcoded website URLs. Product images and brand logos remain frontend visual assets as agreed. There is no runtime local-data mode or automatic mock fallback.

Initial integration uses a bounded, fully paginated catalogue snapshot (200 rows per request, maximum 5,000), and the existing radius RPC to load Metro Vancouver branches within 150 km of a fixed public city point. Search/sort/radius filtering then run locally over those **Supabase-sourced** records. Visitors' origins remain in browser memory; no visitor coordinates are sent during this bootstrap. Missing or invalid prices/coordinates are excluded and reported. This is a demo integration, not the final scalable search architecture: replace the snapshot with agreed paginated SQL search/RPCs before the catalogue grows past the guardrail; the frontend fails explicitly rather than silently truncating. Keep RPC output within its configured response cap; add paged branch queries when expanding beyond the current region.

Please add actual flyer/source URLs to `prices.source_url` and store websites to `chains.website_url` when ready. The initial live response contained 283 offers and 38 supported branches; counts can change as the team updates data. All 283 initial price rows lacked source URLs, and the initial five chain records lacked website URLs. These are displayed as backend gaps, never filled with invented links.
