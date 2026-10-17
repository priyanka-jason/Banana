import { describe, expect, it } from 'vitest';
import { isProductCategory } from '../categories';
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

    it('uses only known categories and covers the main food groups', async () => {
      const items = await connector.fetchItems();
      const categories = new Set(items.map((item) => item.category));
      for (const category of categories) {
        expect(category !== undefined && isProductCategory(category)).toBe(true);
      }
      for (const wanted of ['fruits', 'vegetables', 'meat', 'seafood', 'dairy-eggs'] as const) {
        expect(categories.has(wanted)).toBe(true);
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

describe('all sample connectors together', () => {
  it('have different chain slugs', () => {
    const slugs = sampleConnectors.map((connector) => connector.chain.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('Save-On-Foods', () => {
  it('reads dollars, member prices, promo dates and unit prices', async () => {
    const items = await createSaveOnFoodsConnector().fetchItems();

    expect(itemWithSku(items, 'SOF-1002')).toMatchObject({
      name: 'Gala Apples 1.36 kg Bag',
      category: 'fruits',
      regularPriceCents: 599,
      salePriceCents: 499,
      saleStart: '2026-10-16',
      saleEnd: '2026-10-22',
      unitPriceCents: 37,
      unitLabel: '100g',
    });
    expect(itemWithSku(items, 'SOF-1001')).toMatchObject({ regularPriceCents: 169, memberPriceCents: 149 });
    expect(itemWithSku(items, 'SOF-1011').category).toBe('frozen');
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
      category: 'fruits',
      regularPriceCents: 597,
      salePriceCents: 547,
      unitPriceCents: 40,
      unitLabel: '100g',
    });
    expect(itemWithSku(items, 'W-2001')).toMatchObject({ regularPriceCents: 69, unitPriceCents: 152, unitLabel: 'kg' });
  });

  it('uses the aisle to tell vegetables from fruit inside "Fruits & Vegetables"', async () => {
    const items = await createWalmartConnector().fetchItems();
    expect(itemWithSku(items, 'W-2003').category).toBe('vegetables');
    expect(itemWithSku(items, 'W-2001').category).toBe('fruits');
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
      category: 'fruits',
      regularPriceCents: 1199,
      salePriceCents: 999,
      saleStart: '2026-10-14',
      saleEnd: '2026-10-25',
      unitPriceCents: 28,
      unitLabel: '100g',
    });
    expect(itemWithSku(items, 'C-3015').salePriceCents).toBe(1999);
  });

  it('puts fish under seafood even though the broad group is "Seafood"', async () => {
    const items = await createCostcoConnector().fetchItems();
    expect(itemWithSku(items, 'C-3007').category).toBe('seafood');
  });
});

describe('swapping in a different data source', () => {
  it('uses the loader it is given instead of the sample data', async () => {
    const items = await createWalmartConnector(async () => [
      { sku: 'X-1', name: ' Test  Rice ', department: 'Pantry', price: '$1.00' },
    ]).fetchItems();

    expect(items).toEqual([
      expect.objectContaining({ sku: 'X-1', name: 'Test Rice', category: 'pantry', regularPriceCents: 100 }),
    ]);
  });

  it('fails loudly on a bad price instead of saving a wrong one', async () => {
    const connector = createWalmartConnector(async () => [
      { sku: 'X-2', name: 'Broken', department: 'Pantry', price: 'call us' },
    ]);
    await expect(connector.fetchItems()).rejects.toThrow(/Invalid price/);
  });
});
