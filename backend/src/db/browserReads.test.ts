import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBackend } from '../app';
import type { PriceRepository } from './repository';
import { createPool } from './postgres';
import type { PriceFilters, PriceRow } from '../types';

/**
 * The database functions the website calls directly (sql/migrations/002_browser_reads.sql)
 * must give the same answers as the backend's tested TypeScript search. Runs against a
 * throwaway Supabase-like database with the migration applied (TEST_DATABASE_URL); skipped
 * otherwise. Uses Oct 17, 2026, when every simulated sale is active, because the database
 * also checks sale dates and the TypeScript search does not.
 */
const url = process.env['TEST_DATABASE_URL'];
const AS_OF = '2026-10-17';
const MOUNT_PLEASANT = { lat: 49.262, lng: -123.105 };

describe.skipIf(url === undefined)('database functions for the website (needs TEST_DATABASE_URL)', () => {
  let pool: pg.Pool;
  let memory: PriceRepository;

  beforeAll(async () => {
    pool = createPool({ connectionString: url ?? '' });
    memory = (await createBackend({ source: 'simulated', now: () => new Date('2026-10-17T13:00:00.000Z') })).prices;
  });

  afterAll(async () => {
    await pool.end();
  });

  /** Calls banana.search_offers as a visitor (the anon role), like the website does. */
  async function searchOffers(filters: PriceFilters): Promise<{ rows: Record<string, unknown>[]; total: number }> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('set local role anon');
      const result = await client.query(
        `select * from banana.search_offers(p_query => $1, p_categories => $2, p_chain_slugs => $3, p_parent_companies => $4,
           p_location_ids => $5, p_near_lat => $6, p_near_lng => $7, p_radius_km => $8, p_on_sale_only => $9, p_member => $10,
           p_sort_by => $11, p_sort_order => $12, p_limit => $13, p_offset => $14, p_as_of => $15)`,
        [
          filters.query ?? null,
          filters.categories ?? null,
          filters.chainSlugs ?? null,
          filters.parentCompanies ?? null,
          filters.locationIds ?? null,
          filters.near?.lat ?? null,
          filters.near?.lng ?? null,
          filters.near?.radiusKm ?? null,
          filters.onSaleOnly ?? false,
          filters.memberPricing === 'member',
          filters.sortBy ?? 'price',
          filters.sortOrder ?? null,
          filters.limit ?? 50,
          filters.offset ?? 0,
          AS_OF,
        ],
      );
      await client.query('rollback');
      return { rows: result.rows, total: Number(result.rows[0]?.['total_count'] ?? 0) };
    } finally {
      client.release();
    }
  }

  /** The fields both sides have, in the TypeScript row's names. */
  function fromDatabase(row: Record<string, unknown>) {
    const num = (value: unknown) => (value === null || value === undefined ? undefined : Number(value));
    return {
      id: row['id'],
      priceCents: num(row['price_cents']),
      regularPriceCents: num(row['regular_price_cents']),
      discountCents: num(row['discount_cents']),
      discountPercent: num(row['discount_percent']),
      unit: row['unit_per'] === null ? undefined : { per: row['unit_per'], cents: num(row['unit_cents']) },
      distanceKm: num(row['distance_km']),
    };
  }
  function fromMemory(row: PriceRow) {
    return {
      id: row.id,
      priceCents: row.priceCents,
      regularPriceCents: row.regularPriceCents,
      discountCents: row.discountCents,
      discountPercent: row.discountPercent,
      unit: row.comparableUnitPrice,
      distanceKm: row.distanceKm,
    };
  }

  const cases: Array<[string, PriceFilters]> = [
    ['everything, first page', {}],
    ['second page', { limit: 20, offset: 20 }],
    ['text, across fields', { query: 'milk walmart' }],
    ['accents and case', { query: 'BANANÁS' }],
    ['category, most expensive first', { categories: ['meat'], sortBy: 'price', sortOrder: 'desc', limit: 100 }],
    ['chain and parent company', { chainSlugs: ['no-frills', 'walmart'], parentCompanies: ['loblaw companies'], limit: 100 }],
    ['picked store', { locationIds: ['nofrills-joti'], limit: 100 }],
    ['near, by distance', { near: { ...MOUNT_PLEASANT, radiusKm: 3 }, sortBy: 'distance', limit: 100 }],
    ['home: discounts near me', { near: { ...MOUNT_PLEASANT, radiusKm: 10 }, onSaleOnly: true, sortBy: 'discount', limit: 100 }],
    ['unit price', { query: 'milk', sortBy: 'unitPrice', limit: 100 }],
    ['unit price, reversed', { sortBy: 'unitPrice', sortOrder: 'desc', limit: 100 }],
    ['name', { sortBy: 'name', limit: 100 }],
    ['name, reversed', { sortBy: 'name', sortOrder: 'desc', limit: 100 }],
    ['distance without a location falls back to price', { sortBy: 'distance', limit: 100 }],
    ['members', { memberPricing: 'member', onSaleOnly: true, sortBy: 'discount', limit: 100 }],
  ];

  it.each(cases)('search_offers matches the TypeScript search: %s', async (_name, filters) => {
    const expected = await memory.searchPrices(filters);
    const actual = await searchOffers(filters);
    expect(actual.total).toBe(expected.total);
    expect(actual.rows.map(fromDatabase)).toEqual(expected.rows.map(fromMemory));
  });

  it('says which branch each price is for: the nearest in range, or the one picked', async () => {
    const near = await pool.query(
      `select chain_slug, distance_km, nearest_store_id, nearest_store_name
       from banana.search_offers(p_query => 'bananas', p_near_lat => $1, p_near_lng => $2, p_radius_km => 5, p_limit => 100, p_as_of => $3)`,
      [MOUNT_PLEASANT.lat, MOUNT_PLEASANT.lng, AS_OF],
    );
    expect(near.rows.length).toBeGreaterThan(0);
    const stores = await pool.query('select id, chain_slug, name, lat, lng from banana.store_locations');
    for (const row of near.rows) {
      const store = stores.rows.find((s) => s.id === row.nearest_store_id);
      expect(store?.chain_slug).toBe(row.chain_slug);
      expect(row.nearest_store_name).toBe(store?.name);
      // The named store is the one the distance was measured to.
      const sameChain = stores.rows.filter((s) => s.chain_slug === row.chain_slug);
      const km = (s: { lat: number; lng: number }) =>
        2 * 6371 * Math.asin(Math.sqrt(Math.sin(((s.lat - MOUNT_PLEASANT.lat) * Math.PI) / 360) ** 2 +
          Math.cos((MOUNT_PLEASANT.lat * Math.PI) / 180) * Math.cos((s.lat * Math.PI) / 180) * Math.sin(((s.lng - MOUNT_PLEASANT.lng) * Math.PI) / 360) ** 2));
      expect(Math.min(...sameChain.map(km))).toBeCloseTo(km(store), 9);
    }

    const picked = await pool.query(
      `select distinct nearest_store_id from banana.search_offers(p_location_ids => array['nofrills-joti'], p_limit => 100, p_as_of => $1)`,
      [AS_OF],
    );
    expect(picked.rows).toEqual([{ nearest_store_id: 'nofrills-joti' }]);

    const nowhere = await pool.query(`select distinct nearest_store_id from banana.search_offers(p_limit => 5, p_as_of => $1)`, [AS_OF]);
    expect(nowhere.rows).toEqual([{ nearest_store_id: null }]);
  });

  it('only counts a sale between its start and end dates', async () => {
    const run = async (asOf: string) => {
      const result = await pool.query('select count(*) from banana.search_offers(p_on_sale_only => true, p_limit => 100, p_as_of => $1)', [asOf]);
      return Number(result.rows[0].count);
    };
    expect(await run('2026-10-17')).toBeGreaterThan(0);
    expect(await run('2026-12-01')).toBe(0);
  });

  it('price_shopping_list matches the TypeScript shopping list for counted items', async () => {
    const items = [{ query: 'milk', quantity: 2 }, { query: 'bananas' }, { itemId: 'walmart:sim-gala-apples' }, { query: 'no such thing' }];
    const near = { ...MOUNT_PLEASANT, radiusKm: 5 };
    const expected = await memory.priceShoppingList({ items, near });
    const result = await pool.query(
      `select banana.price_shopping_list($1::jsonb, p_near_lat => $2, p_near_lng => $3, p_radius_km => $4, p_as_of => $5) as r`,
      [JSON.stringify(items), near.lat, near.lng, near.radiusKm, AS_OF],
    );
    const actual = result.rows[0].r;
    expect(actual.chains.map((c: Record<string, unknown>) => [c['chainSlug'], c['totalCents'], c['missingIndexes']])).toEqual(
      expected.chains.map((c) => [c.chainSlug, c.totalCents, c.missingIndexes]),
    );
    expect(actual.cheapestMix.totalCents).toBe(expected.cheapestMix.totalCents);
    expect(actual.cheapestMix.missingIndexes).toEqual(expected.cheapestMix.missingIndexes);
    for (const chain of actual.chains) expect(chain.nearestStore.distanceKm).toBeLessThanOrEqual(5);
  });

  it('price_shopping_list buys enough whole packs for an amount', async () => {
    const result = await pool.query(
      `select banana.price_shopping_list('[{"query":"2% milk","amount":{"value":6,"unit":"l"}}]'::jsonb, p_chain_slugs => array['walmart'], p_as_of => $1) as r`,
      [AS_OF],
    );
    const pick = result.rows[0].r.chains[0].picks[0];
    // Walmart's 2% milk is 4 L, so 6 L needs 2 cartons.
    expect(pick.row.packs).toBe(2);
    expect(pick.lineCents).toBe(pick.row.price_cents * 2);
  });

  it('visitors can call the functions but cannot change data', async () => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('set local role anon');
      await expect(client.query('select count(*) from banana.stores_within_radius(49.26, -123.1, 2)')).resolves.toBeDefined();
      await expect(client.query("update banana.prices set regular_price_cents = 1")).rejects.toThrow(/permission denied/);
      await client.query('rollback');
    } finally {
      client.release();
    }
  });
});
