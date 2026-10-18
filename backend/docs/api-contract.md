# Banana API contract (draft)

**Status: draft, for the team to react to.** Nothing here is final. There is no web server yet. Each endpoint
below already exists as a plain function in [`src/api/handlers.ts`](../src/api/handlers.ts) that takes the request
body and returns a status plus a JSON body, so a server only has to wire routes to them.

All data behind it is still **made up** sample data.

## Sample requests and responses (use these as mocks)

[`docs/examples/`](examples/) has one JSON file per example, each with a description, the request, and the
response (status and body). Use `response.body` as mock data while the real server doesn't exist. The files are
produced by the real code, and a test fails if they drift. To refresh them after a change:

```sh
npm --prefix backend run examples
```

## Simulated Lower Mainland data (bigger mock set)

[`docs/simulated/`](simulated/) holds a larger **made-up** data set for the demo: Save-On-Foods, Walmart, Costco, No
Frills and Real Canadian Superstore, with 37 stores across Metro Vancouver. Each chain has its own per-store table,
and all five feed the one final layer this API reads. Prices, sales and store spots are invented; store spots are rough
neighbourhood centres, not real addresses. **Prices are chain-wide:** an item costs the same at every store of a
chain in the Lower Mainland, so rows have no `locationId`. Each file is the body an endpoint would send:
`chains.json`, `categories.json`, `stores.json`, and `prices.json` (every `PriceRow`, sorted by name). Regenerate with
`npm --prefix backend run simulate`, or load it through the pipeline with
`npm --prefix backend run ingest -- --simulated`.

## Ground rules

- **Base path** `/api`. JSON in and out (UTF-8). POST bodies are `Content-Type: application/json`.
- **Money is whole cents.** `priceCents: 547` means $5.47. To show it:
  `new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100)`.
  The exception is `comparableUnitPrice.cents`, which can have decimals (e.g. `15.21` cents per 100 g).
- **Dates** are ISO text: `"2026-10-22"` for a day, `"2026-10-17T20:00:00.000Z"` for a moment.
- **Item ids** look like `walmart:W-2002` (`chain:sku`). They are unique across stores and stay the same
  between scrapes. Treat them as plain text, and **URL-encode them in paths** with `encodeURIComponent`.
- **Missing optional fields are left out**, not sent as `null`.
- **No login yet.** Every endpoint is public and read-only.

### A visitor's location stays out of URLs

The website only gets a visitor's location if they click "Allow" in the browser, and they can say no. So:

- **Anything that carries a location is a `POST` with the location in the JSON body,** never in the URL or query
  string. URLs end up in server, proxy and browser logs; request bodies normally do not.
- **The site must work without it.** If the visitor says no, just don't send `near`. Pick stores or chains by hand.
- **Round before sending.** Radius search doesn't need more than about 1 km of precision, so round coordinates to
  2 decimal places (e.g. `49.28`, `-123.12`) in the browser.
- **The server must not store the location or log request bodies** for these endpoints. Error responses never
  repeat the coordinates back.

## Endpoints

| Method | Path | What it does | Example |
|---|---|---|---|
| POST | `/api/prices/search` | Search and filter prices | [`search-bananas.json`](examples/search-bananas.json) and others |
| GET | `/api/prices/{id}` | One item (`?memberPricing=member`) | [`get-item.json`](examples/get-item.json) |
| POST | `/api/prices/lookup` | Many items by id, for a saved shopping list | [`lookup-shopping-list.json`](examples/lookup-shopping-list.json) |
| POST | `/api/prices/list` | Price a whole shopping list in the chosen stores | [`shopping-list.json`](examples/shopping-list.json) |
| GET | `/api/chains` | All store chains | [`chains.json`](examples/chains.json) |
| GET | `/api/categories` | The shared categories | [`categories.json`](examples/categories.json) |
| GET | `/api/stores` | Physical stores for map markers (`?chain=walmart`, repeatable) | [`stores.json`](examples/stores.json) |
| POST | `/api/stores/nearby` | Stores near the visitor | [`stores-nearby.json`](examples/stores-nearby.json) |
| GET | `/api/health` | Is the API up | [`health.json`](examples/health.json) |

### `POST /api/prices/search`

Every field is optional. An empty body searches everything. Unknown fields are **rejected**, so a typo like
`chains` instead of `chainSlugs` is an error, not silently ignored.

