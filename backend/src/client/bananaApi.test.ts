import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBackend } from '../app';
import { startServer, type RunningServer } from '../server/server';
import type { PriceRow } from '../types';
import {
  BananaApiError,
  createBananaApi,
  formatUnitPrice,
  searchBody,
  toBackendChainSlug,
  toWebsiteStoreId,
  type ApiPriceRow,
  type BananaApi,
} from './bananaApi';

// The connector's copy of the row type must accept what the API really sends.
const _rowsFit = (row: PriceRow): ApiPriceRow => row;
void _rowsFit;

let running: RunningServer;
let api: BananaApi;
const MOUNT_PLEASANT = { latitude: 49.262, longitude: -123.105 };

beforeAll(async () => {
  const { prices } = await createBackend({ source: 'simulated', now: () => new Date('2026-10-17T13:00:00.000Z') });
  running = await startServer({ prices, port: 0, logger: { request: () => undefined, error: () => undefined } });
  api = createBananaApi({ baseUrl: running.url });
});

afterAll(async () => {
  await running.close();
});

describe('conversions', () => {
  it('maps Superstore between the website and the API, and leaves the rest alone', () => {
    expect(toWebsiteStoreId('real-canadian-superstore')).toBe('superstore');
    expect(toBackendChainSlug('superstore')).toBe('real-canadian-superstore');
    expect(toWebsiteStoreId('no-frills')).toBe('no-frills');
  });

  it('formats unit prices like the design', () => {
    expect(formatUnitPrice({ comparableUnitPrice: { per: '100g', cents: 25.6 }, sizeUnit: 'lb' })).toBe('$1.16/lb');
    expect(formatUnitPrice({ comparableUnitPrice: { per: '100g', cents: 25.6 }, sizeUnit: 'kg' })).toBe('$2.56/kg');
    expect(formatUnitPrice({ comparableUnitPrice: { per: '100ml', cents: 26 } })).toBe('$2.60/L');
    expect(formatUnitPrice({ comparableUnitPrice: { per: 'each', cents: 79.8 } })).toBe('$0.80 each');
    expect(formatUnitPrice({})).toBe('');
  });

  it('builds search bodies with the location rounded and only in the body', () => {
    expect(
      searchBody({
        query: ' milk ',
        category: 'dairy-eggs',
        store: 'superstore',
        discountsOnly: true,
        sort: 'price-desc',
        origin: { latitude: 49.2621234, longitude: -123.1054321 },
        radiusKm: 5,
      }),
    ).toEqual({
      query: 'milk',
      categories: ['dairy-eggs'],
      chainSlugs: ['real-canadian-superstore'],
      onSaleOnly: true,
      near: { lat: 49.26, lng: -123.11, radiusKm: 5 },
      sortBy: 'price',
      sortOrder: 'desc',
    });
    expect(searchBody({ category: 'all', store: 'all', sort: 'distance' })).toEqual({ sortBy: 'price' });
    expect(searchBody({ branchId: 'nofrills-joti', origin: MOUNT_PLEASANT, radiusKm: 10 })).toEqual({
      locationIds: ['nofrills-joti'],
      sortBy: 'discount',
    });
  });
});

describe('against the real API', () => {
  it('gets Home page "Nearby discounts" in the website shape', async () => {
    const { offers, total } = await api.searchOffers({ origin: MOUNT_PLEASANT, radiusKm: 10, discountsOnly: true, sort: 'featured', limit: 4 });
    expect(total).toBeGreaterThan(0);
    expect(offers).toHaveLength(4);
    for (const offer of offers) {
      expect(offer.regularPrice).toBeGreaterThan(offer.price);
      expect(offer.validUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(offer.distance).toBeLessThanOrEqual(10);
      expect(offer.price).toBeCloseTo(Math.round(offer.price * 100) / 100, 10);
    }
  });

  it('filters by the website store id', async () => {
    const { offers } = await api.searchOffers({ store: 'superstore', query: 'milk' });
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((offer) => offer.storeId === 'superstore')).toBe(true);
  });

  it('gets the Locations page stores, nearest first, as website branches', async () => {
    const branches = await api.nearbyBranches(MOUNT_PLEASANT, 3);
    expect(branches.length).toBeGreaterThan(0);
    const distances = branches.map((branch) => branch.distance ?? Infinity);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    expect(branches.every((branch) => branch.address !== '' && branch.city !== '' && branch.postalCode !== '')).toBe(true);

    const first = branches[0];
    if (first === undefined) throw new Error('no branch');
    const { offers } = await api.searchOffers({ branchId: first.id });
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((offer) => offer.storeId === first.brandId)).toBe(true);
  });

  it('gets the store and category filters', async () => {
    const stores = await api.stores();
    expect(stores.map((store) => store.id).sort()).toEqual(['costco', 'no-frills', 'save-on-foods', 'superstore', 'walmart']);
    expect(stores.every((store) => store.website?.startsWith('https://'))).toBe(true);
    expect((await api.categories()).map((category) => category.slug)).toContain('dairy-eggs');
    expect(await api.health()).toBe(true);
  });

  it('turns API errors into BananaApiError with a safe message', async () => {
    const error = await api.nearbyBranches({ latitude: 99, longitude: -123.1 }, 5).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BananaApiError);
    expect((error as BananaApiError).status).toBe(400);
    expect((error as BananaApiError).message).not.toContain('99');
  });
});
