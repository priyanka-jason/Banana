import { beforeAll, describe, expect, it } from 'vitest';
import type { MemoryPriceRepository } from '../db/memoryReader';
import { loadSimulated } from '../simulated/exportData';
import { handleNearbyStores, handleSearch } from './handlers';
import {
  STORE_RADIUS_SLIDER_KM,
  clampRadiusKm,
  nearbyStoresBody,
  roundCoordinate,
  storeSelectionFilters,
} from './storeChoice';
import type { NearbyStoresResponseBody, SearchResponseBody } from './types';

/** New Westminster: 3 chains have a store within 5 km, all 5 within 10 km. */
const SHOPPER = { lat: 49.2004321, lng: -122.9101234 };

describe('storeSelectionFilters', () => {
  it('has a 1 to 10 km slider in 1 km steps, starting at 5', () => {
    expect(STORE_RADIUS_SLIDER_KM).toEqual({ min: 1, max: 10, step: 1, default: 5 });
  });

  it('keeps a slider value on a whole km between 1 and 10', () => {
    expect([1, 3, 7.4, 7.6, 10].map(clampRadiusKm)).toEqual([1, 3, 7, 8, 10]);
    expect([0, 0.2, -4, 10.4, 25, 200].map(clampRadiusKm)).toEqual([1, 1, 1, 10, 10, 10]);
    expect([Number.NaN, Number.POSITIVE_INFINITY].map(clampRadiusKm)).toEqual([5, 5]);
  });

  it('sends the clamped radius', () => {
    expect(storeSelectionFilters({ where: { kind: 'nearby', ...SHOPPER, radiusKm: 30 } }).near?.radiusKm).toBe(10);
    expect(nearbyStoresBody({ kind: 'nearby', ...SHOPPER, radiusKm: 0.3 }).radiusKm).toBe(1);
  });

  it('adds nothing for any store', () => {
    expect(storeSelectionFilters({ where: { kind: 'any' } })).toEqual({});
    expect(storeSelectionFilters({ where: { kind: 'any' }, chainSlugs: [] })).toEqual({});
  });

  it('sends picked stores as locationIds, and an empty pick as no filter', () => {
    expect(storeSelectionFilters({ where: { kind: 'stores', locationIds: ['a', 'b'] } })).toEqual({ locationIds: ['a', 'b'] });
    expect(storeSelectionFilters({ where: { kind: 'stores', locationIds: [] } })).toEqual({});
  });

  it('sends a nearby choice as near, with the location rounded to 2 decimals', () => {
    expect(storeSelectionFilters({ where: { kind: 'nearby', ...SHOPPER, radiusKm: 10 }, chainSlugs: ['walmart'] })).toEqual({
      chainSlugs: ['walmart'],
      near: { lat: 49.2, lng: -122.91, radiusKm: 10 },
    });
    expect(roundCoordinate(-123.125)).toBe(-123.12);
  });

  it('builds the nearby-stores body with the chains, rounded', () => {
    expect(nearbyStoresBody({ kind: 'nearby', ...SHOPPER, radiusKm: 5 }, ['costco'])).toEqual({
      lat: 49.2,
      lng: -122.91,
      radiusKm: 5,
      chainSlugs: ['costco'],
    });
    expect(nearbyStoresBody({ kind: 'nearby', ...SHOPPER, radiusKm: 5 }, [])).toEqual({ lat: 49.2, lng: -122.91, radiusKm: 5 });
  });
});

