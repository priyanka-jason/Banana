import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MemoryFinal, MemoryStoreData } from '../db/memory';
import { runIngest } from '../pipeline/runIngest';
import { parseSize } from '../units';
import { CATALOG } from './catalog';
import { AREAS, SIMULATED_CHAINS } from './chains';
import { SIMULATED_TIME, buildSimulatedFiles, loadSimulated } from './exportData';
import {
  SIMULATED_CATEGORY_MAP,
  roundToEnding,
  simulatedConnectors,
  simulatedItemsFor,
  simulatedLocationsFor,
} from './generate';

async function ingest() {
  const final = new MemoryFinal();
  const result = await runIngest({
    connectors: simulatedConnectors,
    storeData: new MemoryStoreData(),
    final,
    categoryMap: SIMULATED_CATEGORY_MAP,
    now: () => SIMULATED_TIME,
  });
  return { result, final };
}

describe('simulated catalog', () => {
  it('has unique keys and sizes the parser can read', () => {
    expect(new Set(CATALOG.map((p) => p.key)).size).toBe(CATALOG.length);
    for (const product of CATALOG) {
      for (const size of [product.size, product.costco?.size]) {
        if (size !== undefined) expect(parseSize(size), `${product.key}: "${size}"`).toBeDefined();
      }
    }
  });

  it('puts each aisle in exactly one shared category', () => {
    const seen = new Map<string, string>();
    for (const product of CATALOG) {
      const before = seen.get(product.aisle);
      if (before !== undefined) expect(before, product.aisle).toBe(product.category);
      seen.set(product.aisle, product.category);
    }
  });
});

describe('simulated chains', () => {
  it('has unique chain slugs and store ids, all inside the Lower Mainland', () => {
    expect(new Set(SIMULATED_CHAINS.map((c) => c.chain.slug)).size).toBe(SIMULATED_CHAINS.length);
    const locations = SIMULATED_CHAINS.flatMap(simulatedLocationsFor);
    expect(new Set(locations.map((l) => l.id)).size).toBe(locations.length);
    for (const location of locations) {
      expect(location.lat).toBeGreaterThan(49.0);
      expect(location.lat).toBeLessThan(49.4);
      expect(location.lng).toBeGreaterThan(-123.3);
      expect(location.lng).toBeLessThan(-122.5);
      expect(location.name).toContain('simulated');
    }
  });

  it('only uses known areas', () => {
    for (const profile of SIMULATED_CHAINS) for (const area of profile.areas) expect(AREAS[area]).toBeDefined();
  });
});

describe('roundToEnding', () => {
  it('picks the nearest price with one of the chain’s endings', () => {
    expect(roundToEnding(612, [97, 47])).toBe(597);
    expect(roundToEnding(630, [97, 47])).toBe(647);
    expect(roundToEnding(84, [99, 49])).toBe(99);
    expect(roundToEnding(30, [99, 49])).toBe(49);
  });
});

describe('simulated items', () => {
  it('stays at 500 items or fewer across all chains, and every chain has some', () => {
    const counts = SIMULATED_CHAINS.map((profile) => simulatedItemsFor(profile).length);
    for (const count of counts) expect(count).toBeGreaterThan(20);
    expect(counts.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(500);
  });

  it('is the same every time', () => {
    for (const profile of SIMULATED_CHAINS) expect(simulatedItemsFor(profile)).toEqual(simulatedItemsFor(profile));
  });

  it('has believable prices: sales below regular, member prices below what others pay', () => {
    for (const profile of SIMULATED_CHAINS) {
      for (const item of simulatedItemsFor(profile)) {
        expect(Number.isInteger(item.regularCents) && item.regularCents > 0).toBe(true);
        if (item.saleCents !== undefined) {
          expect(item.saleCents).toBeLessThan(item.regularCents);
          expect(item.saleEnd).toBeDefined();
        }
        if (item.memberCents !== undefined) {
          expect(profile.chain.hasMemberPricing).toBe(true);
          expect(item.memberCents).toBeLessThan(item.saleCents ?? item.regularCents);
        }
      }
    }
  });

  it('has bananas at every chain, so a "bananas" search compares them all', () => {
    for (const profile of SIMULATED_CHAINS) {
      expect(simulatedItemsFor(profile).map((item) => item.sku)).toContain('sim-bananas');
    }
  });
});

describe('simulated data through the pipeline', () => {
  it('goes through cleanly: nothing failed, skipped, rejected, guessed or unreadable', async () => {
    const { result } = await ingest();
    expect(result.failures).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.missingOriginal).toBe(0);
    expect(result.combine.rejected).toEqual([]);
    expect(result.combine.guessedCategories).toEqual([]);
    expect(result.combine.unmappedCategories).toEqual([]);
    expect(result.combine.unreadableSizes).toEqual([]);
    expect(result.savedItems).toBeLessThanOrEqual(500);
  });

  it('covers Save-On-Foods, Walmart and Costco only', async () => {
    const { result } = await ingest();
    expect(result.chains.map((chain) => chain.slug)).toEqual(['save-on-foods', 'walmart', 'costco']);
  });

  it('has one price per chain: every store of a chain shows the same prices', async () => {
    const { final } = await ingest();
    expect((await final.listItems()).every((item) => item.locationId === undefined)).toBe(true);

    const repo = await loadSimulated();
    for (const profile of SIMULATED_CHAINS) {
      const stores = simulatedLocationsFor(profile);
      expect(stores.length).toBeGreaterThan(1);
      const pricesAt = async (storeId: string) =>
        (await repo.searchPrices({ locationIds: [storeId], limit: 100 })).rows.map((row) => [row.id, row.priceCents]);
      const first = await pricesAt(stores[0]!.id);
      expect(first.length).toBeGreaterThan(0);
      for (const store of stores.slice(1)) expect(await pricesAt(store.id), store.id).toEqual(first);
    }
  });

  it('can be searched by category and sorted', async () => {
    const repo = await loadSimulated();
    const meat = await repo.searchPrices({ categories: ['meat'], limit: 100 });
    expect(meat.total).toBeGreaterThan(0);
    expect(meat.rows.every((row) => row.category === 'meat')).toBe(true);

    const prices = meat.rows.map((row) => row.priceCents);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('finds the nearest stores to Mount Pleasant', async () => {
    const repo = await loadSimulated();
    const nearby = await repo.storesWithinRadius(49.2635, -123.1005, 5);
    expect(nearby.length).toBeGreaterThan(3);
    expect(nearby.every((store) => store.distanceKm <= 5)).toBe(true);
  });
});

describe('docs/simulated files', () => {
  it('match what the code builds (run `npm run simulate` after changing the data)', async () => {
    const directory = fileURLToPath(new URL('../../docs/simulated/', import.meta.url));
    const files = await buildSimulatedFiles();
    expect(readdirSync(directory).sort()).toEqual(Object.keys(files).sort());
    for (const [name, body] of Object.entries(files)) {
      expect(JSON.parse(readFileSync(`${directory}${name}`, 'utf8')), name).toEqual(JSON.parse(JSON.stringify(body)));
    }
  });
});
