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
