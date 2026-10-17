import { describe, expect, it } from 'vitest';
import { sampleConnectors } from '../connectors';
import type { StoreConnector } from '../connectors/types';
import { MemoryFinal, MemoryStoreData } from '../db/memory';
import type { Chain, RawItem } from '../types';
import { runIngest } from './runIngest';

const NOW = new Date('2026-10-17T20:00:00.000Z');

function setup() {
  return { storeData: new MemoryStoreData(), final: new MemoryFinal() };
}

const testChain: Chain = { slug: 'test-chain', name: 'Test Chain', parentCompany: 'Test Co', hasMemberPricing: false };

function connectorReturning(items: RawItem[]): StoreConnector {
  return { chain: testChain, fetchItems: async () => items };
}

describe('runIngest', () => {
  it('runs connectors -> per-store layer -> combine -> final layer', async () => {
    const { storeData, final } = setup();
    const result = await runIngest({ connectors: sampleConnectors, storeData, final, now: () => NOW });

    expect(result.scraped).toEqual([
      { chainSlug: 'save-on-foods', count: 15 },
      { chainSlug: 'walmart', count: 15 },
      { chainSlug: 'costco', count: 15 },
    ]);
    expect(result.failures).toEqual([]);
    expect(result.savedStoreRecords).toBe(45);
    expect(result.savedItems).toBe(45);
    expect(result.combine.rejected).toEqual([]);

    expect(await storeData.loadRecords('walmart')).toHaveLength(15);
    expect(await final.listItems()).toHaveLength(45);
    expect((await final.listChains()).map((chain) => chain.slug).sort()).toEqual(['costco', 'save-on-foods', 'walmart']);
    expect(await final.listLocations()).toHaveLength(6);
  });

  it("saves the store's original data in its own field, apart from the cleaned item", async () => {
    const { storeData, final } = setup();
    const result = await runIngest({ connectors: sampleConnectors, storeData, final });

    expect(result.missingOriginal).toBe(0);
    const record = (await storeData.loadRecords('walmart')).find((candidate) => candidate.sku === 'W-2002');
    expect(record?.original).toMatchObject({ price: '$5.47', wasPrice: '$5.97' });
    expect(record?.payload).not.toHaveProperty('original');
    expect(record?.payload).toMatchObject({ regularPriceCents: 597, salePriceCents: 547 });
  });

  it('counts items that came without original data, and still saves them', async () => {
    const { storeData, final } = setup();
    const withOriginal: RawItem = { sku: 'A', name: 'A', storeCategories: [], regularPriceCents: 100, original: { raw: true } };
    const without: RawItem = { sku: 'B', name: 'B', storeCategories: [], regularPriceCents: 100 };
    const result = await runIngest({ connectors: [connectorReturning([withOriginal, without])], storeData, final });

    expect(result.missingOriginal).toBe(1);
    expect(result.savedItems).toBe(2);
  });

  it('does not put the original data into the final layer', async () => {
    const { storeData, final } = setup();
    await runIngest({ connectors: sampleConnectors, storeData, final });
    expect((await final.listItems()).some((item) => 'original' in item)).toBe(false);
  });

  it('stamps everything with the time it was given', async () => {
    const { storeData, final } = setup();
    await runIngest({ connectors: sampleConnectors, storeData, final, now: () => NOW });

    const records = await storeData.loadRecords('costco');
    expect(records.every((record) => record.scrapedAt === NOW.toISOString())).toBe(true);
    expect((await final.listItems()).every((item) => item.scrapedAt === NOW.toISOString())).toBe(true);
  });

  it('can run twice without duplicating anything', async () => {
    const { storeData, final } = setup();
    await runIngest({ connectors: sampleConnectors, storeData, final });
    await runIngest({ connectors: sampleConnectors, storeData, final });

    expect(await storeData.loadRecords('walmart')).toHaveLength(15);
    expect(await final.listItems()).toHaveLength(45);
  });

  it('saves nothing on a dry run but still reports what it would do', async () => {
    const { storeData, final } = setup();
    const result = await runIngest({ connectors: sampleConnectors, storeData, final, dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.combine.items).toHaveLength(45);
    expect(result.savedStoreRecords).toBe(0);
    expect(result.savedItems).toBe(0);
    expect(await storeData.loadRecords('walmart')).toEqual([]);
    expect(await final.listItems()).toEqual([]);
    expect(await final.listLocations()).toEqual([]);
  });

  it('can run just one chain', async () => {
    const { storeData, final } = setup();
    const result = await runIngest({ connectors: sampleConnectors, storeData, final, chainSlug: 'walmart' });

    expect(result.scraped).toEqual([{ chainSlug: 'walmart', count: 15 }]);
    expect(await storeData.loadRecords('costco')).toEqual([]);
    expect((await final.listItems()).every((item) => item.chainSlug === 'walmart')).toBe(true);
  });

  it('says which chains exist when asked for one that does not', async () => {
    const { storeData, final } = setup();
    await expect(
      runIngest({ connectors: sampleConnectors, storeData, final, chainSlug: 'no-frills' }),
    ).rejects.toThrow(/No connector for chain "no-frills".*save-on-foods, walmart, costco/);
  });

  it('reports a connector that fails and still runs the others', async () => {
    const { storeData, final } = setup();
    const broken: StoreConnector = {
      chain: testChain,
      fetchItems: async () => {
        throw new Error('site is down');
      },
    };
    const result = await runIngest({ connectors: [broken, ...sampleConnectors], storeData, final });

    expect(result.failures).toEqual([{ chainSlug: 'test-chain', error: 'site is down' }]);
    expect(result.scraped).toHaveLength(3);
    expect(await final.listItems()).toHaveLength(45);
  });

  it('reports a failing locations lookup but still saves the items', async () => {
    const { storeData, final } = setup();
    const connector: StoreConnector = {
      chain: testChain,
      fetchItems: async () => [{ sku: 'A', name: 'A', storeCategories: ['Pantry'], regularPriceCents: 100 }],
      fetchLocations: async () => {
        throw new Error('locations are down');
      },
    };
    const result = await runIngest({ connectors: [connector], storeData, final });

    expect(result.failures).toEqual([{ chainSlug: 'test-chain', error: 'locations: locations are down' }]);
    expect(result.savedItems).toBe(1);
  });

  it('rejects a bad item, reports it, and still saves the good ones', async () => {
    const { storeData, final } = setup();
    const good: RawItem = { sku: 'GOOD', name: 'Good', storeCategories: ['Pantry'], regularPriceCents: 100 };
    const bad: RawItem = { ...good, sku: 'BAD', name: 'Bad', salePriceCents: 500 }; // sale price above regular
    const result = await runIngest({ connectors: [connectorReturning([good, bad])], storeData, final });

    expect(result.savedStoreRecords).toBe(2);
    expect(result.savedItems).toBe(1);
    expect(result.combine.rejected).toEqual([
      { chainSlug: 'test-chain', sku: 'BAD', reason: expect.stringMatching(/salePriceCents must be lower/) },
    ]);
    expect((await final.listItems()).map((item) => item.sku)).toEqual(['GOOD']);
  });

  it("combines from what the per-store layer holds, including items saved earlier", async () => {
    const { storeData, final } = setup();
    const first: RawItem = { sku: 'A', name: 'First', storeCategories: ['Pantry'], regularPriceCents: 100 };
    const second: RawItem = { sku: 'B', name: 'Second', storeCategories: ['Pantry'], regularPriceCents: 200 };

    await runIngest({ connectors: [connectorReturning([first])], storeData, final });
    await runIngest({ connectors: [connectorReturning([second])], storeData, final });

    expect((await final.listItems()).map((item) => item.sku)).toEqual(['A', 'B']);
  });
});
