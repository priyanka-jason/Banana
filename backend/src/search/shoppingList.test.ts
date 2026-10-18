import { beforeAll, describe, expect, it } from 'vitest';
import { handleShoppingList } from '../api/handlers';
import { storeSelectionFilters } from '../api/storeChoice';
import type { ShoppingListResponseBody } from '../api/types';
import { sampleConnectors } from '../connectors';
import { MemoryFinal, MemoryStoreData } from '../db/memory';
import { runIngest } from '../pipeline/runIngest';
import { loadSimulated } from '../simulated/exportData';
import type { PriceRow, ShoppingListRequest } from '../types';
import { searchFinal, type SearchData } from './search';
import { DEFAULT_MATCHES_PER_ITEM, priceShoppingList } from './shoppingList';

const NOW = new Date('2026-10-17T20:00:00.000Z');
const SHOPPER = { lat: 49.28, lng: -123.12 };

let data: SearchData;
beforeAll(async () => {
  const final = new MemoryFinal();
  await runIngest({ connectors: sampleConnectors, storeData: new MemoryStoreData(), final, now: () => NOW });
  data = { items: await final.listItems(), chains: await final.listChains(), locations: await final.listLocations() };
});

/** Every match for one entry, cheapest first, found with a plain search. */
function allMatches(entry: ShoppingListRequest['items'][number], request: ShoppingListRequest): PriceRow[] {
  const filters = {
    chainSlugs: request.chainSlugs,
    near: request.near,
    memberPricing: request.memberPricing,
    locationIds: request.locationIds,
    limit: 100,
  };
  if ('itemId' in entry) return searchFinal(data, filters).rows.filter((row) => row.id === entry.itemId);
  return searchFinal(data, { ...filters, query: entry.query, categories: entry.categories }).rows;
}

const LIST: ShoppingListRequest = {
  items: [{ query: 'milk', quantity: 2 }, { query: 'banana' }, { query: 'eggs', categories: ['dairy-eggs'] }, { itemId: 'walmart:W-2002' }],
};