| Field | Type | Meaning |
|---|---|---|
| `query` | text, up to 100 characters | Every word must appear in the item's name or brand, in any order. Ignores case and accents. Part of a word matches (`apple` finds `Apples`). |
| `chainSlugs` | list of text, up to 50 | Only these chains (e.g. `["walmart", "costco"]`). |
| `parentCompanies` | list of text, up to 50 | Only chains owned by these companies, ignoring case. |
| `categories` | list of category slugs | Only these shared categories. Slugs come from `/api/categories`. |
| `locationIds` | list of text, up to 50 | Stores picked on a map (ids from `/api/stores`). A chain's prices show if one of its stores is picked. |
| `near` | `{ lat, lng, radiusKm }` | Only chains with a store within `radiusKm` (more than 0, up to 200). Rows get `distanceKm`. See the location rules above. |
| `onSaleOnly` | true or false | Only items where the price you pay is below the original price. Depends on `memberPricing`. |
| `memberPricing` | `"member"` or `"non-member"` | Which price to work with. Default `"non-member"`. A member also gets the member price. |
| `sortBy` | see below | Default `"price"`. |
| `sortOrder` | `"asc"` or `"desc"` | Flips the direction of `sortBy`. Leave it out for the natural direction below. |
| `limit` | whole number, 1 to 100 | Page size. Default 50. |
| `offset` | whole number, 0 or more | How many results to skip. Default 0. |

An empty list (`[]`) means "don't filter on this", the same as leaving the field out.

`sortBy` options, each in its natural direction:

- `price`: cheapest first.
- `unitPrice`: cheapest per standard unit first. It only makes sense within one kind of item, like milk. Items with
  no unit price come last, and unit prices of different kinds (per 100 g, per 100 ml, each) are kept in separate groups.
- `name`: A to Z.
- `distance`: nearest first. Only allowed when `near` is given.
- `discount`: biggest percent off first. This is the "top deals" sort.

`sortOrder` turns any of these around: `"asc"` is low to high (cheapest, A to Z, nearest, smallest discount first)
and `"desc"` is high to low. Without it each sort uses its natural direction above, which is `"asc"` for all of them
except `discount`, where it is `"desc"`. So "most expensive first" is `{ "sortBy": "price", "sortOrder": "desc" }`.
`sortOrder` without `sortBy` applies to the default `price` sort.

Only the main value flips. Ties are always broken by price (cheapest first), then name (A to Z), then id, in both
directions, so the order is stable. Items with nothing to sort on stay last in both directions: no unit price for
`unitPrice`, not on sale for `discount`. Unit price groups (per 100 g, per 100 ml, each) also keep their order.

**Response** (`200`):

```json
{ "rows": [ /* PriceRow, see below */ ], "total": 12, "limit": 4, "offset": 4 }
```

`total` is how many items match before paging, so you can show "page 2 of 3".
Examples: [bananas](examples/search-bananas.json),
[members, best value](examples/search-milk-members-best-value.json),
[top deals](examples/search-top-deals.json),
[most expensive meat first](examples/search-meat-most-expensive-first.json),
[second page](examples/search-fruit-and-vegetables-page-2.json),
[near me](examples/search-near-me.json),
[picked stores](examples/search-picked-stores.json),
[within 5 km](examples/search-within-5km.json),
[one chain within 10 km](examples/search-within-10km-one-chain.json),
[an invalid request](examples/search-invalid.json).

### `GET /api/prices/{id}`

Optional `?memberPricing=member`. Response `200` is one `PriceRow`. `404` if the id doesn't exist (for example an
item a store stopped selling). The id contains a colon, so URL-encode it: `/api/prices/walmart%3AW-2002`.
Examples: [found](examples/get-item.json), [not found](examples/get-item-not-found.json).

### `POST /api/prices/lookup`

For a saved shopping list. Body: `{ "ids": ["walmart:W-2009", "costco:C-3009"], "memberPricing": "member" }`
(1 to 100 ids; `memberPricing` is optional). Response: `{ "rows": [...], "missingIds": [...] }`. Rows come back in
the order asked for. Ids that no longer exist are listed in `missingIds` instead of causing an error.
Example: [lookup-shopping-list.json](examples/lookup-shopping-list.json).

