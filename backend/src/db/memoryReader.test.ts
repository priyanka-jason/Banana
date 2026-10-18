import { describe, expect, it } from 'vitest';
import { sampleConnectors } from '../connectors';
import { runIngest } from '../pipeline/runIngest';
import { searchFinal } from '../search/search';
import { MemoryFinal, MemoryStoreData } from './memory';
import { MemoryPriceRepository } from './memoryReader';

const NOW = new Date('2026-10-17T20:00:00.000Z');
const SHOPPER = { lat: 49.28, lng: -123.12 };

async function ingested() {
  const final = new MemoryFinal();
  await runIngest({ connectors: sampleConnectors, storeData: new MemoryStoreData(), final, now: () => NOW });
  return { final, repo: new MemoryPriceRepository(final) };
}

describe('MemoryPriceRepository', () => {
  it('searches what the final layer holds, with the same rules as searchFinal', async () => {
    const { final, repo } = await ingested();
    const filters = { query: 'milk', memberPricing: 'member', sortBy: 'unitPrice' } as const;
    const expected = searchFinal(
      { items: await final.listItems(), chains: await final.listChains(), locations: await final.listLocations() },
      filters,
    );

    expect(await repo.searchPrices(filters)).toEqual(expected);
    expect((await repo.searchPrices(filters)).total).toBe(3);
  });

  it('returns everything with no filters', async () => {
    const { repo } = await ingested();
    expect((await repo.searchPrices()).total).toBe(45);
  });

  it('sees data saved after the repository was created', async () => {
    const final = new MemoryFinal();
    const repo = new MemoryPriceRepository(final);
    expect((await repo.searchPrices()).total).toBe(0);

    await runIngest({ connectors: sampleConnectors, storeData: new MemoryStoreData(), final, now: () => NOW });
    expect((await repo.searchPrices()).total).toBe(45);
  });

  it('gets items by id, in the order asked for, with member pricing', async () => {
    const { repo } = await ingested();
    const rows = await repo.getItems(['costco:C-3009', 'nope', 'save-on-foods:SOF-1009'], { memberPricing: 'member' });

    expect(rows.map((row) => row.id)).toEqual(['costco:C-3009', 'save-on-foods:SOF-1009']);
    expect(rows[1]?.priceCents).toBe(449);
  });

  it('lists the chains by name', async () => {
    const { repo } = await ingested();
    expect((await repo.listChains()).map((chain) => chain.slug)).toEqual(['costco', 'save-on-foods', 'walmart']);
  });

  it('lists all store locations by id, or just some chains', async () => {
    const { repo } = await ingested();

    expect((await repo.listStoreLocations()).map((store) => store.id)).toEqual([
      'costco-sample-1',
      'costco-sample-2',
      'save-on-foods-sample-1',
      'save-on-foods-sample-2',
      'walmart-sample-1',
      'walmart-sample-2',
    ]);
    expect((await repo.listStoreLocations({ chainSlugs: ['walmart'] })).map((store) => store.id)).toEqual([
      'walmart-sample-1',
      'walmart-sample-2',
    ]);
    expect(await repo.listStoreLocations({ chainSlugs: [] })).toHaveLength(6);
    expect(await repo.listStoreLocations({ chainSlugs: ['no-such-chain'] })).toEqual([]);
  });

  it('finds stores near a point, nearest first', async () => {
    const { repo } = await ingested();
    const stores = await repo.storesWithinRadius(SHOPPER.lat, SHOPPER.lng, 10);

    expect(stores.map((store) => store.id)).toEqual(['save-on-foods-sample-1', 'costco-sample-1']);
    expect(stores[0]?.distanceKm).toBe(0.3);
  });

  it('does not reorder the final layer when listing chains', async () => {
    const { final, repo } = await ingested();
    const before = (await final.listChains()).map((chain) => chain.slug);
    await repo.listChains();
    expect((await final.listChains()).map((chain) => chain.slug)).toEqual(before);
  });
});