describe('priceShoppingList', () => {
  it('gives each entry its cheapest matches, like a search would', () => {
    const result = priceShoppingList(data, LIST);
    expect(result.entries.map((entry) => entry.index)).toEqual([0, 1, 2, 3]);
    LIST.items.forEach((entry, index) => {
      const expected = allMatches(entry, LIST);
      expect(result.entries[index]!.total, String(index)).toBe(expected.length);
      expect(result.entries[index]!.matches, String(index)).toEqual(expected.slice(0, DEFAULT_MATCHES_PER_ITEM));
    });
    expect(result.entries.map((entry) => entry.quantity)).toEqual([2, 1, 1, 1]);
  });

  it('totals each chain with its own cheapest match per entry, times the quantity', () => {
    const result = priceShoppingList(data, LIST);
    expect(result.chains.length).toBe(3);
    for (const chain of result.chains) {
      let expectedTotal = 0;
      const expectedMissing: number[] = [];
      LIST.items.forEach((entry, index) => {
        const cheapest = allMatches(entry, LIST).find((row) => row.chainSlug === chain.chainSlug);
        if (cheapest === undefined) {
          expectedMissing.push(index);
          return;
        }
        const quantity = entry.quantity ?? 1;
        expectedTotal += cheapest.priceCents * quantity;
        expect(chain.picks.find((p) => p.index === index)).toEqual({ index, row: cheapest, lineCents: cheapest.priceCents * quantity });
      });
      expect(chain.totalCents, chain.chainSlug).toBe(expectedTotal);
      expect(chain.missingIndexes, chain.chainSlug).toEqual(expectedMissing);
    }
  });

  it('counts an exact item only for its own chain', () => {
    const result = priceShoppingList(data, LIST);
    for (const chain of result.chains) {
      expect(chain.missingIndexes.includes(3), chain.chainSlug).toBe(chain.chainSlug !== 'walmart');
    }
  });

  it('puts the chains with the most entries first, then the cheapest', () => {
    const chains = priceShoppingList(data, LIST).chains;
    for (let i = 1; i < chains.length; i++) {
      const [a, b] = [chains[i - 1]!, chains[i]!];
      expect(a.missingIndexes.length < b.missingIndexes.length || (a.missingIndexes.length === b.missingIndexes.length && a.totalCents <= b.totalCents)).toBe(true);
    }
    expect(chains[0]!.chainSlug).toBe('walmart');
  });

  it('builds the cheapest mix from the cheapest match anywhere, never dearer than one chain', () => {
    const result = priceShoppingList(data, LIST);
    expect(result.cheapestMix.missingIndexes).toEqual([]);
    expect(result.cheapestMix.picks.map((p) => p.row.id)).toEqual(LIST.items.map((entry) => allMatches(entry, LIST)[0]!.id));
    expect(result.cheapestMix.totalCents).toBe(result.cheapestMix.picks.reduce((total, p) => total + p.lineCents, 0));
    for (const chain of result.chains.filter((c) => c.missingIndexes.length === 0)) {
      expect(result.cheapestMix.totalCents).toBeLessThanOrEqual(chain.totalCents);
    }
  });

  it('only uses the chosen stores, and gives each chain its distance', () => {
    const request: ShoppingListRequest = { ...LIST, near: { ...SHOPPER, radiusKm: 5 } };
    const result = priceShoppingList(data, request);
    expect(result.chains.map((chain) => [chain.chainSlug, chain.distanceKm])).toEqual([['save-on-foods', 0.3]]);
    expect(result.entries[3]).toMatchObject({ matches: [], total: 0 });
    expect(result.cheapestMix.missingIndexes).toEqual([3]);
  });

  it('reports an entry nothing matches as missing everywhere', () => {
    const result = priceShoppingList(data, { items: [{ query: 'banana' }, { query: 'unicorn steak' }] });
    expect(result.entries[1]).toEqual({ index: 1, quantity: 1, matches: [], total: 0 });
    expect(result.chains.every((chain) => chain.missingIndexes.includes(1))).toBe(true);
    expect(result.cheapestMix.missingIndexes).toEqual([1]);
  });

  it('sends back at most matchesPerItem matches but the full total', () => {
    const result = priceShoppingList(data, { items: [{ query: 'milk' }], matchesPerItem: 1 });
    expect(result.entries[0]!.matches).toHaveLength(1);
    expect(result.entries[0]!.total).toBeGreaterThan(1);
  });
});

describe('POST /api/prices/list on the simulated chains', () => {
  it('prices a list within 10 km at chosen chains', async () => {
    const repo = await loadSimulated();
    const body = {
      items: [{ query: 'milk', quantity: 2 }, { query: 'bananas' }, { query: 'chicken breast', categories: ['meat'] }],
      ...storeSelectionFilters({ where: { kind: 'nearby', ...SHOPPER, radiusKm: 10 }, chainSlugs: ['walmart', 'costco', 'no-frills'] }),
    };
    const response = await handleShoppingList(repo, body);
    expect(response.status).toBe(200);
    const result = response.body as ShoppingListResponseBody;

    expect(result.chains.map((chain) => chain.chainSlug).sort()).toEqual(['costco', 'no-frills', 'walmart']);
    for (const chain of result.chains) {
      expect(chain.missingIndexes, chain.chainSlug).toEqual([]);
      expect(chain.distanceKm, chain.chainSlug).toBeLessThanOrEqual(10);
      expect(chain.picks.every((p) => p.row.chainSlug === chain.chainSlug)).toBe(true);
    }
    expect(result.entries[2]!.matches.every((row) => row.category === 'meat')).toBe(true);
    expect(result.cheapestMix.totalCents).toBeLessThanOrEqual(Math.min(...result.chains.map((chain) => chain.totalCents)));
    expect(JSON.stringify(result)).not.toContain('49.28');
  });

  it('lists every problem in a bad list', async () => {
    const repo = await loadSimulated();
    const response = await handleShoppingList(repo, {
      items: [{ query: 'milk', quantity: 0 }, { itemId: 'walmart:W-1', query: 'milk' }, 'eggs', {}],
      matchesPerItem: 50,
    });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: { message: 'The request has 5 problems.' } });
  });
});