### `POST /api/prices/list`

Prices a whole shopping list at once, within the shopper's store choice. Body:

```json
{
  "items": [
    { "query": "milk", "quantity": 2 },
    { "query": "eggs", "categories": ["dairy-eggs"] },
    { "itemId": "walmart:W-2002" }
  ],
  "near": { "lat": 49.28, "lng": -123.12, "radiusKm": 10 },
  "chainSlugs": ["walmart", "costco"],
  "matchesPerItem": 5
}
```

| Field | Type | Meaning |
|---|---|---|
| `items` | list, 1 to 50 entries | **Required.** Each entry is either a search (`query`, optional `categories`), matched like the search `query`, or one exact item (`itemId`). Not both. |
| `items[].quantity` | whole number, 1 to 99 | Default 1. For an item priced by weight (`pricedByWeight`), it counts lb or kg. |
| `chainSlugs`, `parentCompanies`, `locationIds`, `near`, `memberPricing` | | The same as in a search. `storeSelectionFilters()` builds them. |
| `matchesPerItem` | whole number, 1 to 20 | How many matches to send back per entry. Default 5. |

**Response** (`200`):

- `entries`: one per list entry, in order: `{ index, quantity, matches: [PriceRow, cheapest first], total }`. `matches`
  is empty when nothing matches in the chosen stores.
- `chains`: buying everything at one chain: `{ chainSlug, chainName, totalCents, picks, missingIndexes, distanceKm? }`.
  `picks` holds that chain's cheapest match for each entry it has, as `{ index, row, lineCents }`, where `lineCents`
  is the price times the quantity. `missingIndexes` lists the entries it lacks. The chains with the most entries come
  first, then the cheapest. Only compare `totalCents` between chains with the same `missingIndexes`.
- `cheapestMix`: `{ totalCents, picks, missingIndexes }`, the cheapest match for each entry at any chain. This is the
  lowest total if the shopper splits the list between stores.

An `itemId` entry only counts for its own chain, so to compare an item across chains use a `query` entry.
Examples: [a list](examples/shopping-list.json), [within 10 km](examples/shopping-list-within-10km.json).

### `GET /api/chains`, `GET /api/categories`

`{ "chains": [{ slug, name, parentCompany, hasMemberPricing }] }` sorted by name, and
`{ "categories": [{ "slug": "dairy-eggs", "label": "Dairy & Eggs" }] }`. Send the `slug` in searches and show the
`label` to people.

### `GET /api/stores`, `POST /api/stores/nearby`

`GET /api/stores` returns `{ "stores": [{ id, chainSlug, name, address?, city?, postalCode?, lat, lng }] }` for map
markers. Add `?chain=walmart` (repeatable) to limit it. No visitor location is involved.

`POST /api/stores/nearby` takes `{ "lat": 49.28, "lng": -123.12, "radiusKm": 10 }` and returns the same stores plus
`distanceKm`, nearest first. Add `"chainSlugs": ["costco"]` to list only those chains' stores
([stores-nearby-one-chain.json](examples/stores-nearby-one-chain.json)).

### Choosing where to buy

The shopper picks one of three, and can also narrow any of them to some chains:

| Choice | Search fields | Where the store list comes from |
|---|---|---|
| Any store | none | |
| Specific stores | `locationIds` | `GET /api/stores` (map or list), or `POST /api/stores/nearby` |
| Any store within 5 km or 10 km | `near: { lat, lng, radiusKm }` | needs the browser's location |
| ...only these chains | `chainSlugs`, added to any of the above | `GET /api/chains` |

`backend/src/api/storeChoice.ts` does this conversion: `storeSelectionFilters(selection)` gives the store fields of
the search body, `nearbyStoresBody(...)` the body for `/api/stores/nearby`, and `STORE_RADIUS_OPTIONS_KM` the radius
choices (`[5, 10]`, default 5). It rounds the location to 2 decimals. It only imports types, so the website can import
or copy it. The API itself accepts any radius above 0 and up to 200 km.

All the filters apply together. Picked stores from a chain that is not chosen find nothing, so offer stores from the
chosen chains only. Prices are currently the same at every store of a chain, so a row stands for the chain;
`distanceKm` is the distance to that chain's nearest store in range.
Examples: [within 5 km](examples/search-within-5km.json),
[one chain within 10 km](examples/search-within-10km-one-chain.json),
[picked stores](examples/search-picked-stores.json).

