import { describe, expect, it } from 'vitest';
import { sampleConnectors } from '../connectors';
import type { RawItem } from '../types';
import { recordsFromItems, toRawItem } from './storeRecords';

const valid: RawItem = {
  sku: 'T-1',
  name: 'Test item',
  storeCategories: ['Pantry', 'Pasta & Rice'],
  regularPriceCents: 500,
  salePriceCents: 400,
  size: '900 g',
};

describe('recordsFromItems', () => {
  it('builds one record per item with the cleaned item as the payload', () => {
    const records = recordsFromItems('walmart', [valid], '2026-10-17T20:00:00.000Z');
    expect(records).toEqual([
      { chainSlug: 'walmart', sku: 'T-1', scrapedAt: '2026-10-17T20:00:00.000Z', payload: { ...valid } },
    ]);
  });

  it("puts the store's original data in its own field, not in the payload", () => {
    const original = { price: '$4.00', wasPrice: '$5.00' };
    const [record] = recordsFromItems('walmart', [{ ...valid, original }], '2026-10-17T20:00:00.000Z');

    expect(record?.original).toEqual(original);
    expect(record?.payload).toEqual({ ...valid });
    expect(record?.payload).not.toHaveProperty('original');
  });

  it('leaves the original field out when the connector did not provide one', () => {
    const [record] = recordsFromItems('walmart', [valid], '2026-10-17T20:00:00.000Z');
    expect(record).not.toHaveProperty('original');
  });

  it('keeps the original for every sample item', async () => {
    for (const connector of sampleConnectors) {
      const items = await connector.fetchItems();
      const records = recordsFromItems(connector.chain.slug, items, '2026-10-17T20:00:00.000Z');
      expect(records.every((record) => record.original !== undefined), connector.chain.slug).toBe(true);
    }
  });
});

describe('toRawItem', () => {
  it('reads back every sample item after a trip through JSON', async () => {
    for (const connector of sampleConnectors) {
      for (const item of await connector.fetchItems()) {
        const { original: _original, ...cleaned } = item;
        const saved = JSON.parse(JSON.stringify({ ...cleaned })) as unknown;
        expect(toRawItem(saved), item.sku).toEqual(cleaned);
      }
    }
  });

  it('ignores extra store-specific fields', () => {
    const item = toRawItem({ ...valid, aisleNumber: 7, nested: { a: 1 } });
    expect(item).toEqual(valid);
    expect(item).not.toHaveProperty('aisleNumber');
  });

  it('treats JSON null as missing for optional fields', () => {
    const item = toRawItem({ ...valid, brand: null, salePriceCents: null });
    expect(item.brand).toBeUndefined();
    expect(item.salePriceCents).toBeUndefined();
  });

  it('rejects anything that is not a JSON object', () => {
    expect(() => toRawItem(null)).toThrow(/JSON object/);
    expect(() => toRawItem([])).toThrow(/JSON object/);
    expect(() => toRawItem('text')).toThrow(/JSON object/);
    expect(() => toRawItem(42)).toThrow(/JSON object/);
  });

  it('rejects missing required fields and lists every problem', () => {
    expect(() => toRawItem({})).toThrow(/sku is required.*name is required.*regularPriceCents is required.*storeCategories/);
  });

  it('rejects fields of the wrong type', () => {
    expect(() => toRawItem({ ...valid, regularPriceCents: '500' })).toThrow(/regularPriceCents must be a number/);
    expect(() => toRawItem({ ...valid, name: 7 })).toThrow(/name must be text/);
    expect(() => toRawItem({ ...valid, storeCategories: 'Pantry' })).toThrow(/storeCategories must be a list of text/);
    expect(() => toRawItem({ ...valid, storeCategories: ['Pantry', 3] })).toThrow(/storeCategories must be a list of text/);
    expect(() => toRawItem({ ...valid, salePriceCents: Number.NaN })).toThrow(/salePriceCents must be a number/);
  });

  it('applies the same price and date rules as the connectors', () => {
    expect(() => toRawItem({ ...valid, salePriceCents: 500 })).toThrow(/salePriceCents must be lower/);
    expect(() => toRawItem({ ...valid, regularPriceCents: 4.99 })).toThrow(/whole number of cents/);
    expect(() => toRawItem({ ...valid, saleStart: '2026-10-23', saleEnd: '2026-10-22' })).toThrow(/saleEnd must not be before/);
  });
});
