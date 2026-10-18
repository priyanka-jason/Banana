import { describe, expect, it } from 'vitest';
import { sampleConnectors } from './index';
import { createCostcoConnector } from './costco';
import { createSaveOnFoodsConnector } from './saveOnFoods';
import { costcoSample } from './sample/costco';
import { saveOnFoodsSample } from './sample/saveOnFoods';
import { walmartSample } from './sample/walmart';
import { createWalmartConnector } from './walmart';

describe('the sample connectors report what they skipped', () => {
  it('give a result with every item and nothing skipped', async () => {
    for (const connector of sampleConnectors) {
      const result = await connector.fetchResult?.();
      expect(result, connector.chain.slug).toBeDefined();
      expect(result?.items).toHaveLength(15);
      expect(result?.skipped).toEqual([]);
      expect(await connector.fetchItems()).toEqual(result?.items);
    }
  });
});

describe('one bad item does not take the store down with it', () => {
  it('Walmart: a garbled price skips just that item, with its sku and the reason', async () => {
    const connector = createWalmartConnector(async () =>
      walmartSample.map((item, index) => (index === 2 ? { ...item, price: 'call us' } : item)),
    );
    const result = await connector.fetchResult?.();

    expect(result?.items).toHaveLength(14);
    expect(result?.items.some((item) => item.sku === 'W-2003')).toBe(false);
    expect(result?.skipped).toEqual([{ sku: 'W-2003', index: 2, reason: 'W-2003: Invalid price: "call us"' }]);
    expect(await connector.fetchItems()).toHaveLength(14);
  });

  it('Costco: a date in the wrong format skips just that item', async () => {
    const connector = createCostcoConnector(async () =>
      costcoSample.map((item) => (item.itemNumber === 'C-3002' ? { ...item, savingsStart: '10/14/2026' } : item)),
    );
    const result = await connector.fetchResult?.();

    expect(result?.items).toHaveLength(14);
    expect(result?.skipped).toHaveLength(1);
    expect(result?.skipped[0]?.sku).toBe('C-3002');
    expect(result?.skipped[0]?.reason).toMatch(/C-3002.*Invalid date/);
  });

  it('Costco: an item with no description is skipped and named', async () => {
    const connector = createCostcoConnector(async () =>
      costcoSample.map((item) => (item.itemNumber === 'C-3004' ? { ...item, description: '  ' } : item)),
    );
    const result = await connector.fetchResult?.();

    expect(result?.skipped).toEqual([{ sku: 'C-3004', index: 3, reason: 'Missing text: C-3004 description' }]);
  });

  it('Save-On-Foods: a sale price above the regular price is ignored, not an error', async () => {
    const connector = createSaveOnFoodsConnector(async () =>
      saveOnFoodsSample.map((item) => (item.sku === 'SOF-1002' ? { ...item, promoPrice: 99 } : item)),
    );
    const result = await connector.fetchResult?.();

    expect(result?.skipped).toEqual([]);
    expect(result?.items.find((item) => item.sku === 'SOF-1002')?.salePriceCents).toBeUndefined();
  });

  it('several problems at once are each reported, and the good items still go through', async () => {
    const connector = createWalmartConnector(async () =>
      walmartSample.map((item, index) => (index === 0 || index === 5 || index === 9 ? { ...item, price: 'x' } : item)),
    );
    const result = await connector.fetchResult?.();

    expect(result?.items).toHaveLength(12);
    expect(result?.skipped.map((entry) => entry.sku)).toEqual(['W-2001', 'W-2006', 'W-2010']);
  });

  it('a renamed field skips every item and names the first one', async () => {
    const renamed = saveOnFoodsSample.map((item) => {
      const { price, ...rest } = item;
      return { ...rest, cost: price } as unknown as (typeof saveOnFoodsSample)[number];
    });
    const result = await createSaveOnFoodsConnector(async () => renamed).fetchResult?.();

    expect(result?.items).toEqual([]);
    expect(result?.skipped).toHaveLength(15);
    expect(result?.skipped[0]).toMatchObject({ sku: 'SOF-1001', reason: 'Missing price: SOF-1001 price' });
  });

  it('every skipped reason names its sku', async () => {
    const connector = createWalmartConnector(async () =>
      walmartSample.map((item, index) =>
        index % 3 === 0 ? { ...item, price: 'free' } : index % 3 === 1 ? { ...item, name: ' ' } : item,
      ),
    );
    const result = await connector.fetchResult?.();

    expect(result?.skipped.length).toBeGreaterThan(5);
    for (const entry of result?.skipped ?? []) expect(entry.reason, entry.sku).toContain(entry.sku);
  });

  it('a null entry in the list is skipped by position', async () => {
    const connector = createWalmartConnector(async () => [
      ...walmartSample.slice(0, 2),
      null as unknown as (typeof walmartSample)[number],
    ]);
    const result = await connector.fetchResult?.();

    expect(result?.items).toHaveLength(2);
    expect(result?.skipped).toHaveLength(1);
    expect(result?.skipped[0]).toMatchObject({ sku: '(item 3, no sku)', index: 2 });
  });

  it('gives up loudly when the store does not return a list at all', async () => {
    const connector = createWalmartConnector(async () => null as unknown as typeof walmartSample);
    await expect(connector.fetchResult?.()).rejects.toThrow(/list of items.*got null/);
  });
});
