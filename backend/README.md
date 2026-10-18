# Banana backend

Store connectors, the data pipeline, search, and a small local API for the website. TypeScript on Node 24.
All prices are **made up** for now; there is no database yet.

## Commands

```sh
npm install
npm run api              # start the local API on http://127.0.0.1:8787 (simulated data)
npm run api -- --sample  # same, with the small sample set
npm test                 # run the tests
npm run typecheck        # check the types
npm run ingest           # run the pipeline once and print a summary
```

`PORT=9000 npm run api` picks another port. The website's Vite dev proxy finds the API with
`API_PROXY_TARGET=http://127.0.0.1:8787`.

## Using the Supabase database

Without `DATABASE_URL` everything runs in memory, as above. With it (in `backend/.env`, never
committed; see `.env.example`):

```sh
npm run ingest -- --simulated --database   # write the simulated data into raw.<chain> and banana.*
npm run api                                # read prices and keep saved lists in the database
```

The database must have `sql/supabase-setup.sql` (and, for saved lists, `sql/accounts-setup.sql`)
run once. The backend connects as the database owner, so it filters every saved-list query by the
signed-in person itself. The API keeps a 60-second copy of the prices, so new prices show up within
a minute of an ingest.

Database tests run only against a throwaway database set up like Supabase:
`TEST_DATABASE_URL=postgres://... npm test`. Without it they are skipped. Never point it at the
team's Supabase.

## How it fits together

```
connectors -> per-store layer -> combine -> final layer -> PriceRepository -> API handlers -> local server
```

- `src/app.ts` builds all of it with `createBackend()`. Today every layer lives in memory and is rebuilt on start.
  The Supabase versions plug in there later, behind the same interfaces.
- `src/api/handlers.ts` has one plain function per endpoint. `src/server/` is a small `node:http` server that
  routes requests to them.
- The endpoints, mock responses and privacy rules are in [`docs/api-contract.md`](docs/api-contract.md).
- Money is always whole cents. A visitor's location only ever travels in a POST body and is never logged.
- Never commit secrets. Keys go in a local `.env` file, which git already ignores.
