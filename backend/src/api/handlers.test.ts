import { describe, expect, it } from 'vitest';
import { PRODUCT_CATEGORIES } from '../categories';
import { sampleConnectors } from '../connectors';
import { MemoryFinal, MemoryStoreData } from '../db/memory';
import { MemoryPriceRepository } from '../db/memoryReader';
import type { PriceRepository } from '../db/repository';
import { runIngest } from '../pipeline/runIngest';
import {
  handleCategories,
  handleChains,
  handleGetItem,
  handleHealth,
  handleLookup,
  handleNearbyStores,
  handleSearch,
  handleStores,
} from './handlers';
import type { ApiErrorBody } from './types';

async function repo(): Promise<MemoryPriceRepository> {
  const final = new MemoryFinal();
  await runIngest({
    connectors: sampleConnectors,
    storeData: new MemoryStoreData(),
    final,
    now: () => new Date('2026-10-17T20:00:00.000Z'),
  });
  return new MemoryPriceRepository(final);
}

/** A repository that breaks, with a message that must never reach the website. */
const SECRET = 'password=hunter2 at db.internal:5432';
const brokenRepo: PriceRepository = {
  searchPrices: async () => {
    throw new Error(SECRET);
  },
  getItems: async () => {
    throw new Error(SECRET);
  },
  listChains: async () => {
    throw new Error(SECRET);
  },
  listStoreLocations: async () => {
    throw new Error(SECRET);
  },
  storesWithinRadius: async () => {
    throw new Error(SECRET);
  },
};

function errorOf(body: unknown): ApiErrorBody['error'] {
  return (body as ApiErrorBody).error;
}

describe('handleSearch', () => {
  it('searches with the filters and echoes the page size and offset', async () => {
    const result = await handleSearch(await repo(), { query: 'banana' });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ total: 3, limit: 50, offset: 0 });
    expect((result.body as { rows: unknown[] }).rows).toHaveLength(3);
  });

  it('echoes the limit and offset that were asked for', async () => {
    const result = await handleSearch(await repo(), { limit: 5, offset: 10 });
    expect(result.body).toMatchObject({ total: 45, limit: 5, offset: 10 });
    expect((result.body as { rows: unknown[] }).rows).toHaveLength(5);
  });

  it('treats a missing body as "everything"', async () => {
    const result = await handleSearch(await repo(), undefined);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ total: 45 });
  });

  it('answers a bad request with 400 and every problem', async () => {
    const result = await handleSearch(await repo(), { sortBy: 'cheapest', limit: 500, chains: [] });

    expect(result.status).toBe(400);
    expect(errorOf(result.body).code).toBe('invalid_request');
    expect(errorOf(result.body).message).toBe('The request has 3 problems.');
    expect(errorOf(result.body).details?.map((detail) => detail.field)).toEqual(['chains', 'sortBy', 'limit']);
  });

  it('says "1 problem" for one problem', async () => {
    const result = await handleSearch(await repo(), { limit: 0 });
    expect(errorOf(result.body).message).toBe('The request has 1 problem.');
  });

  it('does not repeat a visitor location back in an error', async () => {
    const result = await handleSearch(await repo(), { near: { lat: 123.456789, lng: -123.987654, radiusKm: 5 } });
    expect(result.status).toBe(400);
    const text = JSON.stringify(result.body);
    expect(text).not.toContain('123.456789');
    expect(text).not.toContain('123.987654');
  });

  it('answers an unexpected failure with a plain 500 that leaks nothing', async () => {
    const result = await handleSearch(brokenRepo, { query: 'milk' });

    expect(result.status).toBe(500);
    expect(errorOf(result.body).code).toBe('internal_error');
    expect(JSON.stringify(result.body)).not.toContain('hunter2');
    expect(JSON.stringify(result.body)).not.toContain('db.internal');
  });

  it('tells onError about the failure, with the error only and never the request', async () => {
    const calls: unknown[][] = [];
    await handleSearch(
      brokenRepo,
      { near: { lat: 49.28, lng: -123.12, radiusKm: 5 } },
      { onError: (...args: unknown[]) => calls.push(args) },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]).toHaveLength(1);
    expect((calls[0]?.[0] as Error).message).toBe(SECRET);
  });
});

describe('handleGetItem', () => {
  it('returns one item', async () => {
    const result = await handleGetItem(await repo(), 'walmart:W-2002', {});

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ id: 'walmart:W-2002', priceCents: 547, discountPercent: 8 });
  });

  it('applies member pricing', async () => {
    const result = await handleGetItem(await repo(), 'save-on-foods:SOF-1001', { memberPricing: 'member' });
    expect(result.body).toMatchObject({ priceCents: 149 });
  });

  it('answers 404 for an item that does not exist, naming the id', async () => {
    const result = await handleGetItem(await repo(), 'walmart:NOPE', {});

    expect(result.status).toBe(404);
    expect(errorOf(result.body)).toEqual({ code: 'not_found', message: 'There is no item with id "walmart:NOPE".' });
  });

  it('answers 400 for a bad id or member pricing', async () => {
    const r = await repo();
    expect((await handleGetItem(r, '', {})).status).toBe(400);
    expect((await handleGetItem(r, 'x'.repeat(201), {})).status).toBe(400);

    const result = await handleGetItem(r, 'walmart:W-2002', { memberPricing: 'gold' });
    expect(result.status).toBe(400);
    expect(errorOf(result.body).details).toEqual([{ field: 'memberPricing', message: 'must be one of: member, non-member' }]);
  });

  it('answers an unexpected failure with a plain 500', async () => {
    const result = await handleGetItem(brokenRepo, 'walmart:W-2002', {});
    expect(result.status).toBe(500);
    expect(JSON.stringify(result.body)).not.toContain('hunter2');
  });
});

