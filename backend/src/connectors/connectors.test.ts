import { describe, expect, it } from 'vitest';
import type { RawItem } from '../types';
import { createCostcoConnector } from './costco';
import { sampleConnectors } from './index';
import { createSaveOnFoodsConnector } from './saveOnFoods';
import { createWalmartConnector } from './walmart';

function itemWithSku(items: RawItem[], sku: string): RawItem {
  const found = items.find((item) => item.sku === sku);
  if (found === undefined) throw new Error(`No item with sku ${sku}`);
  return found;
}

describe.each(sampleConnectors.map((connector) => [connector.chain.slug, connector] as const))(
  '%s connector',
  (_slug, connector) => {
    it('has a lowercase kebab-case slug', () => {
      expect(connector.chain.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    });

    it('returns a full sample list of valid items', async () => {
      const items = await connector.fetchItems();
      expect(items.length).toBeGreaterThanOrEqual(12);
    });

    it('gives every item a different sku', async () => {
      const skus = (await connector.fetchItems()).map((item) => item.sku);
      expect(new Set(skus).size).toBe(skus.length);
    });

    it("keeps the store's own category names and does not assign shared categories", async () => {
      const items = await connector.fetchItems();
      for (const item of items) {
        expect(item.storeCategories.length).toBeGreaterThan(0);
        for (const name of item.storeCategories) expect(name.trim()).not.toBe('');
        // Mapping to the shared categories is a later step, done after all stores are combined.
        expect(item).not.toHaveProperty('category');
      }
    });

    it('returns store locations that belong to this chain', async () => {
      const locations = (await connector.fetchLocations?.()) ?? [];
      expect(locations.length).toBeGreaterThan(0);
      for (const location of locations) {
        expect(location.chainSlug).toBe(connector.chain.slug);
        expect(location.id.startsWith(connector.chain.slug)).toBe(true);
        expect(location.lat).toBeGreaterThanOrEqual(-90);
        expect(location.lat).toBeLessThanOrEqual(90);
        expect(location.lng).toBeGreaterThanOrEqual(-180);
        expect(location.lng).toBeLessThanOrEqual(180);
      }
    });
  },
);

describe("the store's original data", () => {
  it('is set on every sample item', async () => {
    for (const connector of sampleConnectors) {
      for (const item of await connector.fetchItems()) {
        expect(item.original, `${connector.chain.slug}:${item.sku}`).toBeDefined();
        expect(Object.keys(item.original ?? {}).length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps Walmart's text prices and old price untouched", async () => {
    const items = await createWalmartConnector().fetchItems();
    expect(itemWithSku(items, 'W-2002').original).toMatchObject({
      sku: 'W-2002',
      price: '$5.47',
      wasPrice: '$5.97',
      unitPriceText: '$0.40/100g',
      department: 'Fruits & Vegetables',
      aisle: 'Fresh Fruit',
    });
  });

  it("keeps Costco's dollars and instant savings untouched", async () => {
    const items = await createCostcoConnector().fetchItems();
    expect(itemWithSku(items, 'C-3002').original).toMatchObject({
      itemNumber: 'C-3002',
      priceCad: 11.99,
      instantSavingsCad: 2,
      savingsStart: '2026-10-14',
      perUnit: '$0.28 per 100g',
    });
  });

  it("keeps Save-On-Foods' promo and member prices untouched", async () => {
    const items = await createSaveOnFoodsConnector().fetchItems();
    expect(itemWithSku(items, 'SOF-1002').original).toMatchObject({ price: 5.99, promoPrice: 4.99, promoStart: '2026-10-16' });
    expect(itemWithSku(items, 'SOF-1001').original).toMatchObject({ price: 1.69, memberPrice: 1.49 });
  });

  it('is a separate copy, so changing it does not change the next fetch', async () => {
    const connector = createSaveOnFoodsConnector();
    const first = await connector.fetchItems();
    const original = itemWithSku(first, 'SOF-1002').original;
    if (original === undefined) throw new Error('missing original');
    original['price'] = 999;

    const second = await connector.fetchItems();
    expect(itemWithSku(second, 'SOF-1002').original).toMatchObject({ price: 5.99 });
  });
});

describe('all sample connectors together', () => {
  it('have different chain slugs', () => {
    const slugs = sampleConnectors.map((connector) => connector.chain.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('keep each store using its own wording for the same kind of item', async () => {
    const [saveOn, walmart, costco] = await Promise.all(sampleConnectors.map((connector) => connector.fetchItems()));
    // Same product, three different category paths, kept as each store words them.
    expect(itemWithSku(saveOn ?? [], 'SOF-1007').storeCategories).toEqual(['Meat & Seafood', 'Fish']);
    expect(itemWithSku(walmart ?? [], 'W-2007').storeCategories).toEqual(['Meat & Seafood', 'Fish']);
    expect(itemWithSku(costco ?? [], 'C-3007').storeCategories).toEqual(['Seafood', 'Fish']);
  });
});

describe('Save-On-Foods', () => {
  it('reads dollars, member prices, promo dates and unit prices', async () => {
    const items = await createSaveOnFoodsConnector().fetchItems();

    expect(itemWithSku(items, 'SOF-1002')).toMatchObject({
      name: 'Gala Apples 1.36 kg Bag',
      storeCategories: ['Produce', 'Fruit'],
      regularPriceCents: 599,
      salePriceCents: 499,
      saleStart: '2026-10-16',
      saleEnd: '2026-10-22',
      unitPriceCents: 37,
      unitLabel: '100g',
    });
    expect(itemWithSku(items, 'SOF-1001')).toMatchObject({ regularPriceCents: 169, memberPriceCents: 149 });
    expect(itemWithSku(items, 'SOF-1011').storeCategories).toEqual(['Frozen', 'Frozen Vegetables']);
  });

  it('has no sale dates on items that are not on sale', async () => {
    const items = await createSaveOnFoodsConnector().fetchItems();
    expect(itemWithSku(items, 'SOF-1006').saleStart).toBeUndefined();
    expect(itemWithSku(items, 'SOF-1006').saleEnd).toBeUndefined();
  });

  it('ignores a promo price that is not lower than the regular price', async () => {
    const items = await createSaveOnFoodsConnector(async () => [
      { sku: 'X', title: 'Test', categories: ['Pantry'], price: 2, promoPrice: 2, promoStart: '2026-10-16', promoEnd: '2026-10-22' },
    ]).fetchItems();
    expect(items[0]).toMatchObject({ regularPriceCents: 200 });
    expect(items[0]?.salePriceCents).toBeUndefined();
    expect(items[0]?.saleEnd).toBeUndefined();
  });
});

describe('Walmart', () => {
  it('turns "$" text into cents and a rollback into regular and sale prices', async () => {
    const items = await createWalmartConnector().fetchItems();

    expect(itemWithSku(items, 'W-2002')).toMatchObject({
      storeCategories: ['Fruits & Vegetables', 'Fresh Fruit'],
      regularPriceCents: 597,
      salePriceCents: 547,
      unitPriceCents: 40,
      unitLabel: '100g',
    });
    expect(itemWithSku(items, 'W-2001')).toMatchObject({ regularPriceCents: 69, unitPriceCents: 152, unitLabel: 'kg' });
  });

  it('keeps the department and aisle exactly as the store words them', async () => {
    const items = await createWalmartConnector().fetchItems();
    expect(itemWithSku(items, 'W-2003').storeCategories).toEqual(['Fruits & Vegetables', 'Fresh Vegetables']);
    expect(itemWithSku(items, 'W-2015').storeCategories).toEqual(['Household Essentials', 'Paper Towels']);
  });

  it('has no sale price when the old price is missing', async () => {
    const items = await createWalmartConnector().fetchItems();
    expect(itemWithSku(items, 'W-2004').salePriceCents).toBeUndefined();
  });
});

describe('Costco', () => {
  it('takes instant savings off the listed price and keeps the savings dates', async () => {
    const items = await createCostcoConnector().fetchItems();

    expect(itemWithSku(items, 'C-3002')).toMatchObject({
      storeCategories: ['Produce', 'Fruit'],
      regularPriceCents: 1199,
      salePriceCents: 999,
      saleStart: '2026-10-14',
      saleEnd: '2026-10-25',
      unitPriceCents: 28,
      unitLabel: '100g',
    });
    expect(itemWithSku(items, 'C-3015').salePriceCents).toBe(1999);
  });

  it('keeps the group and subgroup as the store words them', async () => {
    const items = await createCostcoConnector().fetchItems();
    expect(itemWithSku(items, 'C-3008').storeCategories).toEqual(['Dairy', 'Milk']);
  });
});

describe('swapping in a different data source', () => {
  it('uses the loader it is given instead of the sample data', async () => {
    const items = await createWalmartConnector(async () => [
      { sku: 'X-1', name: ' Test  Rice ', department: ' Pantry ', price: '$1.00' },
    ]).fetchItems();

    expect(items).toEqual([
      expect.objectContaining({ sku: 'X-1', name: 'Test Rice', storeCategories: ['Pantry'], regularPriceCents: 100 }),
    ]);
  });

  it('does not save a wrong price: the bad item is skipped and reported with its sku', async () => {
    const connector = createWalmartConnector(async () => [
      { sku: 'X-2', name: 'Broken', department: 'Pantry', price: 'call us' },
    ]);

    expect(await connector.fetchItems()).toEqual([]);
    const result = await connector.fetchResult?.();
    expect(result?.items).toEqual([]);
    expect(result?.skipped).toEqual([{ sku: 'X-2', index: 0, reason: 'X-2: Invalid price: "call us"' }]);
  });
});
