# Banana frontend

Responsive grocery discovery app for Vancouver. Home shows nearby discounts;
Search items supports text search, category, store, distance, discounts-only,
and price/distance/discount sorting. Offer previews show sample price details
and link to the retailer's website.

## Run locally

Use Node.js 24 and npm 11 or newer. From the repository root:

```sh
cd frontend
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Stop with Ctrl+C. If the port is already in use,
reuse the existing preview or run `npm run dev -- --port 5174`.

```sh
npm run check    # TypeScript, lint, formatting
npm test         # catalogue filtering and comparison tests
npm run build    # production build in dist/
npm run preview  # local production preview on port 4173
```

## Current data and interactions

All grocery prices, branches, addresses, and update timestamps come directly from
Supabase's `banana` schema. The current dataset includes simulated prices, which remain
labelled. Neighbourhood presets supply only the visitor's default search origin;
store distances are calculated from Supabase branch coordinates.

The Home search opens the catalogue. Search and filters are encoded in the URL for
shareable views; Back/Forward restores filter states. Mobile has bottom navigation,
a filter dialog, and offer details. No account is required. View offer opens the
actual database-backed record. Missing source/flyer URLs and other fields are labelled,
not filled with mock values. Local images and logos are visual assets only.

## Source layout

- `src/App.tsx`: page composition and selected offer state.
- `src/features/`: Home, Search items, and Locations screens.
- `src/components/`: navigation, search, controls, offers, and dialogs.
- `src/api/supabaseCatalogue.ts`: read-only database client, conversion and diagnostics.
- `src/data/CatalogueContext.tsx`: shared loading, error and refresh state.
- `src/data/mockOffers.ts`: legacy fixtures for pure catalogue tests; not displayed by the app.
- `src/lib/catalogue.ts`: pure search/filter/sort logic.
- `src/lib/navigation.ts`: URL state and hash navigation.
- `src/index.css`: font imports and tokens; `src/App.css`: responsive styles.
- `public/images/`: production grocery and retailer assets.
- `tests/`: native Node catalogue tests; no test-framework dependency.
- `design/`: approved concepts, original assets, and prior presentation sources.

## Backend handoff

Frontend work stays inside `frontend/`. Backend teammates own ingestion, data quality,
and Supabase migrations/policies. Read [the direct Supabase handoff](docs/supabase-direct-handoff.md).
A custom Node read API is no longer required. Never include administrative keys or
other secrets in browser code or VITE variables.

## Design and tools

The selected Home design is `design/merged/home-v2.png`: style 06's calm upper
section and serif brand/headline, with style 01's product grid. Search uses
`design/merged/search-items-v1.png` with the same header and font hierarchy.
The frontend uses DM Serif Display, DM Sans, and Phosphor icons. Relevant
installed Codex skills cover frontend design, React, image generation, and
browser QA. They are local tools, not project runtime dependencies.

## Locations

The third page follows `design/locations/01-split-view.png`: stores beside a live
map on desktop, List/Map views on phones. Search an address explicitly, choose
one of BC Address Geocoder's matches, or tap **Use my location** to request browser
permission. Choose a 1, 3, 5 or 10 km straight-line radius. Selecting a list row
or map pin reveals chain offers; Browse items retains branch context in Search.

MapLibre and OpenFreeMap provide map rendering and tiles without a billing
account or API key. The BC geocoder's public endpoint was verified without a key
and with CORS on October 17, 2026; its access policy can change. Search runs only
on explicit submission, with cancellation and a timeout. The address is sent to
BC Address Geocoder, and Banana saves the chosen point in browser storage (`localStorage`) so it
persists across page reloads. Browser geolocation coordinates are
not sent to the geocoder. The map requests geographic tiles from OpenFreeMap.

Store records are loaded from Supabase through its radius RPC. Only branches of brands
with usable item prices are shown; same-brand branches share chain-wide offers. This
does not establish live inventory at an individual branch. Home and Search use distances
to these branch coordinates. A full reload retains the saved visitor origin.

- `src/api/addressSearch.ts`: replaceable public address-search client.
- `src/data/storeLocations.ts`: default neighbourhood centers, types and legacy test fixtures.
- `src/lib/locations.ts`: distance, radius geometry and brand-offer joins.
- `src/components/LocationsMap.tsx`: lazy-loaded MapLibre map and markers.
- `src/features/LocationsPage.tsx`: search, location sharing, store list and links.

The map bundle loads separately. A list remains available if map loading fails;
address errors and denied/unavailable location sharing offer manual-search
recovery. Only a browser-safe Supabase publishable key is configured; no paid map service is required.

## Direct Supabase connection

Copy `.env.example` to `.env.local`, set `VITE_SUPABASE_URL` and the browser-safe
`VITE_SUPABASE_PUBLISHABLE_KEY`, and restart `npm run dev`. Production builds need the same
values configured in Cloudflare Pages before building. Never use a service-role key,
secret key, or database connection string here.

The three pages read the `banana` schema directly. No local/backend Node server or Vite
API proxy is needed. Data refreshes on page reload or **Refresh data** in the readiness panel.
The panel and per-offer labels identify missing Supabase fields; there is no runtime mock
fallback. Local product images and logos are visual assets only.

For this initial demo, the adapter completely paginates a bounded catalogue snapshot
(200 rows per request, up to 5,000), and loads Metro Vancouver branches through the radius
RPC using a fixed public city point. Search and distance filtering use those Supabase
records locally, with origins rounded to two decimals for consistent approximate distances.
Replace this bootstrap with paginated database search before exceeding these limits.
See [the direct Supabase handoff](docs/supabase-direct-handoff.md) for contracts and gaps.

## Shopping-list basket comparison

My list keeps a store-independent request for each product/package and quantity, plus
an optional explicitly selected purchase basket. It merges identical packages added at
different chains, calculates full-basket costs using the current Supabase catalogue,
and keeps exact-package baskets separate from cheaper package/quantity alternatives.
Same-chain alternatives and split-store exact matches are included. Incomplete baskets
show missing items and are never ranked as complete low totals. Source prices saved in
old browser lists are not substituted for missing live catalogue prices.

Matching requires a canonical comparison group or a shared UPC; the documented shared
simulated SKU families also work for the current demo. Names alone do not establish a
match. Optional `comparison_group_id` metadata is read when the backend adds it; product
size, pack count, brand and UPC come from Supabase. Requested package specifications stay
preserved when selecting alternatives. Changing an alternative's actual picks invalidates
the old selection so the customer must review it again. Exact-chain choices survive quantity
changes while a complete exact basket remains available.

The comparison currently runs over the same bounded Supabase snapshot used by the pages,
not the broad-text `price_shopping_list` RPC, which cannot guarantee this matching contract.
The request and chosen basket are saved only in this browser, not synced to account lists.
See [the backend comparison handoff](docs/basket-comparison-handoff.md) for the proposed
canonical identities and server comparison RPC. No database migration is executed by the
frontend, and there is no local mock-price fallback.

## Phone app (installable web app)

Banana can be installed to a phone's home screen. It then opens full screen,
with its own icon, and still opens with no signal.

- Android (Chrome): an "Install app" button appears on phones, or use the
  browser menu → Install app.
- iPhone (Safari): Share → Add to Home Screen. A tip explains this on iPhones.
- `public/sw.js` (the service worker, a background script) saves the site's own
  files so it opens offline. It never stores Supabase, Stripe or other sites'
  responses. Pages always try the network first, so a new deploy shows on the
  next visit. It only runs in the built site (`npm run build`, then
  `npm run preview`), not in `npm run dev`.
- The last price catalogue that loaded is saved in the browser
  (`src/lib/offlineCatalogue.ts`). With no connection, the site shows it with a
  banner giving the time it was saved.
- Offline, signing in and saved lists don't work. Browsing saved prices and My
  list do.

Search and the Home page's nearby discounts come from the database function
`banana.search_offers`, so the website and any future phone app return the same
results in the same order (`src/lib/searchRequest.ts`, `src/data/offerSearch.ts`).
With no connection they fall back to searching the saved catalogue in the
browser. The basket comparison still runs in the browser for now.