describe('handleLookup', () => {
  it('returns rows in the order asked for and lists missing ids', async () => {
    const result = await handleLookup(await repo(), {
      ids: ['costco:C-3009', 'walmart:GONE-1', 'walmart:W-2009', 'walmart:GONE-1'],
    });

    expect(result.status).toBe(200);
    const body = result.body as { rows: Array<{ id: string }>; missingIds: string[] };
    expect(body.rows.map((row) => row.id)).toEqual(['costco:C-3009', 'walmart:W-2009']);
    expect(body.missingIds).toEqual(['walmart:GONE-1']);
  });

  it('applies member pricing', async () => {
    const result = await handleLookup(await repo(), { ids: ['save-on-foods:SOF-1009'], memberPricing: 'member' });
    expect((result.body as { rows: Array<{ priceCents: number }> }).rows[0]?.priceCents).toBe(449);
  });

  it('answers 400 for a bad request', async () => {
    const result = await handleLookup(await repo(), { ids: [] });
    expect(result.status).toBe(400);
    expect(errorOf(result.body).details).toEqual([{ field: 'ids', message: 'must have at least one id' }]);
  });

  it('answers an unexpected failure with a plain 500', async () => {
    expect((await handleLookup(brokenRepo, { ids: ['a'] })).status).toBe(500);
  });
});

describe('handleChains', () => {
  it('lists the chains by name', async () => {
    const result = await handleChains(await repo());

    expect(result.status).toBe(200);
    const chains = (result.body as { chains: Array<{ slug: string; parentCompany: string }> }).chains;
    expect(chains.map((chain) => chain.slug)).toEqual(['costco', 'save-on-foods', 'walmart']);
    expect(chains[1]?.parentCompany).toBe('Pattison Food Group');
  });

  it('answers an unexpected failure with a plain 500', async () => {
    expect((await handleChains(brokenRepo)).status).toBe(500);
  });
});

describe('handleCategories', () => {
  it('lists every shared category with a label for people', async () => {
    const result = await handleCategories();

    expect(result.status).toBe(200);
    const categories = (result.body as { categories: Array<{ slug: string; label: string }> }).categories;
    expect(categories.map((category) => category.slug)).toEqual([...PRODUCT_CATEGORIES]);
    expect(categories[0]).toEqual({ slug: 'fruits', label: 'Fruits' });
    expect(categories.find((category) => category.slug === 'dairy-eggs')?.label).toBe('Dairy & Eggs');
  });
});

describe('handleStores', () => {
  it('lists every store, or just the chains asked for', async () => {
    const r = await repo();
    expect(((await handleStores(r, {})).body as { stores: unknown[] }).stores).toHaveLength(6);
    expect(((await handleStores(r, { chain: 'walmart' })).body as { stores: unknown[] }).stores).toHaveLength(2);
    expect(((await handleStores(r, { chain: ['walmart', 'costco'] })).body as { stores: unknown[] }).stores).toHaveLength(4);
  });

  it('answers 400 for a bad chain value', async () => {
    const result = await handleStores(await repo(), { chain: 5 });
    expect(result.status).toBe(400);
    expect(errorOf(result.body).details?.[0]?.field).toBe('chain');
  });

  it('answers an unexpected failure with a plain 500', async () => {
    expect((await handleStores(brokenRepo, {})).status).toBe(500);
  });
});

describe('handleNearbyStores', () => {
  it('lists stores near the point, nearest first', async () => {
    const result = await handleNearbyStores(await repo(), { lat: 49.28, lng: -123.12, radiusKm: 10 });

    expect(result.status).toBe(200);
    const stores = (result.body as { stores: Array<{ id: string; distanceKm: number }> }).stores;
    expect(stores.map((store) => store.id)).toEqual(['save-on-foods-sample-1', 'costco-sample-1']);
    expect(stores[0]?.distanceKm).toBe(0.3);
  });

  it('answers 400 for a location off Earth, without repeating it', async () => {
    const result = await handleNearbyStores(await repo(), { lat: 200.123456, lng: -123.1, radiusKm: 5 });

    expect(result.status).toBe(400);
    expect(errorOf(result.body).details).toEqual([{ field: 'lat', message: 'must be at least -90 and at most 90' }]);
    expect(JSON.stringify(result.body)).not.toContain('200.123456');
  });

  it('answers an unexpected failure with a plain 500', async () => {
    expect((await handleNearbyStores(brokenRepo, { lat: 49, lng: -123, radiusKm: 5 })).status).toBe(500);
  });
});

describe('handleHealth', () => {
  it('says the API is up', async () => {
    expect(await handleHealth()).toEqual({ status: 200, body: { status: 'ok' } });
  });
});
