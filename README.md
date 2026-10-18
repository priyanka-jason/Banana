# 🍌 Banana

**Find the cheapest groceries near you, in one search.**

**Live site:** https://banana-8qk.pages.dev

Built for a hackathon.

---

## Project overview

We are fighting inflation. Food prices keep rising, and the cheapest store for one item is rarely the cheapest for the next. Comparing them means checking five flyers and five websites. Many families don't have time for that, and they're often the ones who need the savings most. Canadian families are overspending by 2.1% from choosing cheap items, whereas they can save up to 4.1% on average by buying discounted products ([Bank of Canada Working Paper 2024-31: Price Discounts and Cheapflation](https://publications.gc.ca/collections/collection_2024/banque-bank-canada/FB3-5-2024-31-eng.pdf)).

Banana compares grocery prices across five chains in Metro Vancouver: **Save-On-Foods, Walmart, Costco, No Frills and Real Canadian Superstore**. You search once and see who has the item, what it costs, and how far away the store is. Then you can build a shopping list and see which store, or which mix of stores, makes your whole basket cheapest.

### Social responsibility

- **Saving money is free.** Search, comparison, store maps and basket totals are all on the Free plan, with no account needed. We never paywall the features that help people spend less.
- **Premium feeds people.** Premium costs $4.99/month (CAD). **20% of every payment goes straight to local food banks.** The other 80% covers price data, hosting and payment fees. Once operating costs are offset, **100% of proceeds will go to local food banks.**
- **Privacy by default.** Your location is used only to work out distances. It is never logged or stored on our servers. A searched address is saved only in your own browser.
- **Honest numbers.** We never fill gaps with made-up values. Missing information is shown as missing. Demo prices are clearly labelled. A basket that's missing items is never ranked as the "cheapest". Totals state that they exclude taxes, fees and deposits.
- **Free and open services.** Maps use MapLibre and OpenFreeMap, and address search uses the public BC Address Geocoder. Nobody needs a paid account to use Banana.

## Key features

🔍 **Search and compare**
- One search across all five chains, by item name.
- Filter by category, store, distance, and discounts only.
- Sort by lowest price, highest price, nearest first, or biggest discount.
- Each offer shows the price, any discount, package size, the store, and the distance to the nearest branch.
- Searches and filters are saved in the URL, so a results page can be shared and the Back button works.

🏷️ **Nearby discounts**
- The home page shows the best discounts close to you right away.
- Banana remembers your neighbourhood.

🧺 **My basket: whole-list comparison**
- Add items to **My basket** while you search.
- See your **whole basket's total at every chain**, plus the cheapest split across stores.
- Exact matches (same product and size) are shown separately from cheaper alternatives (a different size or pack count).
- If a chain is missing items, Banana names them instead of quietly showing a lower total.

🗺️ **Store locations and map**
- Live map of nearby stores beside a list (List and Map tabs on phones).
- Search any Metro Vancouver address with suggestions as you type, or tap **Use my location**.
- Choose a 1, 3, 5 or 10 km radius, then tap a store to see its offers

👤 **Accounts and saved lists**
- Sign in with Google, or with email and password.
- Save a basket under a name and reload it later, on any device.

💳 **Plans**
- **Free:** prices refreshed every 3–4 days, full search and comparison, map, and basket totals.
- **Premium ($4.99/month):** daily prices, and 20% goes to local food banks. Checkout runs through Stripe.

📱 **Works on any device**
- Responsive design with bottom navigation and a filter panel on phones, plus home-screen app icons.

## Future Roadmap
- **Full Canadian Support:** Banana will be revamped to expand beyond Metro Vancouver, extending to other Canadian provinces and territories.
- **Comprehensive Data Collection:** Automated flyer and cost will be conducted using AI-assisted retrieval and querying methods on websites, to how
- **User-submitted and Opt-in Services:** Verified user-submitted crowdsourcing and opt-in services for stores without online catalogues will be integrated to have a more comprehensive database. 

## Tech stack

| Part | Technology |
|---|---|
| Website | React 19, TypeScript, Vite |
| Hosting | Cloudflare Pages |
| Database and sign-in | Supabase: Postgres with row-level security, Google and email sign-in |
| Maps | MapLibre GL with OpenFreeMap tiles (no API key) |
| Address search | BC Address Geocoder (public) |
| Payments | Stripe Payment Links |
| Data pipeline and API | TypeScript on Node 24: one connector per chain, then cleaning, unit conversion and matching |
| Tests | Vitest (backend), Node's built-in test runner (frontend) |

Prices are stored in whole cents. Every item also gets a **comparable unit price** (per 100 g, per 100 mL or per item), so a 4 L jug and a 2 L carton can be compared fairly.

**Data status:** the live demo runs on **clearly labelled simulated prices** for 283 items. We're adding real prices from each chain's public weekly flyer. Store locations and distances are real.

## Running the project

**Quickest way:** open the live site, https://banana-8qk.pages.dev. Nothing to install.

### 📲 Install it on your phone

Banana works as an app on your home screen, with no app store needed.

- **iPhone (Safari):** open https://banana-8qk.pages.dev, tap the **Share** button (the square with an arrow), then **Add to Home Screen**, then **Add**.
- **Android (Chrome):** open https://banana-8qk.pages.dev, tap the **⋮** menu (top right), then **Add to Home screen** or **Install app**, then **Install**.

Banana then opens from its own icon, without the browser bar, like any other app.

To run it on your own computer, you need **Node.js 24** and **npm**.

### Backend: data pipeline, search and local API (no keys needed)

```sh
cd backend
npm install
npm test            # run the test suite
npm run ingest      # run the price pipeline once and print a summary
npm run api         # start the local API at http://127.0.0.1:8787
```

Without any settings, the backend runs entirely in memory on the simulated prices.

### Website

```sh
cd frontend
npm ci
cp .env.example .env.local
npm run dev         # open http://127.0.0.1:5173
```

The website reads prices from Supabase. Fill in the two values in `.env.local`: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Both are browser-safe, not secrets, and the team can share them. Other useful commands:

```sh
npm test            # frontend tests
npm run check       # type check, lint and formatting
npm run build       # production build in dist/
```

More detail is in [`frontend/README.md`](frontend/README.md) and [`backend/README.md`](backend/README.md).

## Repository layout

```
frontend/              The website (React)
  src/features/        Pages: Home, Search, Locations, Plans
  src/components/      Header, search, filters, offers, basket, map, sign-in
  src/lib/             Search, filtering, basket comparison logic
  tests/               Frontend tests
backend/               Data pipeline and local API (TypeScript)
  src/connectors/      One connector per grocery chain
  src/pipeline/        Cleaning, unit conversion and matching
  src/search/          Search, filters and sorting
  src/server/          Local API server
  sql/                 Supabase schema and migrations
  docs/                API contract and setup guides
```
