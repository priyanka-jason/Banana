import { describe, expect, it } from 'vitest';
import { createCostcoConnector } from '../connectors/costco';
import { createSaveOnFoodsConnector } from '../connectors/saveOnFoods';
import { walmartSample } from '../connectors/sample/walmart';
import type { StoreConnector } from '../connectors/types';
import { createWalmartConnector, type WalmartRawItem } from '../connectors/walmart';
import { MemoryFinal, MemoryStoreData } from '../db/memory';
import { runIngest } from './runIngest';

const T1 = () => new Date('2026-10-17T20:00:00.000Z');
const T2 = () => new Date('2026-10-17T21:00:00.000Z');
const T3 = () => new Date('2026-10-17T22:00:00.000Z');

function setup() {
  return { storeData: new MemoryStoreData(), final: new MemoryFinal() };
}

function walmartWith(items: WalmartRawItem[]): StoreConnector {
  return createWalmartConnector(async () => items);
}

function breakPrices(items: WalmartRawItem[], indexes: number[]): WalmartRawItem[] {
  return items.map((item, index) => (indexes.includes(index) ? { ...item, price: 'call us' } : item));
}

describe('a bad item is skipped, not the whole store', () => {
  it('saves the other items and reports the skipped one with its sku', async () => {
    const { storeData, final } = setup();
    const result = await runIngest({
      connectors: [walmartWith(breakPrices(walmartSample, [2]))],
      storeData,
      final,
    });

    expect(result.failures).toEqual([]);
    expect(result.scraped).toEqual([{ chainSlug: 'walmart', count: 14 }]);
    expect(result.skipped).toEqual([
      { chainSlug: 'walmart', sku: 'W-2003', index: 2, reason: 'W-2003: Invalid price: "call us"' },
    ]);
    expect(result.savedItems).toBe(14);
    const items = await final.listItems();
    expect(items).toHaveLength(14);
    expect(items.some((item) => item.sku === 'W-2003')).toBe(false);
  });

  it('still reports skipped items on a dry run, and saves nothing', async () => {
    const { storeData, final } = setup();
    const result = await runIngest({
      connectors: [walmartWith(breakPrices(walmartSample, [2]))],
      storeData,
      final,
      dryRun: true,
    });

    expect(result.skipped).toHaveLength(1);
    expect(result.savedStoreRecords).toBe(0);
    expect(await storeData.loadRecords('walmart')).toEqual([]);
  });

  it('works with a connector that only has fetchItems (nothing is skipped)', async () => {
    const { storeData, final } = setup();
    const plain: StoreConnector = {
      chain: { slug: 'plain', name: 'Plain', parentCompany: 'Plain Co', hasMemberPricing: false },
      fetchItems: async () => [{ sku: 'A', name: 'A', storeCategories: [], regularPriceCents: 100, original: {} }],
    };
    const result = await runIngest({ connectors: [plain], storeData, final });

    expect(result.skipped).toEqual([]);
    expect(result.savedItems).toBe(1);
  });
});

describe('an empty result is a failure', () => {
  it('fails a store that returns nothing, saves nothing, and says why', async () => {
    const { storeData, final } = setup();
    const result = await runIngest({ connectors: [walmartWith([])], storeData, final });

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({ chainSlug: 'walmart' });
    expect(result.failures[0]?.error).toMatch(/returned no items.*blocked us or changed its layout/);
    expect(result.scraped).toEqual([]);
    expect(result.chains).toEqual([]);
    expect(result.savedStoreRecords).toBe(0);
    expect(await final.listItems()).toEqual([]);
  });

  it('keeps what an earlier good run saved', async () => {
    const { storeData, final } = setup();
    await runIngest({ connectors: [walmartWith(walmartSample)], storeData, final, now: T1 });
    const result = await runIngest({ connectors: [walmartWith([])], storeData, final, now: T2 });

    expect(result.failures).toHaveLength(1);
    expect(await final.listItems()).toHaveLength(15);
    expect(await storeData.loadRecords('walmart')).toHaveLength(15);
  });

  it('fails a store where every item was bad, and shows the first problem', async () => {
    const { storeData, final } = setup();
    const everyIndex = walmartSample.map((_item, index) => index);
    const result = await runIngest({
      connectors: [walmartWith(breakPrices(walmartSample, everyIndex))],
      storeData,
      final,
    });

    expect(result.failures[0]?.error).toMatch(/all 15 items were skipped.*First problem: W-2001: Invalid price/);
    expect(result.skipped).toHaveLength(15);
    expect(result.savedItems).toBe(0);
  });

  it('does not stop the other stores', async () => {
    const { storeData, final } = setup();
    const result = await runIngest({
      connectors: [walmartWith([]), createSaveOnFoodsConnector(), createCostcoConnector()],
      storeData,
      final,
    });

    expect(result.failures.map((failure) => failure.chainSlug)).toEqual(['walmart']);
    expect(result.scraped.map((entry) => entry.chainSlug)).toEqual(['save-on-foods', 'costco']);
    expect(await final.listItems()).toHaveLength(30);
  });
});

