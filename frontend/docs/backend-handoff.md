# Banana: backend handoff for frontend integration

Prepared October 17, 2026. Intended for the backend team and its coding agent.

## The task in one sentence

Make the existing backend API read the mock groceries and store branches already
in Supabase, so the frontend can replace its hard-coded sample data with API calls.

Keep the current API contract where possible. A Supabase key alone is not the
integration: we need working endpoints, predictable responses and run instructions.

## Decisions already made

- Grocery discovery, starting in Vancouver; desktop and phone layouts already exist.
- Mock prices are acceptable. They should be read from Supabase, not generated
  afresh in memory whenever the API starts.
- Product images stay in the frontend. No image storage, uploads or image URLs
  are required from the backend. Stable product IDs let us map local images;
  unknown products will use a category image or fallback.
- Each physical branch is a separate location. Branches of the same chain share
  the chain's product prices. Offers do not imply confirmed branch inventory.
- Locations shows only branches whose chain has item-price data.
- Distance means a straight-line radius, initially 1, 3, 5 or 10 km.
- Free services only. No paid account, upgrade or billing dependency is required.
- Missing discounts are fine. Do not invent sale prices, old prices or expiry dates.

## What already exists

### Repository

Repository: <https://github.com/priyanka-jason/Banana>

The following were inspected on `main` when this handoff was prepared:

