# Banana: backend handoff to the frontend

Reply to the frontend handoff of October 17, 2026.

## In one paragraph

The backend API reads groceries, prices and stores from **Supabase** (the `banana` schema) and
runs online as a **Cloudflare Worker** next to the website, so `banana-8qk.pages.dev` can call it.
It serves **your 38 real store locations** (from `frontend/src/data/storeLocations.ts`, same ids),
with simulated prices. A ready-made connector, [`backend/src/client/bananaApi.ts`](../src/client/bananaApi.ts),
calls the API and returns your shapes (offers, stores, branches). Copy it into the frontend and
swap the mock imports for its calls. Use the `banana` tables, not `public.grocery_items` /
`public.store_branches`: those were a placeholder.

## What the frontend needs to do

1. **Copy** `backend/src/client/bananaApi.ts` to `frontend/src/api/bananaApi.ts`. It is
   self-contained: no backend imports, no secrets.
2. **Create it once** with the API's address from a build setting:

   ```ts
   import { createBananaApi } from './api/bananaApi'
   export const api = createBananaApi({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? '' })
   ```
3. **Replace the mock reads** with its calls (table below), and add loading and error states
   (it throws `BananaApiError`, whose `message` is safe to show).
4. **Live site:** in Cloudflare Pages > `banana` > Settings > Variables, add
   `VITE_API_BASE_URL = https://banana-api.bananateam907.workers.dev` (the Worker's address, see
   "Live site"), then redeploy. Locally, leave it unset and run the site with
   `API_PROXY_TARGET=http://127.0.0.1:8787` (your Vite proxy already forwards `/api`).

## Which call replaces which mock

| Website piece | Today (mock) | Connector call |
|---|---|---|
| Home, "Nearby discounts" | `getNearbyOffers` + `featured` | `api.searchOffers({ origin, radiusKm, discountsOnly: true, sort: 'featured', limit: 4 })` |
| Search page: text, category, store, radius, discounts only, sort, paging | `getNearbyOffers` + `filterOffers` | `api.searchOffers({ query, category, store, discountsOnly, sort, origin, radiusKm, limit, offset })`; `total` is the count for "N offers" |
| A branch picked on Locations, "Browse items" | `branchId` | `api.searchOffers({ branchId })` |
| Locations: stores near an address or "Use my location" | `nearbyBranches` | `api.nearbyBranches(origin, radiusKm)`: nearest first, with `distance` |
| Map pins for every store | `branches` | `api.allBranches()` |
| Store filter | `stores` | `api.stores()`: ids `save-on-foods`, `no-frills`, `walmart`, `superstore`, `costco`, plus `website`. Keep your logos keyed by id |
| Category filter | Produce / Dairy / Eggs | `api.categories()`: send `slug`, show `label` (12 categories) |
| Neighbourhood picker, address search, browser location, map drawing | your code | unchanged: pass the chosen point as `origin` |

`origin` is `{ latitude, longitude }`, the same as your `SearchOrigin`. The connector rounds it to
2 decimals and only ever sends it in a POST body.

Sorts: `featured` and `recommended` = best deals first; `price`; `price-desc`; `distance` (needs an
origin; otherwise falls back to price); `discount`.

## What comes back

An offer (`BananaOffer`), shaped like your `Offer`:

| Field | Example | Notes |
|---|---|---|
| `id` | `save-on-foods:sim-gala-apples` | stable |
| `productKey` | `sim-gala-apples` | the same product at every chain: key your images on it, fall back to a category image |
| `name`, `pack` | `Gala Apples`, `2.27 kg` | |
| `category` | `fruits` | a slug; label from `api.categories()` |
| `price` | `3.49` | dollars |
| `regularPrice` | `4.99` | only when discounted, for the struck-out price |
| `unitPrice` | `$1.16/lb`, `$2.60/L`, `$0.80 each` | `""` when unknown |
| `storeId`, `storeName` | `superstore`, `Real Canadian Superstore` | your store ids |
| `distance` | `2.6` | km to the chain's nearest store in range; only with an origin or branch |
| `validUntil` | `2026-10-22` | only for discounts: "Valid until Oct 22, 2026" |
| `link` | | not in the data yet: use the store's `website` for "View flyer / View offer" |
| `updatedAt` | `2026-10-17T13:00:00.000Z` | 6:00 AM Vancouver: "Updated Oct 17, 2026, 6:00 AM" |