describe('a sharp drop in item count is warned about', () => {
  async function runTwice(second: WalmartRawItem[], extra: { dropWarningRatio?: number } = {}) {
    const { storeData, final } = setup();
    await runIngest({ connectors: [walmartWith(walmartSample)], storeData, final, now: T1 });
    const result = await runIngest({ connectors: [walmartWith(second)], storeData, final, now: T2, ...extra });
    return { result, storeData };
  }

  it('warns when a store returns less than half of what it did last run, and still saves', async () => {
    const { result } = await runTwice(walmartSample.slice(0, 7));

    expect(result.warnings).toEqual([
      { chainSlug: 'walmart', message: 'only 7 items this time, down from 15 last run' },
    ]);
    expect(result.savedStoreRecords).toBe(7);
    expect(result.failures).toEqual([]);
  });

  it('does not warn for a smaller drop', async () => {
    expect((await runTwice(walmartSample.slice(0, 10))).result.warnings).toEqual([]);
    expect((await runTwice(walmartSample.slice(0, 8))).result.warnings).toEqual([]);
  });

  it('warns just past the half-way line', async () => {
    expect((await runTwice(walmartSample.slice(0, 7))).result.warnings).toHaveLength(1);
  });

  it('uses the ratio it is given', async () => {
    const { result } = await runTwice(walmartSample.slice(0, 10), { dropWarningRatio: 0.9 });
    expect(result.warnings).toEqual([
      { chainSlug: 'walmart', message: 'only 10 items this time, down from 15 last run' },
    ]);
  });

  it('does not warn on a first run', async () => {
    const { storeData, final } = setup();
    const result = await runIngest({ connectors: [walmartWith(walmartSample)], storeData, final });
    expect(result.warnings).toEqual([]);
  });

  it('does not warn when the earlier run was tiny', async () => {
    const { storeData, final } = setup();
    await runIngest({ connectors: [walmartWith(walmartSample.slice(0, 4))], storeData, final, now: T1 });
    const result = await runIngest({ connectors: [walmartWith(walmartSample.slice(0, 1))], storeData, final, now: T2 });
    expect(result.warnings).toEqual([]);
  });

  it('compares with the last run, not with everything ever saved', async () => {
    const { storeData, final } = setup();
    await runIngest({ connectors: [walmartWith(walmartSample)], storeData, final, now: T1 });
    const small = walmartSample.slice(0, 3);

    const second = await runIngest({ connectors: [walmartWith(small)], storeData, final, now: T2 });
    expect(second.warnings).toHaveLength(1);

    const third = await runIngest({ connectors: [walmartWith(small)], storeData, final, now: T3 });
    expect(third.warnings).toEqual([]);
  });
});

describe('mostly skipped items are warned about', () => {
  it('warns when half or more of a store was skipped', async () => {
    const { storeData, final } = setup();
    const result = await runIngest({
      connectors: [walmartWith(breakPrices(walmartSample.slice(0, 4), [0, 1, 2]))],
      storeData,
      final,
    });

    expect(result.scraped).toEqual([{ chainSlug: 'walmart', count: 1 }]);
    expect(result.warnings).toEqual([
      { chainSlug: 'walmart', message: "3 of 4 items were skipped, so the site's format may have changed" },
    ]);
  });

  it('does not warn when only a few were skipped', async () => {
    const { storeData, final } = setup();
    const result = await runIngest({
      connectors: [walmartWith(breakPrices(walmartSample, [4]))],
      storeData,
      final,
    });

    expect(result.skipped).toHaveLength(1);
    expect(result.warnings).toEqual([]);
  });
});