## What a result row (`PriceRow`) means

| Field | Meaning |
|---|---|
| `id`, `chainSlug`, `chainName`, `parentCompany`, `sku`, `name`, `brand?`, `imageUrl?` | Who sells it and what it is. |
| `category?` | One of the shared categories. |
| `size?` | The size **as the store wrote it**, like `"2 x 4 L"`. Show this one to people. |
| `sizeAmount?`, `sizeUnit?` | The size as numbers, like `4` and `"l"`. Units: `g, kg, lb, oz, ml, l, fl oz, ct`. |
| `packCount` | How many packs are bundled: `2` for `"2 x 4 L"`, `1` for a single pack. |
| `pricedByWeight` | `true` when the price is per unit of weight (the size said "per lb" or "per kg"), so show it as "$/lb". |
| `priceCents` | **What the shopper pays.** Already works out sale and member prices. |
| `regularPriceCents` | The original price. |
| `discountCents?`, `discountPercent?` | How much cheaper `priceCents` is than the original, only when it is cheaper. |
| `salePriceCents?`, `memberPriceCents?`, `saleEnd?` | The sale and member prices behind `priceCents`, and when the sale ends. |
| `comparableUnitPrice?` | `priceCents` per **100 g**, **100 ml** or **each**: `{ "per": "100g", "cents": 15.21 }`. **Compare these across stores,** not the shelf prices. |
| `unitPriceCents?`, `unitLabel?` | The store's own unit price. Stores use different units, so don't compare these. |
| `distanceKm?` | Only with `near`: distance to that chain's nearest store, to a tenth of a km. |
| `scrapedAt` | When the price was last fetched. |

### Showing prices fairly

- Show **`priceCents`**. If `discountCents` is there, also show `regularPriceCents` crossed out and
  `-{discountPercent}%`.
- Compare stores with **`comparableUnitPrice`**. Stores price per kg, per lb, per 100 g or per roll, and bulk packs
  look cheaper per unit but cost more up front. Show both the shelf price and the unit price.
- When `packCount` is more than 1, say so ("2-pack") so nobody is surprised by a bigger bill.
- Some items have no size, so `comparableUnitPrice` can be missing.

## Errors

Every error has the same shape:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "The request has 2 problems.",
    "details": [{ "field": "near.lat", "message": "must be at least -90 and at most 90" }]
  }
}
```

| Status | `code` | When |
|---|---|---|
| `400` | `invalid_request` | The request is wrong. `details` lists **every** problem, each with the `field` (like `near.lat`; `(body)` means the whole body). Fix them all and resend. |
| `404` | `not_found` | `GET /api/prices/{id}` for an id that doesn't exist. |
| `500` | `internal_error` | Something broke on our side. The message is always the same plain text and never includes internal details. |

Error messages never repeat a coordinate that was sent.

## Not decided or not built yet

- **There is no server.** Someone needs to pick one (Express, Hono, a serverless function...), host it, and decide
  between a same-origin deploy and CORS. `frontend/` already expects `/api` through a Vite dev proxy.
- **Login and accounts**, saved shopping lists, and purchase history ("Records" on the whiteboard) are not in this contract.
- **Matching the same product across chains** is by search words only. Two chains' "2% milk 4 L" are not linked as
  the same product, so a `query` entry's cheapest match can be a different size or brand. Use `categories` or more
  specific words to narrow it.
- **Price history** is not stored.
- **Website vs flyer prices** are undecided. A `source` field may be added later.
- **A deeper type tree** (for example Meat, then Red meat, then Beef) is planned. Today `category` is one of 12
  shared categories.
- **Caching.** Because every search is a `POST`, browsers and CDNs don't cache them by default. If that becomes a
  problem, a cacheable `GET` could be offered for searches that carry no location.
- **Rate limiting** and abuse protection are not designed.

## Questions for the frontend team

1. Is a POST-only search fine for you? (It keeps locations out of URLs, at the cost of caching.)
2. Is rounding the coordinates to 2 decimals in the browser OK?
3. Are `limit` and `offset` paging what you want, or would you prefer "load more"?
4. Is any field you need missing from `PriceRow`?
