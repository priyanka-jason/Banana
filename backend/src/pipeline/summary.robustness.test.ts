import { describe, expect, it } from 'vitest';
import { walmartSample } from '../connectors/sample/walmart';
import type { StoreConnector } from '../connectors/types';
import { createWalmartConnector } from '../connectors/walmart';
import { MemoryFinal, MemoryStoreData } from '../db/memory';
import { runIngest } from './runIngest';
import { formatIngestSummary } from './summary';

const T1 = () => new Date('2026-10-17T20:00:00.000Z');
const T2 = () => new Date('2026-10-17T21:00:00.000Z');

describe('formatIngestSummary shows trouble clearly', () => {
  it('lists warnings and skipped items, with the sku on every line', async () => {
    const storeData = new MemoryStoreData();
    const final = new MemoryFinal();
    await runIngest({ connectors: [createWalmartConnector()], storeData, final, now: T1 });

    // 7 items come back this time, and one of them has a garbled price.
    const partial = walmartSample.slice(0, 7).map((item, index) => (index === 2 ? { ...item, price: 'call us' } : item));
    const result = await runIngest({ connectors: [createWalmartConnector(async () => partial)], storeData, final, now: T2 });
    const text = formatIngestSummary(result, { sampleRows: 0 });

    expect(text).toContain('Walmart: 6 items (1 skipped)');
    expect(text).toContain('Warnings:');
    expect(text).toContain('walmart: only 6 items this time, down from 15 last run');
    expect(text).toContain('Skipped items (1), left out so the rest could go through:');
    expect(text).toContain('walmart: W-2003: Invalid price: "call us"');
  });

  it('shows an empty store as FAILED with the reason', async () => {
    const result = await runIngest({
      connectors: [createWalmartConnector(async () => [])],
      storeData: new MemoryStoreData(),
      final: new MemoryFinal(),
    });
    expect(formatIngestSummary(result)).toContain(
      'walmart: FAILED - returned no items (the site may have blocked us or changed its layout)',
    );
  });

  it('adds the sku to a skipped reason that does not name it', async () => {
    const connector: StoreConnector = {
      chain: { slug: 'test-chain', name: 'Test Chain', parentCompany: 'Test Co', hasMemberPricing: false },
      fetchItems: async () => [],
      fetchResult: async () => ({
        items: [{ sku: 'GOOD', name: 'Good', storeCategories: ['Pantry'], regularPriceCents: 100, original: {} }],
        skipped: [{ sku: 'Z-9', index: 1, reason: 'something odd' }],
      }),
    };
    const result = await runIngest({ connectors: [connector], storeData: new MemoryStoreData(), final: new MemoryFinal() });

    expect(formatIngestSummary(result)).toContain('test-chain: Z-9: something odd');
  });

  it('says nothing about warnings or skipped items on a clean run', async () => {
    const result = await runIngest({
      connectors: [createWalmartConnector()],
      storeData: new MemoryStoreData(),
      final: new MemoryFinal(),
    });
    const text = formatIngestSummary(result);

    expect(text).not.toContain('Warnings:');
    expect(text).not.toContain('Skipped items');
    expect(text).not.toContain('skipped)');
    expect(text).not.toContain('FAILED');
  });
});
