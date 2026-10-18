import { describe, expect, it } from 'vitest';
import { PRODUCT_CATEGORIES } from '../categories';
import { sampleConnectors } from '../connectors';
import type { Chain } from '../types';
import { combine } from './combine';
import type { CategoryMap } from './categoryMap';
import { recordsFromItems } from './storeRecords';
import type { FinalItem, StoreRecord } from './types';

const NOW = '2026-10-17T20:00:00.000Z';

const testChain: Chain = { slug: 'walmart', name: 'Walmart', parentCompany: 'Walmart', hasMemberPricing: false };

async function sampleRecords(): Promise<{ chains: Chain[]; records: StoreRecord[] }> {
  const chains = sampleConnectors.map((connector) => connector.chain);
  const records = (
    await Promise.all(
      sampleConnectors.map(async (connector) => recordsFromItems(connector.chain.slug, await connector.fetchItems(), NOW)),
    )
  ).flat();
  return { chains, records };
}

function itemWithId(items: FinalItem[], id: string): FinalItem {
  const found = items.find((item) => item.id === id);
  if (found === undefined) throw new Error(`No final item with id ${id}`);
  return found;
}

function badRecord(overrides: Partial<StoreRecord> & { payload?: Record<string, unknown> } = {}): StoreRecord {
  return {
    chainSlug: 'walmart',
    sku: 'BAD',
    scrapedAt: NOW,
    payload: { sku: 'BAD', name: 'Bad', storeCategories: ['Pantry'], regularPriceCents: 'free' },
    ...overrides,
  };
}

function recordWith(payload: Record<string, unknown>): StoreRecord {
  return {
    chainSlug: 'walmart',
    sku: 'A',
    scrapedAt: NOW,
    payload: { sku: 'A', name: 'X', storeCategories: ['Pantry'], regularPriceCents: 100, ...payload },
  };
}

describe('combine with the sample stores', () => {
  it('turns all 45 sample items into final items with nothing rejected', async () => {
    const { chains, records } = await sampleRecords();
    const result = combine(chains, records);

    expect(result.items).toHaveLength(45);
    expect(result.rejected).toEqual([]);
    expect(new Set(result.items.map((item) => item.id)).size).toBe(45);
  });

  it('builds chain:sku ids and returns items sorted by id', async () => {
    const { chains, records } = await sampleRecords();
    const ids = combine(chains, records).items.map((item) => item.id);

    expect(ids).toContain('save-on-foods:SOF-1001');
    expect(ids).toContain('walmart:W-2001');
    expect(ids).toContain('costco:C-3001');
    expect(ids).toEqual([...ids].sort());
  });

  it("gives each item a shared category and keeps the store's own category names", async () => {
    const { chains, records } = await sampleRecords();
    const { items } = combine(chains, records);

    expect(itemWithId(items, 'save-on-foods:SOF-1007')).toMatchObject({ category: 'seafood', storeCategories: ['Meat & Seafood', 'Fish'] });
    expect(itemWithId(items, 'walmart:W-2003')).toMatchObject({ category: 'vegetables', storeCategories: ['Fruits & Vegetables', 'Fresh Vegetables'] });
    expect(itemWithId(items, 'costco:C-3008')).toMatchObject({ category: 'dairy-eggs', storeCategories: ['Dairy', 'Milk'] });
    expect(itemWithId(items, 'costco:C-3011').category).toBe('frozen');
  });

  it("covers every shared category except 'other', and nothing falls into 'other'", async () => {
    const { chains, records } = await sampleRecords();
    const result = combine(chains, records);
    const found = new Set(result.items.map((item) => item.category));

    expect(found.has('other')).toBe(false);
    for (const category of PRODUCT_CATEGORIES.filter((name) => name !== 'other')) {
      expect(found.has(category), category).toBe(true);
    }
    expect(result.unmappedCategories).toEqual([]);
  });

  it('lists the store categories it had to guess, once per distinct category path', async () => {
    const { chains, records } = await sampleRecords();
    const result = combine(chains, records);
    const fruit = result.guessedCategories.filter(
      (note) => note.chainSlug === 'save-on-foods' && note.storeCategories.join(' > ') === 'Produce > Fruit',
    );
    expect(fruit).toHaveLength(1);
    expect(fruit[0]?.category).toBe('fruits');
  });

  it('uses a hand-checked map instead of guessing, and stops reporting it as a guess', async () => {
    const { chains, records } = await sampleRecords();
    const map: CategoryMap = { 'save-on-foods': { fruit: 'fruits' } };
    const result = combine(chains, records, map);

    expect(itemWithId(result.items, 'save-on-foods:SOF-1001').category).toBe('fruits');
    expect(
      result.guessedCategories.some(
        (note) => note.chainSlug === 'save-on-foods' && note.storeCategories.join(' > ') === 'Produce > Fruit',
      ),
    ).toBe(false);
  });

  it('keeps prices, sale dates and unit prices', async () => {
    const { chains, records } = await sampleRecords();
    expect(itemWithId(combine(chains, records).items, 'costco:C-3002')).toMatchObject({
      name: 'Gala Apples',
      size: '3.63 kg',
      regularPriceCents: 1199,
      salePriceCents: 999,
      saleStart: '2026-10-14',
      saleEnd: '2026-10-25',
      unitPriceCents: 28,
      unitLabel: '100g',
      scrapedAt: NOW,
    });
  });
});

