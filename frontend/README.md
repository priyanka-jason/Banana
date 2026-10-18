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

All offers, distances, and update timestamps are labelled sample data. The
catalogue has eight sample offers across four grocers, including regular and
sale prices. It uses a fixed October 17, 2026 sample update, not a live daily
feed. Neighbourhood presets change the illustrative distances.

The Home search opens the catalogue. Search and filters are encoded in the URL
for shareable views; Back/Forward restores filter states. Mobile has bottom
navigation, a filter dialog, and touch-friendly offer details. No account is
required. The View flyer action opens a clearly labelled sample offer preview;
actual flyer documents and live availability are not connected yet.

## Source layout

- `src/App.tsx`: page composition and selected offer state.
- `src/features/`: Home and Search items screens.
- `src/components/`: navigation, search, controls, offers, and dialogs.
- `src/data/mockOffers.ts`: the complete illustrative catalogue and stores.
- `src/lib/catalogue.ts`: pure search/filter/sort logic.
- `src/lib/navigation.ts`: URL state and hash navigation.
- `src/index.css`: font imports and tokens; `src/App.css`: responsive styles.
- `public/images/`: production grocery and retailer assets.
- `tests/`: native Node catalogue tests; no test-framework dependency.
- `design/`: approved concepts, original assets, and prior presentation sources.

## Backend handoff

Frontend work stays inside `frontend/`. The backend team can work independently
elsewhere. Supabase is planned but is not configured or called by this prototype.
Agree on the product/store/offer schema, coordinates, unit-price normalization,
expiry, last-checked timestamps, and source/flyer URLs before integration.
Replace the mock catalogue through a dedicated data client once that contract
is ready; keep filtering behavior covered by the existing tests.

For a separate local HTTP API, copy `.env.example` to `.env.local`, set
`API_PROXY_TARGET`, and restart Vite. Requests to `/api/...` retain their path
when forwarded. This is a development proxy; production needs an agreed API
origin or reverse proxy. Never include service-role keys or other secrets in
browser code or VITE_* variables.

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
BC Address Geocoder, but Banana keeps the chosen point only in page memory; it
is not persisted or included in share URLs. Browser geolocation coordinates are
not sent to the geocoder. The map requests geographic tiles from OpenFreeMap.

The three branch points are **illustrative**, not verified physical branches.
The map and address lookup are live, while the store records and catalogue remain
mock data. Only branches linked to a known brand with offers are displayed.
Branches of the same brand share offers. These offers do not establish inventory
or pricing at an individual branch. When an origin has been chosen, Home and
Search use geographic distances to the supported branches instead of the older
neighbourhood sample distances. A full reload resets the temporary origin.

- `src/api/addressSearch.ts`: replaceable public address-search client.
- `src/data/mockLocations.ts`: branch records and neighbourhood centers.
- `src/lib/locations.ts`: distance, radius geometry and brand-offer joins.
- `src/components/LocationsMap.tsx`: lazy-loaded MapLibre map and markers.
- `src/features/LocationsPage.tsx`: search, location sharing, store list and links.

The map bundle loads separately. A list remains available if map loading fails;
address errors and denied/unavailable location sharing offer manual-search
recovery. No Supabase credentials or paid map service has been added.