A branch (`BananaBranch`), shaped like your `StoreBranch`: `id`, `brandId`, `name`, `address`,
`city`, `postalCode`, `latitude`, `longitude`, and `distance` from `nearbyBranches`. Phone numbers
and Google place ids are not in the API yet; keep them from your file if you show them.

## The data

- **Stores:** your 38 real branches (Save-On-Foods 19, No Frills 7, Costco 4, Walmart 4,
  Superstore 4), same ids. Prices are chain-wide: every branch of a chain has its prices.
- **Prices: simulated.** 283 offers across the 5 chains. About 1 in 5 is a discount with an
  original price and an end date, because the design needs them ("Nearby discounts", struck-out
  prices, "Valid until", "Discounts only"). They will be replaced by real flyer data later.
  The page should keep saying "Sample prices".
- **No images or flyer links** in the API; those stay in the frontend for now.

## Live site

```
banana-8qk.pages.dev (Pages, built from frontend/setup)
        │  HTTPS, allowed by the API for this exact site (CORS)
        ▼
banana-api.bananateam907.workers.dev (Cloudflare Worker, backend/wrangler.toml)
        │  the Supabase connection string, stored as a Cloudflare secret
        ▼
Supabase, banana schema
```

- Same Cloudflare account as the website, free plan (100,000 requests a day).
- The API only answers browsers on `https://banana-8qk.pages.dev` (and local development through
  the proxy). Another site address needs adding to `CORS_ORIGINS` in `backend/wrangler.toml`.
- No key or login is needed for any of the calls above. Never put the Supabase connection
  string or the service role key in the frontend.

## Running the API locally

```sh
cd backend
npm install
npm run api            # http://127.0.0.1:8787/api
```

Without `DATABASE_URL` in `backend/.env` it serves the same data from memory, so frontend work
never needs a secret. With it (shared privately by the project owner), it reads Supabase.

## Errors

`BananaApiError` has `status`, `code` and a `message` that is safe to show:

| Status | Code | Meaning |
|---|---|---|
| 400 | `invalid_request` | a filter was wrong; `details` lists each field |
| 404 | `not_found` | no such endpoint or item |
| 500 | `internal_error` | something broke, including "the database is down". The API never falls back to fake data: show a retry |
| 503 | `unavailable` | the API isn't connected to its database yet |

## Your acceptance checklist

| Check | Result |
|---|---|
| Supabase mode reads without modifying data | ✅ |
| Empty, name and chain-filtered search | ✅ |
| One product at several chains gives separate stable offers | ✅ (`no-frills:sim-bananas`, `walmart:sim-bananas`, …) |
| Missing prices omitted; whole cents in the API, dollars from the connector | ✅ |
| Discounts, expiry dates | ⚠️ simulated on purpose (see "The data"); no images; `updatedAt` is the fixed simulated load time |
| Branches use matching chain ids and numeric coordinates | ✅ your ids, `superstore` mapped in the connector |
| Branches without prices excluded | ✅ all 5 chains have prices |
| Database down differs from an empty result | ✅ `500` vs `200` with `total: 0` |
| Tests and type checks pass | ✅ 497 backend tests, including the connector against the real API and the Worker build |
| No secrets in commits, responses, logs or frontend | ✅ |

## Open questions

1. Keep "Featured" = best deals first?
2. Should the API also carry phone numbers and Google place ids for branches?
3. Flyer and offer links: add them to the data later, or keep the store website for now?

More detail: [`api-contract.md`](api-contract.md) (every endpoint and field) and
[`accounts.md`](accounts.md) (optional sign-in and saved lists).
