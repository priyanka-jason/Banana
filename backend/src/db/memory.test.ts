import { describe, expect, it } from 'vitest';
import type { FinalItem, StoreRecord } from '../pipeline/types';
import { MemoryFinal, MemoryStoreData } from './memory';

function record(chainSlug: string, sku: string, payload: Record<string, unknown> = {}): StoreRecord {
  return { chainSlug, sku, scrapedAt: '2026-10-17T20:00:00.000Z', payload: { sku, ...payload } };
}

function finalItem(id: string, overrides: Partial<FinalItem> = {}): FinalItem {
  return {
    id,
    chainSlug: 'walmart',
    sku: id.split(':')[1] ?? id,
    name: 'Test',
    category: 'pantry',
    storeCategories: ['Pantry'],
    regularPriceCents: 100,
    scrapedAt: '2026-10-17T20:00:00.000Z',
    ...overrides,
  };
}

describe('MemoryStoreData', () => {
  it('saves and loads records, and says how many were saved', async () => {
    const store = new MemoryStoreData();
    expect(await store.saveRecords('walmart', [record('walmart', 'A'), record('walmart', 'B')])).toBe(2);
    expect((await store.loadRecords('walmart')).map((r) => r.sku)).toEqual(['A', 'B']);
  });

  it('replaces a record that has the same sku instead of duplicating it', async () => {
    const store = new MemoryStoreData();
    await store.saveRecords('walmart', [record('walmart', 'A', { name: 'Old' })]);
    await store.saveRecords('walmart', [record('walmart', 'A', { name: 'New' })]);

    const loaded = await store.loadRecords('walmart');
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.payload['name']).toBe('New');
  });

  it("keeps each store's records apart", async () => {
    const store = new MemoryStoreData();
    await store.saveRecords('walmart', [record('walmart', 'A')]);
    await store.saveRecords('costco', [record('costco', 'A')]);

    expect(await store.loadRecords('walmart')).toHaveLength(1);
    expect(await store.loadRecords('costco')).toHaveLength(1);
    expect(await store.loadRecords('save-on-foods')).toEqual([]);
  });

  it("refuses a record that belongs to a different store's table", async () => {
    const store = new MemoryStoreData();
    await expect(store.saveRecords('walmart', [record('costco', 'A')])).rejects.toThrow(/belongs to "costco"/);
    expect(await store.loadRecords('walmart')).toEqual([]);
  });

  it('behaves like a JSON column: undefined fields disappear', async () => {
    const store = new MemoryStoreData();
    await store.saveRecords('walmart', [record('walmart', 'A', { brand: undefined, name: 'X' })]);
    const loaded = await store.loadRecords('walmart');
    expect(loaded[0]?.payload).toEqual({ sku: 'A', name: 'X' });
    expect(loaded[0]?.payload).not.toHaveProperty('brand');
  });

  it('does not let callers change saved data by accident', async () => {
    const store = new MemoryStoreData();
    const original = record('walmart', 'A', { name: 'Original' });
    await store.saveRecords('walmart', [original]);

    original.payload['name'] = 'Changed after saving';
    const loaded = await store.loadRecords('walmart');
    expect(loaded[0]?.payload['name']).toBe('Original');

    loaded[0]!.payload['name'] = 'Changed after loading';
    expect((await store.loadRecords('walmart'))[0]?.payload['name']).toBe('Original');
  });
});

describe('MemoryFinal', () => {
  it('saves items, updates one with the same id, and says how many were saved', async () => {
    const final = new MemoryFinal();
    expect(await final.upsertItems([finalItem('walmart:A'), finalItem('walmart:B')])).toBe(2);
    await final.upsertItems([finalItem('walmart:A', { regularPriceCents: 250 })]);

    const items = await final.listItems();
    expect(items).toHaveLength(2);
    expect(items.find((item) => item.id === 'walmart:A')?.regularPriceCents).toBe(250);
  });

  it('saves chains and locations, updating by slug and id', async () => {
    const final = new MemoryFinal();
    await final.upsertChains([{ slug: 'walmart', name: 'Walmart', parentCompany: 'Walmart', hasMemberPricing: false }]);
    await final.upsertChains([{ slug: 'walmart', name: 'Walmart Canada', parentCompany: 'Walmart', hasMemberPricing: false }]);
    await final.upsertLocations([{ id: 'walmart-1', chainSlug: 'walmart', name: 'One', lat: 49.2, lng: -123.1 }]);
    await final.upsertLocations([{ id: 'walmart-1', chainSlug: 'walmart', name: 'One (moved)', lat: 49.3, lng: -123.2 }]);

    const chains = await final.listChains();
    const locations = await final.listLocations();
    expect(chains).toHaveLength(1);
    expect(chains[0]?.name).toBe('Walmart Canada');
    expect(locations).toHaveLength(1);
    expect(locations[0]?.name).toBe('One (moved)');
  });

  it('does not let callers change saved items by accident', async () => {
    const final = new MemoryFinal();
    const item = finalItem('walmart:A');
    await final.upsertItems([item]);
    item.name = 'Changed after saving';
    expect((await final.listItems())[0]?.name).toBe('Test');
  });
});
