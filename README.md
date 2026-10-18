# 🍌 Banana

**Find the cheapest groceries near you, in one search.**

Banana compares grocery prices across five chains in Metro Vancouver: Save-On-Foods, Walmart, Costco, No Frills and Real Canadian Superstore. Instead of checking five flyers and five websites, you search once and see who has it, for how much, and how far away.

**Live site:** https://banana-8qk.pages.dev

Built for a hackathon.

---

## The problem

Food prices keep rising, and the cheapest store for one item is rarely the cheapest for the next. Comparing them takes time that many families don't have. The people who need the savings most often have the least time to hunt for them.

Banana does the comparing for you, for free.

## Social responsibility

This is the core of the project, not an add-on.

- **Saving money is free.** Search, comparison, store maps and shopping-list totals are all on the Free plan, with no account needed. We never paywall the features that help people spend less.
- **Premium feeds people.** Premium costs $4.99/month (CAD). **20% of every payment goes straight to local food banks.** The other 80% covers price data, hosting and payment fees, and whatever is left after those costs is donated too.
- **Privacy by default.** Your location is used only to work out distances. It is never logged or stored on our servers. A searched address is saved only in your own browser.
- **Honest numbers.** We never fill gaps with made-up values. Missing information is shown as missing. Demo prices are clearly labelled. A basket that's missing items is never ranked as the "cheapest". Totals state that they exclude taxes, fees and deposits.
- **Responsible data collection.** Real prices come from each chain's public weekly flyer, read slowly, once a week. We don't crawl store websites against their terms, and we stop at any bot check.
- **Free and open services.** Maps use MapLibre and OpenFreeMap, and address search uses the public BC Address Geocoder. Nobody needs a paid account to use Banana.

## Features

### Search and compare
- One search across all five chains, by item name.
- Filter by **category**, **store**, **distance**, and **discounts only**.
- Sort by **lowest price**, **highest price**, **nearest first** or **biggest discount**.
- Each offer shows the price, any discount, package size, the store, and the distance to the nearest branch.
- Searches and filters live in the URL, so a results page can be shared and Back/Forward works.

### Nearby discounts
- The home page shows the best discounts close to you right away.
- Set your neighbourhood once and Banana remembers it.

### Store locations and map
- Live map of every store near you, beside a list view (List and Map tabs on phones).
- Search any Metro Vancouver address with suggestions as you type, or tap **Use my location**.
- Choose a 1, 3, 5 or 10 km radius.
- Tap a store to see its current offers, then browse that store's items.

### My basket: whole-list comparison
- Add items to **My basket** as you search. The basket keeps them while you keep browsing.
- Banana prices your **whole basket at every chain** and shows the total at each.
- It shows exact matches (same product and package) separately from cheaper alternatives (a different size or pack count).
- It also finds the cheapest split across stores.
- If a chain is missing items, it says which ones instead of quietly showing a lower total.
- Quantities and package sizes are taken into account.

### Accounts and saved lists
- Sign in with **Google** or **email and password**.
- Save a basket under a name and load it again later, from any device.
- See your saved lists under **My Account**.

### Plans
- **Free:** prices refreshed every 3–4 days, full search and comparison, store map, and basket totals.
- **Premium ($4.99/month):** prices updated daily, with 20% going to local food banks. Checkout runs through Stripe.

### Works on any device
- Responsive design with bottom navigation, a filter dialog on phones, and installable app icons for the home screen.

## How it works

| Part | Technology |
|---|---|
| Website | React, TypeScript, Vite, hosted on Cloudflare Pages |
| Database and sign-in | Supabase (Postgres, row-level security, Google and email auth) |
| Maps | MapLibre GL with OpenFreeMap tiles (no API key) |
| Address search | BC Address Geocoder (public) |
| Payments | Stripe Payment Links |
| Data pipeline | TypeScript on Node: one connector per chain, then cleaning, unit conversion and matching |

Prices are stored in whole cents, and every item gets a **comparable unit price** (per 100 g, per 100 mL or per item). That lets a 4 L jug and a 2 L carton be compared fairly.

## Data status

The live demo currently runs on **clearly labelled simulated prices** for 283 items across the five chains. We're adding real prices from each chain's public weekly flyer. Store locations and distances are real.

## Run it locally

You need Node.js 24.

```sh
# Website
cd frontend
npm ci
cp .env.example .env.local   # add the Supabase URL and publishable key
npm run dev                  # http://127.0.0.1:5173

# Backend (data pipeline, local API, tests)
cd backend
npm install
npm test
npm run api                  # local API on http://127.0.0.1:8787, simulated data
```

More detail is in [`frontend/README.md`](frontend/README.md) and [`backend/README.md`](backend/README.md).

## Repository layout

```
frontend/   React website: pages, components, map, basket comparison
backend/    Store connectors, data pipeline, search, local API, tests
backend/sql Supabase schema and migrations
```
