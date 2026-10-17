import { describe, expect, it } from 'vitest';
import { sampleConnectors } from './connectors';
import { createSaveOnFoodsConnector } from './connectors/saveOnFoods';
import { createWalmartConnector } from './connectors/walmart';
import { discountFor, effectivePriceCents, itemId } from './pricing';
import type { RawItem } from './types';

function itemWithSku(items: RawItem[], sku: string): RawItem {
  const found = items.find((item) => item.sku === sku);
  if (found === undefined) throw new Error(`No item with sku ${sku}`);
  return found;
}

describe('itemId', () => {
  it('joins the chain slug and the sku', () => {
    expect(itemId('save-on-foods', 'SOF-1001')).toBe('save-on-foods:SOF-1001');
  });
  it('is different for the same sku at different chains', () => {
    expect(itemId('walmart', '1001')).not.toBe(itemId('costco', '1001'));
  });
  it('is the same every time for the same item', () => {
    expect(itemId('costco', 'C-3001')).toBe(itemId('costco', 'C-3001'));
  });
  it('refuses an empty chain slug or sku', () => {
    expect(() => itemId('', 'X')).toThrow(/chain slug and a sku/);
    expect(() => itemId('walmart', ' ')).toThrow(/chain slug and a sku/);
  });
});

describe('effectivePriceCents', () => {
  it('is the regular price when nothing is cheaper', () => {
    expect(effectivePriceCents({ regularPriceCents: 500 })).toBe(500);
  });
  it('uses the sale price when there is one', () => {
    expect(effectivePriceCents({ regularPriceCents: 500, salePriceCents: 400 })).toBe(400);
  });
  it('ignores a member price for a non-member (the default)', () => {
    const item = { regularPriceCents: 500, memberPriceCents: 300 };
    expect(effectivePriceCents(item)).toBe(500);
    expect(effectivePriceCents(item, 'non-member')).toBe(500);
  });
  it('uses the lowest of the member and sale price for a member', () => {
    expect(effectivePriceCents({ regularPriceCents: 500, memberPriceCents: 300 }, 'member')).toBe(300);
    expect(effectivePriceCents({ regularPriceCents: 500, salePriceCents: 400, memberPriceCents: 450 }, 'member')).toBe(400);
    expect(effectivePriceCents({ regularPriceCents: 500, salePriceCents: 400, memberPriceCents: 350 }, 'member')).toBe(350);
  });
  it('gives a member the normal price when there is no member price', () => {
    expect(effectivePriceCents({ regularPriceCents: 500, salePriceCents: 400 }, 'member')).toBe(400);
  });
  it('ignores a sale price that is not lower than the regular price', () => {
    expect(effectivePriceCents({ regularPriceCents: 500, salePriceCents: 500 })).toBe(500);
    expect(effectivePriceCents({ regularPriceCents: 500, salePriceCents: 600 })).toBe(500);
  });
});

describe('discountFor', () => {
  it('gives the amount in cents and a rounded whole percent', () => {
    expect(discountFor(200, 100)).toEqual({ discountCents: 100, discountPercent: 50 });
    expect(discountFor(599, 499)).toEqual({ discountCents: 100, discountPercent: 17 });
  });
  it('is undefined when the price is not below the original', () => {
    expect(discountFor(500, 500)).toBeUndefined();
    expect(discountFor(500, 600)).toBeUndefined();
  });
  it('is undefined when the original price is zero', () => {
    expect(discountFor(0, 0)).toBeUndefined();
  });
  it('can round a tiny discount down to 0 percent but still reports the cents', () => {
    expect(discountFor(1000, 999)).toEqual({ discountCents: 1, discountPercent: 0 });
  });
});

describe('with the sample store data', () => {
  it('works out a member discount for Save-On-Foods bananas', async () => {
    const bananas = itemWithSku(await createSaveOnFoodsConnector().fetchItems(), 'SOF-1001');

    const memberPrice = effectivePriceCents(bananas, 'member');
    expect(memberPrice).toBe(149);
    expect(discountFor(bananas.regularPriceCents, memberPrice)).toEqual({ discountCents: 20, discountPercent: 12 });

    const normalPrice = effectivePriceCents(bananas);
    expect(normalPrice).toBe(169);
    expect(discountFor(bananas.regularPriceCents, normalPrice)).toBeUndefined();
  });

  it('works out the discount on a Walmart rollback', async () => {
    const apples = itemWithSku(await createWalmartConnector().fetchItems(), 'W-2002');
    const price = effectivePriceCents(apples);
    expect(price).toBe(547);
    expect(discountFor(apples.regularPriceCents, price)).toEqual({ discountCents: 50, discountPercent: 8 });
  });

  it('never prices an item above its original price, and price plus discount equals the original', async () => {
    for (const connector of sampleConnectors) {
      for (const item of await connector.fetchItems()) {
        for (const mode of ['member', 'non-member'] as const) {
          const price = effectivePriceCents(item, mode);
          expect(price).toBeLessThanOrEqual(item.regularPriceCents);
          const discount = discountFor(item.regularPriceCents, price);
          expect(price + (discount?.discountCents ?? 0)).toBe(item.regularPriceCents);
        }
      }
    }
  });
});
