import { describe, expect, it } from 'vitest';
import { createBackend } from './app';

describe('createBackend', () => {
  it('loads the simulated chains by default', async () => {
    const { prices, ingest } = await createBackend();
    expect(ingest.failures).toEqual([]);
    expect(await prices.listChains()).toHaveLength(5);
    expect((await prices.searchPrices()).total).toBe(283);
    expect(await prices.listStoreLocations()).toHaveLength(37);
  });

  it('loads the small sample set when asked', async () => {
    const { prices, ingest } = await createBackend({ source: 'sample' });
    expect(ingest.failures).toEqual([]);
    const slugs = (await prices.listChains()).map((chain) => chain.slug);
    expect(slugs).toEqual(expect.arrayContaining(['walmart', 'costco']));
    expect((await prices.searchPrices()).total).toBeGreaterThan(0);
  });
});