describe('combine splits sizes into separate values', () => {
  it('splits multi-packs into pack count, amount, unit, kind and total', async () => {
    const { chains, records } = await sampleRecords();
    const { items } = combine(chains, records);

    expect(itemWithId(items, 'costco:C-3008')).toMatchObject({
      size: '2 x 4 L',
      packCount: 2,
      sizeAmount: 4,
      sizeUnit: 'l',
      sizeKind: 'volume',
      sizeTotalBase: 8000,
      pricedByWeight: false,
    });
    expect(itemWithId(items, 'costco:C-3013')).toMatchObject({
      packCount: 30,
      sizeAmount: 40,
      sizeUnit: 'g',
      sizeKind: 'weight',
      sizeTotalBase: 1200,
    });
    expect(itemWithId(items, 'costco:C-3014')).toMatchObject({ packCount: 6, sizeAmount: 454, sizeUnit: 'g', sizeTotalBase: 2724 });
  });

  it('treats single packs and counts as one pack', async () => {
    const { chains, records } = await sampleRecords();
    const { items } = combine(chains, records);

    expect(itemWithId(items, 'save-on-foods:SOF-1002')).toMatchObject({
      packCount: 1,
      sizeAmount: 1.36,
      sizeUnit: 'kg',
      sizeKind: 'weight',
      sizeTotalBase: 1360,
    });
    expect(itemWithId(items, 'walmart:W-2009')).toMatchObject({
      packCount: 1,
      sizeAmount: 12,
      sizeUnit: 'ct',
      sizeKind: 'count',
      sizeTotalBase: 12,
      pricedByWeight: false,
    });
    expect(itemWithId(items, 'save-on-foods:SOF-1015')).toMatchObject({ sizeAmount: 6, sizeUnit: 'ct', sizeKind: 'count' });
  });

  it('marks items whose price is per unit of weight', async () => {
    const { chains, records } = await sampleRecords();
    const { items } = combine(chains, records);

    const perLb = itemWithId(items, 'walmart:W-2001'); // "per lb"
    expect(perLb).toMatchObject({ pricedByWeight: true, sizeAmount: 1, sizeUnit: 'lb', sizeKind: 'weight' });
    expect(perLb.sizeTotalBase).toBeCloseTo(453.592, 2);

    expect(itemWithId(items, 'save-on-foods:SOF-1001').pricedByWeight).toBe(true); // "per kg"
    expect(itemWithId(items, 'save-on-foods:SOF-1007')).toMatchObject({ pricedByWeight: true, sizeAmount: 100, sizeUnit: 'g' }); // "per 100 g"
    expect(itemWithId(items, 'costco:C-3005')).toMatchObject({ pricedByWeight: false, sizeAmount: 2.5, sizeUnit: 'kg' }); // "approx. 2.5 kg" is a package
  });

  it('leaves the size values empty for an item that has no size', async () => {
    const { chains, records } = await sampleRecords();
    const result = combine(chains, records);
    const broccoli = itemWithId(result.items, 'walmart:W-2004');

    expect(broccoli).toMatchObject({ packCount: 1, pricedByWeight: false });
    expect(broccoli.sizeAmount).toBeUndefined();
    expect(broccoli.sizeUnit).toBeUndefined();
    expect(broccoli.sizeKind).toBeUndefined();
    expect(broccoli.sizeTotalBase).toBeUndefined();
    expect(result.unreadableSizes).toEqual([]);
  });

  it('can read every size in the sample data', async () => {
    const { chains, records } = await sampleRecords();
    expect(combine(chains, records).unreadableSizes).toEqual([]);
  });

  it('reports a size it cannot read but still saves the item', () => {
    const result = combine([testChain], [recordWith({ size: 'assorted' })]);

    expect(result.rejected).toEqual([]);
    expect(result.unreadableSizes).toEqual([{ chainSlug: 'walmart', sku: 'A', size: 'assorted' }]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ size: 'assorted', packCount: 1, pricedByWeight: false });
    expect(result.items[0]?.sizeUnit).toBeUndefined();
    expect(result.items[0]?.sizeTotalBase).toBeUndefined();
  });
});

