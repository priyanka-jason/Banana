import { sampleConnectors } from '../connectors';
import { MemoryFinal, MemoryStoreData } from '../db/memory';
import { MemoryPriceRepository } from '../db/memoryReader';
import { runIngest } from '../pipeline/runIngest';
import {
  handleCategories,
  handleChains,
  handleGetItem,
  handleHealth,
  handleLookup,
  handleNearbyStores,
  handleSearch,
  handleShoppingList,
  handleStores,
} from './handlers';
import { nearbyStoresBody, storeSelectionFilters } from './storeChoice';
import type { ApiResult } from './types';

/**
 * Sample requests and responses for the website team to use as mock data.
 *
 * Every response here is produced by the real handlers running on the made-up
 * sample data, so it can't drift from the code. A test checks that the files in
 * backend/docs/examples match what this builds. Regenerate them with
 * `npm run examples` after changing the API or the sample data.
 */

export interface ExampleFile {
  description: string;
  request: {
    method: 'GET' | 'POST';
    /** The path as sent over HTTP, including the query string and any URL-encoding. */
    path: string;
    /** For POST requests: the JSON body. */
    body?: unknown;
  };
  response: { status: number; body: unknown };
}

/** A fixed time so the files are the same every time they are generated. */
const EXAMPLE_TIME = new Date('2026-10-17T20:00:00.000Z');

/** Downtown Vancouver, a made-up "shopper" for the nearby examples. */
const SHOPPER = { lat: 49.28, lng: -123.12 };

function example(
  description: string,
  request: ExampleFile['request'],
  result: ApiResult<unknown>,
): ExampleFile {
  return { description, request, response: { status: result.status, body: result.body } };
}

