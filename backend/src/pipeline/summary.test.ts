import { describe, expect, it } from 'vitest';
import { sampleConnectors } from '../connectors';
import type { StoreConnector } from '../connectors/types';
import { MemoryFinal, MemoryStoreData } from '../db/memory';
import { runIngest } from './runIngest';
import { formatIngestSummary } from './summary';

async function ingest(connectors: StoreConnector[], dryRun = false) {
  return runIngest({ connectors, storeData: new MemoryStoreData(), final: new MemoryFinal(), dryRun });
}

describe('formatIngestSummary', () => {
  it('reports what was fetched, saved and combined', async () => {
    const text = formatIngestSummary(await ingest(sampleConnectors));

    expect(text).toContain('Fetched:');
    expect(text).toContain('Save-On-Foods: 15 items');
    expect(text).toContain('Walmart: 15 items');
    expect(text).toContain('Costco: 15 items');
    expect(text).toContain('Saved: 45 per-store records, 45 final items');
    expect(text).toContain('Combined: 45 items, 0 rejected');
    expect(text).not.toContain('dry run');
  });

  it('says plainly when it was a dry run and leaves out the saved line', async () => {
    const text = formatIngestSummary(await ingest(sampleConnectors, true));

    expect(text).toContain('Ingest (dry run: nothing was saved)');
    expect(text).not.toContain('Saved:');
  });

  it('shows rows the way a non-member would see them, with discount and unit price', async () => {
    const text = formatIngestSummary(await ingest(sampleConnectors), { sampleRows: 100 });

    expect(text).toContain(
      'save-on-foods:SOF-1002  Gala Apples 1.36 kg Bag  $4.99 (was $5.99, -17%)  36.69¢/100g  [fruits]',
    );
    expect(text).toContain('save-on-foods:SOF-1015  Paper Towels 6 Rolls  $8.99 (was $10.99, -18%)  149.83¢ each  [household]');
  });

  it('shows no rows when asked for none', async () => {
    expect(formatIngestSummary(await ingest(sampleConnectors), { sampleRows: 0 })).not.toContain('Sample rows');
  });

  it('lists categories that were guessed so a person can review them', async () => {
    const text = formatIngestSummary(await ingest(sampleConnectors));
    expect(text).toMatch(/Categories guessed from keywords \(\d+\), please review:/);
    expect(text).toContain('save-on-foods: Produce > Fruit -> fruits');
  });

  it('lists rejected items and failed connectors', async () => {
    const connectors: StoreConnector[] = [
      {
        chain: { slug: 'test-chain', name: 'Test Chain', parentCompany: 'Test Co', hasMemberPricing: false },
        fetchItems: async () => [
          { sku: 'BAD', name: 'Bad', storeCategories: [], regularPriceCents: 100, salePriceCents: 900 },
        ],
      },
      {
        chain: { slug: 'down-chain', name: 'Down Chain', parentCompany: 'Down Co', hasMemberPricing: false },
        fetchItems: async () => {
          throw new Error('site is down');
        },
      },
    ];
    const text = formatIngestSummary(await ingest(connectors));

    expect(text).toContain('down-chain: FAILED - site is down');
    expect(text).toContain('Combined: 0 items, 1 rejected');
    expect(text).toContain('rejected test-chain:BAD: Invalid item "BAD": salePriceCents must be lower than regularPriceCents');
  });

  it('lists categories with no match so they can be added to the map', async () => {
    const connectors: StoreConnector[] = [
      {
        chain: { slug: 'test-chain', name: 'Test Chain', parentCompany: 'Test Co', hasMemberPricing: false },
        fetchItems: async () => [{ sku: 'A', name: 'A', storeCategories: ['Mystery aisle'], regularPriceCents: 100 }],
      },
    ];
    const text = formatIngestSummary(await ingest(connectors));

    expect(text).toMatch(/Categories with no match \(1\), add to CATEGORY_MAP:/);
    expect(text).toContain('test-chain: Mystery aisle -> other');
  });
});