describe('combine with bad or odd records', () => {
  it('rejects a bad record, says why, and still processes the rest', async () => {
    const { chains, records } = await sampleRecords();
    const result = combine(chains, [...records, badRecord()]);

    expect(result.items).toHaveLength(45);
    expect(result.rejected).toEqual([
      { chainSlug: 'walmart', sku: 'BAD', reason: expect.stringMatching(/regularPriceCents must be a number/) },
    ]);
  });

  it('rejects a record for a chain it was not given', async () => {
    const { chains, records } = await sampleRecords();
    const result = combine(chains, [...records, badRecord({ chainSlug: 'no-frills' })]);

    expect(result.rejected).toEqual([{ chainSlug: 'no-frills', sku: 'BAD', reason: 'unknown chain "no-frills"' }]);
  });

  it('rejects a record whose sku does not match its payload', () => {
    const record: StoreRecord = {
      chainSlug: 'walmart',
      sku: 'A',
      scrapedAt: NOW,
      payload: { sku: 'B', name: 'X', storeCategories: [], regularPriceCents: 100 },
    };
    const result = combine([testChain], [record]);

    expect(result.items).toEqual([]);
    expect(result.rejected[0]?.reason).toMatch(/does not match payload sku/);
  });

  it('keeps only the newest copy when the same item was saved twice, in either order', () => {
    const make = (scrapedAt: string, name: string): StoreRecord => ({
      chainSlug: 'walmart',
      sku: 'A',
      scrapedAt,
      payload: { sku: 'A', name, storeCategories: ['Pantry'], regularPriceCents: 100 },
    });
    const older = make('2026-10-16T00:00:00.000Z', 'Old name');
    const newer = make('2026-10-17T00:00:00.000Z', 'New name');

    expect(combine([testChain], [older, newer]).items.map((item) => item.name)).toEqual(['New name']);
    expect(combine([testChain], [newer, older]).items.map((item) => item.name)).toEqual(['New name']);
  });

  it('ignores extra store-specific fields in the payload', () => {
    const result = combine([testChain], [recordWith({ aisleNumber: 7 })]);

    expect(result.rejected).toEqual([]);
    expect(result.items[0]).not.toHaveProperty('aisleNumber');
  });

  it('does not copy the store original into the final item', () => {
    const record: StoreRecord = { ...recordWith({}), original: { price: '$1.00' } };
    const result = combine([testChain], [record]);

    expect(result.items[0]).not.toHaveProperty('original');
  });

  it('handles no records at all', () => {
    expect(combine([], [])).toEqual({
      items: [],
      rejected: [],
      guessedCategories: [],
      unmappedCategories: [],
      unreadableSizes: [],
    });
  });
});