- [Backend README](https://github.com/priyanka-jason/Banana/blob/main/backend/README.md)
- [Draft API contract](https://github.com/priyanka-jason/Banana/blob/main/backend/docs/api-contract.md)
- [API types](https://github.com/priyanka-jason/Banana/blob/main/backend/src/types.ts)
- [Backend composition](https://github.com/priyanka-jason/Banana/blob/main/backend/src/app.ts)
- [Repository interface](https://github.com/priyanka-jason/Banana/blob/main/backend/src/db/repository.ts)

The API handlers, validation, search and sample responses already exist. `app.ts`
currently builds `MemoryPriceRepository` and loads simulated/sample data. The
local server defaults to `http://127.0.0.1:8787`; it is not a deployed public API.

Recheck the current branch before implementing: another teammate may have made
progress since this inspection. Follow applicable repository instructions.

### Supabase

The Banana project inspected in the dashboard has project reference
`wkqxnxjsvrnnpikibrfh`. Do not put credentials in this document or commits.

The **actual tables differ from `backend/sql/draft-schema.sql`**. The dashboard
showed these two public tables and their definitions:

| Table                   | Relevant fields                                                                                                                                  | Observed data        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| `public.grocery_items`  | `id`, `item_name`, `category`, `unit`, `nofrills_price`, `superstore_price`, `walmart_price`, `saveonfoods_price`, `freshco_price`, `updated_at` | 38 grocery rows      |
| `public.store_branches` | `id`, `brand_id`, `name`, `address`, `latitude`, `longitude`, `created_at`                                                                       | 6 No Frills branches |

Grocery prices are `numeric(10,2)` dollar amounts; price columns can be null.
`updated_at` can also be null. Branch coordinates are non-null double precision.
Both tables were shown with RLS enabled and public SELECT policies listed. This
was a dashboard inspection, not a completed end-to-end API access test. Verify
read access using the intended backend credentials; do not weaken policies.

**Do not run the draft schema over these tables or replace their existing data.**
Start with a read-only adapter for the actual tables. Propose any necessary
schema/contract changes separately and get agreement before applying them.

## Milestone 1 — the minimum deliverable

Two existing endpoints must read Supabase successfully:

| Endpoint                  | Required behaviour                                                                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/prices/search` | Return grocery offers; support name search, chain filtering and the existing pagination envelope. Keep existing category/sort behaviour where supported.                    |
| `GET /api/stores`         | Return the Supabase branch records in the existing API shape, with stable IDs, chain IDs, addresses and coordinates. Exclude branches whose chain has no usable price data. |

Keep the existing `/api/health`, `/api/chains` and `/api/categories` endpoints
consistent with this data source so the frontend can populate its filters.
Do not introduce alternative endpoint names just for this integration.

Implementation direction:

1. Add a Supabase-backed read implementation behind `PriceRepository` (or a
   small adapter used by it), preserving handlers and response types where possible.
2. Wire that source into `createBackend()` using an explicit configuration option.
   Preserve the existing sample/in-memory mode for offline development and tests.
3. In Supabase mode, fetch existing records; do not overwrite them on startup.
   If Supabase fails, return the documented error rather than silently substituting
   generated prices and presenting them as database results.
4. Provide `.env.example` variable names, startup commands, examples and tests.
   Credentials come privately from the project owner and stay outside Git.

### Convert database rows into API offers

One grocery row can produce multiple chain offers. For example, a non-null
`nofrills_price` and a non-null `walmart_price` produce two offers for that product.
A missing price produces no offer for that chain; it is not a zero-dollar item.

| Supabase field                       | API mapping                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `grocery_items.id`                   | Stable `sku`, using its string value; retain the existing `chain:sku` ID convention, e.g. `no-frills:1` |
| `item_name`                          | `name`                                                                                                  |
| `category`                           | Map to the existing category slugs; do not expose a different category vocabulary without agreement     |
| `unit`                               | Preserve as display `size`; normalize units/pack details only when the meaning is known                 |
| Each non-null chain price            | `priceCents`, converted from dollars to integer cents with deliberate decimal handling                  |
| Same price, without sale information | `regularPriceCents` equal to `priceCents`; omit discount/sale fields                                    |
| `updated_at`                         | `scrapedAt`, documenting that this is the sample row's update time, not a verified scrape time          |
| No image field                       | Omit optional `imageUrl`; the frontend supplies mock images                                             |

For prices sold by weight, set the existing `pricedByWeight` and unit fields
correctly; do not present a per-kg price as a packaged-item price. Do not invent
comparable unit prices when the unit or size cannot be understood.

If a required API field cannot be populated honestly, report the gap and propose
a documented fallback or contract adjustment. In particular, do not label a row
fresh by using the request time when `updated_at` is missing. Chain metadata and
category mappings should be explicit and tested, not guessed from display names.

Use one canonical chain slug throughout. Expected mappings to confirm:

| Grocery price column | Canonical API chain slug   |
| -------------------- | -------------------------- |
| `nofrills_price`     | `no-frills`                |
| `superstore_price`   | `real-canadian-superstore` |
| `walmart_price`      | `walmart`                  |
| `saveonfoods_price`  | `save-on-foods`            |
| `freshco_price`      | `freshco`                  |

`freshco` may need adding to existing chain metadata. Do not map FreshCo prices
to Costco. Frontend aliases can be handled by the frontend integration adapter.

For branches, map `brand_id` to `chainSlug`, `latitude` to `lat`, and `longitude`
to `lng`. Preserve `id`, `name` and `address`. Confirm that `brand_id` agrees with
the same slug mapping above.

Currently only No Frills branch records were observed. Other chains' grocery
prices can still appear in an unrestricted catalogue, but do not invent branch
locations or distances for them. A nearby filter must exclude chains without a
known branch in range.

### Requests the frontend should be able to make

```sh
curl http://127.0.0.1:8787/api/health

curl -X POST http://127.0.0.1:8787/api/prices/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"milk","chainSlugs":["no-frills"],"limit":20,"offset":0}'

curl http://127.0.0.1:8787/api/stores
```

Keep the documented response envelopes: search returns
`{ "rows": [...], "total": 0, "limit": 20, "offset": 0 }`, with real values;
stores returns `{ "stores": [...] }`. Reuse `PriceRow` and `StoreLocation` from
the current backend types. Include example responses generated from the actual
adapter, not just the older in-memory fixtures.

## Milestone 2 — complete the Locations flow

After the first two endpoints work, connect the existing
`POST /api/stores/nearby` and the `near`/`locationIds` search filters to the same
Supabase-backed source. Reuse the existing geodesic distance logic if simplest;
PostGIS or a new database function is not required just for this small dataset.

- A visitor's selected address or permitted browser location supplies the origin.
- Return only branches inside the requested radius and with usable chain offers.
- All branches of a chain share prices; calculate distance for each branch.
- Selecting a branch filters items to that chain using its stable branch ID.
- Follow the current contract: location travels in POST JSON, not URL parameters;
  do not persist it or log request bodies. Location remains optional.
- The contract currently rounds visitor coordinates to two decimals. This can
  noticeably affect a 1 km boundary. Flag that accuracy tradeoff for the team
  before claiming precise address-level distances; do not silently change the
  contract or remove the privacy behaviour.

## Work that can wait

Live scraping, daily jobs, discount/expiry data, accounts, saved shopping lists,
price history, image storage, and a redesigned database schema are not requirements
for Milestone 1. Preserve existing endpoints/tests where possible, but do not
expand the project just to finish this integration.

Public API hosting is a separate step after local integration works. The live
Cloudflare frontend cannot call a student's localhost. Before a public release,
provide an HTTPS API URL and decide same-origin routing versus CORS for
`https://banana-8qk.pages.dev`. Do not buy services or expose an admin key.

## Acceptance checklist

- [ ] Supabase mode reads the existing two tables without modifying their data.
- [ ] An empty search, a name search and a chain-filtered search work.
- [ ] One product with prices at multiple chains returns separate stable offers.
- [ ] Null prices are omitted; dollar-to-cent conversion is correct.
- [ ] No fake discounts, expiry dates, images or freshness timestamps are added.
- [ ] Branches use matching chain IDs and numeric coordinates.
- [ ] Branches without item-price data are excluded from the store list.
- [ ] Errors distinguish an unavailable database from an empty result.
- [ ] Existing tests/type checks pass; adapter mapping/error cases have tests.
- [ ] No secret values appear in commits, responses, logs or frontend variables.
- [ ] Run instructions and request/response examples match the implemented mode.

Counts above are inspection snapshots, not hard-coded acceptance requirements.
A database read that returns zero rows is not proof that access is configured;
check against a known sample product and branch.

## What to send back to the frontend team

1. Branch/commit or PR containing the backend changes.
2. Exact install/start commands for Supabase mode and required environment
   variable **names**, with credentials shared separately by the owner.
3. Local API base URL and any authentication requirements. The existing contract
   currently describes public read-only endpoints; do not send an admin API key
   for use in the browser.
4. Working example requests and responses for grocery search and store locations.
5. Test results, missing fields, and any proposed contract/schema changes.

Frontend integration can then replace its mock reads with API calls. Images,
layout, loading/error states and presentation mapping stay with the frontend team.

## Copy-and-paste instruction for the backend agent

> Read this handoff, the repository's applicable instructions, backend README,
> API contract and types. Compare them with the current implementation before
> changing anything. Implement Milestone 1 using a read-only Supabase adapter and
> preserve existing endpoints where possible. Do not modify frontend files, replace
> Supabase tables/data, change access policies or commit secrets. Report contract
> gaps before making breaking changes. Finish with the delivery details and
> acceptance-check results requested above. Milestone 2 is the next increment,
> not a prerequisite for the first handoff.