/** Builds every example, keyed by file name. */
export async function buildExamples(): Promise<Record<string, ExampleFile>> {
  const storeData = new MemoryStoreData();
  const final = new MemoryFinal();
  await runIngest({ connectors: sampleConnectors, storeData, final, now: () => EXAMPLE_TIME });
  const repo = new MemoryPriceRepository(final);

  const searchPath = '/api/prices/search';
  const files: Record<string, ExampleFile> = {};

  const search = async (name: string, description: string, body: unknown) => {
    files[name] = example(description, { method: 'POST', path: searchPath, body }, await handleSearch(repo, body));
  };

  await search(
    'search-bananas.json',
    'Search by name. Three stores sell bananas, priced per kg, per lb and by the bag, so look at comparableUnitPrice to compare them.',
    { query: 'banana' },
  );
  await search(
    'search-milk-members-best-value.json',
    'A member searching milk, cheapest per unit first. Costco sells a 2-pack (packCount 2), which costs more up front but about the same per millilitre.',
    { query: 'milk', memberPricing: 'member', sortBy: 'unitPrice' },
  );
  await search(
    'search-top-deals.json',
    'The "top deals" list: only items on sale, biggest percent off first, 5 per page.',
    { onSaleOnly: true, sortBy: 'discount', limit: 5 },
  );
  await search(
    'search-meat-most-expensive-first.json',
    'Only meat, most expensive first: sortOrder "desc" flips the price sort. Equal prices still go by name, then id.',
    { categories: ['meat'], sortBy: 'price', sortOrder: 'desc', limit: 5 },
  );
  await search(
    'search-fruit-and-vegetables-page-2.json',
    'Filter by shared categories and ask for the second page of 4. "total" is the number of matches before paging.',
    { categories: ['fruits', 'vegetables'], sortBy: 'name', limit: 4, offset: 4 },
  );
  await search(
    'search-near-me.json',
    'Bananas at stores within 12 km of the shopper, nearest first. The location is in the POST body, never in the URL. Each row has distanceKm, the distance to that chain\'s nearest store.',
    { query: 'banana', near: { ...SHOPPER, radiusKm: 12 }, sortBy: 'distance' },
  );
  await search(
    'search-within-5km.json',
    'Milk at any store within 5 km of the shopper (one of the radius choices, 5 or 10 km). Only chains with a store that close show up. Built with storeSelectionFilters() from src/api/storeChoice.ts.',
    { query: 'milk', ...storeSelectionFilters({ where: { kind: 'nearby', ...SHOPPER, radiusKm: 5 } }) },
  );
  await search(
    'search-within-10km-one-chain.json',
    'Milk at Costco stores within 10 km: a radius and a chain together. distanceKm is the distance to the nearest Costco.',
    {
      query: 'milk',
      ...storeSelectionFilters({ where: { kind: 'nearby', ...SHOPPER, radiusKm: 10 }, chainSlugs: ['costco'] }),
    },
  );
  await search(
    'search-picked-stores.json',
    'Prices at stores picked on a map. Pass the ids from /api/stores.',
    { query: 'eggs', locationIds: ['walmart-sample-1', 'costco-sample-2'] },
  );
  await search(
    'search-invalid.json',
    'A request with several problems. Every problem is listed in error.details, not just the first.',
    { query: 'milk', near: { lat: 123, lng: -123.1, radiusKm: 5 }, sortBy: 'cheapest', sortOrder: 'down', limit: 500, chains: ['walmart'] },
  );

  files['get-item.json'] = example(
    'One item by id. The id has a colon, so it is URL-encoded in the path (use encodeURIComponent).',
    { method: 'GET', path: '/api/prices/walmart%3AW-2002' },
    await handleGetItem(repo, 'walmart:W-2002', {}),
  );
  files['get-item-not-found.json'] = example(
    'An id that does not exist, for example an item a store stopped selling.',
    { method: 'GET', path: '/api/prices/walmart%3ANOPE' },
    await handleGetItem(repo, 'walmart:NOPE', {}),
  );

  const lookupBody = {
    ids: ['walmart:W-2009', 'costco:C-3009', 'save-on-foods:SOF-1009', 'walmart:GONE-1'],
    memberPricing: 'member',
  };
  files['lookup-shopping-list.json'] = example(
    'A saved shopping list: look up many items at once. Rows come back in the order asked for, and ids that no longer exist are in missingIds.',
    { method: 'POST', path: '/api/prices/lookup', body: lookupBody },
    await handleLookup(repo, lookupBody),
  );

  const listBody = {
    items: [
      { query: 'milk', quantity: 2 },
      { query: 'banana' },
      { query: 'eggs', categories: ['dairy-eggs'] },
      { itemId: 'walmart:W-2002' },
    ],
    matchesPerItem: 2,
  };
  files['shopping-list.json'] = example(
    'Price a whole shopping list. Each entry is a search ("milk") or one exact item (itemId). entries has the cheapest matches for each; chains has the cost of buying everything at one chain (most entries first, then cheapest), with missingIndexes for what it lacks; cheapestMix is the lowest total when splitting the list between chains.',
    { method: 'POST', path: '/api/prices/list', body: listBody },
    await handleShoppingList(repo, listBody),
  );
  const nearListBody = {
    items: [{ query: 'milk', quantity: 2 }, { query: 'banana' }],
    matchesPerItem: 1,
    ...storeSelectionFilters({ where: { kind: 'nearby', ...SHOPPER, radiusKm: 10 } }),
  };
  files['shopping-list-within-10km.json'] = example(
    'The same idea for stores within 10 km of the shopper. Add chainSlugs or locationIds the same way as in a search. The location goes in the body only.',
    { method: 'POST', path: '/api/prices/list', body: nearListBody },
    await handleShoppingList(repo, nearListBody),
  );

  files['chains.json'] = example(
    'All store chains, for the list of available stores and the store filters.',
    { method: 'GET', path: '/api/chains' },
    await handleChains(repo),
  );
  files['categories.json'] = example(
    'The shared categories: send the slug in searches, show the label to people.',
    { method: 'GET', path: '/api/categories' },
    await handleCategories(),
  );
  files['stores.json'] = example(
    'Physical stores for map markers, here only Walmart\'s. Leave out ?chain= for all stores. No visitor location is involved.',
    { method: 'GET', path: '/api/stores?chain=walmart' },
    await handleStores(repo, { chain: 'walmart' }),
  );

  const nearbyBody = { ...SHOPPER, radiusKm: 10 };
  files['stores-nearby.json'] = example(
    'Stores within 10 km of the shopper, nearest first.',
    { method: 'POST', path: '/api/stores/nearby', body: nearbyBody },
    await handleNearbyStores(repo, nearbyBody),
  );
  const nearbyCostcoBody = nearbyStoresBody({ kind: 'nearby', ...SHOPPER, radiusKm: 10 }, ['costco']);
  files['stores-nearby-one-chain.json'] = example(
    'Only Costco stores within 10 km, for a store picker after the shopper chose a chain.',
    { method: 'POST', path: '/api/stores/nearby', body: nearbyCostcoBody },
    await handleNearbyStores(repo, nearbyCostcoBody),
  );
  files['stores-nearby-invalid.json'] = example(
    'A location that is not on Earth.',
    { method: 'POST', path: '/api/stores/nearby', body: { lat: 200, lng: -123.1, radiusKm: 5 } },
    await handleNearbyStores(repo, { lat: 200, lng: -123.1, radiusKm: 5 }),
  );
  files['health.json'] = example('A check that the API is up.', { method: 'GET', path: '/api/health' }, await handleHealth());

  return files;
}