describe('store choices through the handlers, on the simulated chains', () => {
  let repo: MemoryPriceRepository;
  beforeAll(async () => {
    repo = await loadSimulated();
  });

  async function search(body: Record<string, unknown>): Promise<SearchResponseBody> {
    const response = await handleSearch(repo, { limit: 100, ...body });
    expect(response.status).toBe(200);
    return response.body as SearchResponseBody;
  }

  async function nearby(body: unknown): Promise<NearbyStoresResponseBody> {
    const response = await handleNearbyStores(repo, body);
    expect(response.status).toBe(200);
    return response.body as NearbyStoresResponseBody;
  }

  const chainsOf = (rows: Array<{ chainSlug: string }>): string[] => [...new Set(rows.map((row) => row.chainSlug))].sort();

  it('finds more stores and chains within 10 km than within 5 km', async () => {
    const within5 = await search({ query: 'milk', ...storeSelectionFilters({ where: { kind: 'nearby', ...SHOPPER, radiusKm: 5 } }) });
    const within10 = await search({ query: 'milk', ...storeSelectionFilters({ where: { kind: 'nearby', ...SHOPPER, radiusKm: 10 } }) });

    expect(chainsOf(within5.rows)).toEqual(['costco', 'no-frills', 'real-canadian-superstore']);
    expect(chainsOf(within10.rows)).toEqual(['costco', 'no-frills', 'real-canadian-superstore', 'save-on-foods', 'walmart']);
    expect(within5.rows.every((row) => row.distanceKm !== undefined && row.distanceKm <= 5)).toBe(true);
    expect(within10.rows.every((row) => row.distanceKm !== undefined && row.distanceKm <= 10)).toBe(true);
  });

  it('agrees with the nearby-stores list: a chain shows up when one of its stores is in range', async () => {
    const { min, max, step } = STORE_RADIUS_SLIDER_KM;
    for (let radiusKm = min; radiusKm <= max; radiusKm += step) {
      const where = { kind: 'nearby' as const, ...SHOPPER, radiusKm };
      const stores = (await nearby(nearbyStoresBody(where))).stores;
      const rows = (await search({ query: 'bananas', ...storeSelectionFilters({ where }) })).rows;
      expect(chainsOf(rows), `${radiusKm} km`).toEqual(chainsOf(stores));
      for (const row of rows) {
        const nearest = Math.min(...stores.filter((store) => store.chainSlug === row.chainSlug).map((store) => store.distanceKm));
        expect(row.distanceKm).toBe(nearest);
      }
    }
  });

  it('narrows a radius to one chain, in both the store list and the search', async () => {
    const where = { kind: 'nearby' as const, ...SHOPPER, radiusKm: 10 };
    const stores = (await nearby(nearbyStoresBody(where, ['walmart']))).stores;
    expect(stores.length).toBeGreaterThan(0);
    expect(stores.every((store) => store.chainSlug === 'walmart' && store.distanceKm <= 10)).toBe(true);

    const rows = (await search(storeSelectionFilters({ where, chainSlugs: ['walmart'] }))).rows;
    expect(rows.length).toBeGreaterThan(0);
    expect(chainsOf(rows)).toEqual(['walmart']);
  });

  it('finds nothing when the chosen chain has no store in range', async () => {
    const where = { kind: 'nearby' as const, ...SHOPPER, radiusKm: 5 };
    expect((await nearby(nearbyStoresBody(where, ['walmart']))).stores).toEqual([]);
    expect((await search(storeSelectionFilters({ where, chainSlugs: ['walmart'] }))).total).toBe(0);
  });

  it('searches specific picked stores, and only their chains', async () => {
    const picked = (await nearby({ ...SHOPPER, radiusKm: 10, chainSlugs: ['costco', 'save-on-foods'] })).stores;
    const locationIds = picked.slice(0, 2).map((store) => store.id);
    const rows = (await search(storeSelectionFilters({ where: { kind: 'stores', locationIds } }))).rows;

    expect(rows.length).toBeGreaterThan(0);
    expect(chainsOf(rows)).toEqual(chainsOf(picked.slice(0, 2)));
  });

  it('searches one chain anywhere', async () => {
    const rows = (await search(storeSelectionFilters({ where: { kind: 'any' }, chainSlugs: ['costco'] }))).rows;
    expect(rows.length).toBeGreaterThan(0);
    expect(chainsOf(rows)).toEqual(['costco']);
  });

  it('rejects bad chain lists in the nearby body, and never repeats the location', async () => {
    const response = await handleNearbyStores(repo, { lat: 49.2004321, lng: -122.91, radiusKm: 5, chainSlugs: 'walmart' });
    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body)).toContain('"field":"chainSlugs"');
    expect(JSON.stringify(response.body)).not.toContain('49.2004321');
  });
});
