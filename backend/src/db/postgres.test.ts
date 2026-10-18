import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBackend, createDatabaseBackend } from '../app';
import { PostgresListRepository } from '../lists/postgresLists';
import { runIngest } from '../pipeline/runIngest';
import { SIMULATED_TIME } from '../simulated/exportData';
import { SIMULATED_CATEGORY_MAP, simulatedConnectors } from '../simulated/generate';
import { MemoryFinal, MemoryStoreData } from './memory';
import { CachedFinalSource, createPool, PostgresFinal, PostgresStoreData } from './postgres';

/**
 * These run against a real database, set up like Supabase: sql/supabase-setup.sql and
 * sql/accounts-setup.sql, plus Supabase's auth.users table. Point TEST_DATABASE_URL at a
 * throwaway one (never the team's Supabase); without it they are skipped.
 */
const url = process.env['TEST_DATABASE_URL'];
const ALICE = 'aaaaaaaa-0000-4000-8000-00000000000a';
const BOB = 'bbbbbbbb-0000-4000-8000-00000000000b';

describe('CachedFinalSource', () => {
  it('reloads only after the time runs out, and retries after a failure', async () => {
    let now = 0;
    let loads = 0;
    let fail = false;
    const source = {
      listItems: async () => {
        loads += 1;
        if (fail) throw new Error('database down');
        return [];
      },
      listChains: async () => [],
      listLocations: async () => [],
    };
    const cached = new CachedFinalSource(source, 1000, () => now);
    await cached.listItems();
    await cached.listItems();
    expect(loads).toBe(1);
    now = 1000;
    fail = true;
    await expect(cached.listItems()).rejects.toThrow('database down');
    fail = false;
    await cached.listItems();
    expect(loads).toBe(3);
  });
});

describe.skipIf(url === undefined)('Postgres storage (needs TEST_DATABASE_URL)', () => {
  let pool: pg.Pool;
  const memoryStore = new MemoryStoreData();
  const memoryFinal = new MemoryFinal();

  beforeAll(async () => {
    pool = createPool({ connectionString: url ?? '' });
    await pool.query('insert into auth.users (id) values ($1), ($2) on conflict do nothing', [ALICE, BOB]);
    for (const [storeData, final] of [
      [memoryStore, memoryFinal],
      [new PostgresStoreData(pool), new PostgresFinal(pool)],
    ] as const) {
      const result = await runIngest({
        connectors: simulatedConnectors,
        categoryMap: SIMULATED_CATEGORY_MAP,
        storeData,
        final,
        now: () => SIMULATED_TIME,
      });
      expect(result.failures).toEqual([]);
    }
  });

  afterAll(async () => {
    await pool.query('delete from banana.shopping_lists where user_id in ($1, $2)', [ALICE, BOB]);
    await pool.end();
  });

  it('reads back exactly what was written: per-store rows, items, chains and stores', async () => {
    const final = new PostgresFinal(pool);
    const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    expect(byId(await final.listItems())).toEqual(byId(await memoryFinal.listItems()));
    const bySlug = <T extends { slug: string }>(rows: T[]) => [...rows].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    expect(bySlug(await final.listChains())).toEqual(bySlug(await memoryFinal.listChains()));

    const stored = byId(await final.listLocations());
    const expected = byId(await memoryFinal.listLocations());
    expect(stored.map(({ lat: _lat, lng: _lng, ...rest }) => rest)).toEqual(expected.map(({ lat: _lat, lng: _lng, ...rest }) => rest));
    stored.forEach((location, index) => {
      expect(location.lat).toBeCloseTo(expected[index]?.lat ?? 0, 9);
      expect(location.lng).toBeCloseTo(expected[index]?.lng ?? 0, 9);
    });

    const pgStore = new PostgresStoreData(pool);
    for (const chain of await memoryFinal.listChains()) {
      const bySku = <T extends { sku: string }>(rows: T[]) => [...rows].sort((a, b) => (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0));
      expect(bySku(await pgStore.loadRecords(chain.slug))).toEqual(bySku(await memoryStore.loadRecords(chain.slug)));
    }
  });

  it('can run again without making duplicates', async () => {
    const count = async () => Number((await pool.query('select count(*) from banana.prices')).rows[0].count);
    const before = await count();
    await runIngest({
      connectors: simulatedConnectors,
      categoryMap: SIMULATED_CATEGORY_MAP,
      storeData: new PostgresStoreData(pool),
      final: new PostgresFinal(pool),
      now: () => SIMULATED_TIME,
    });
    expect(await count()).toBe(before);
  });

  it('answers searches and shopping lists the same as the in-memory backend', async () => {
    const database = createDatabaseBackend({ connectionString: url ?? '' });
    const memory = await createBackend({ source: 'simulated', now: () => SIMULATED_TIME });
    try {
      const near = { lat: 49.2635, lng: -123.1005, radiusKm: 5 };
      for (const filters of [
        { query: 'milk', sortBy: 'price' as const },
        { categories: ['meat' as const], sortBy: 'price' as const, sortOrder: 'desc' as const, limit: 10 },
        { near, sortBy: 'distance' as const, onSaleOnly: true },
      ]) {
        expect(await database.prices.searchPrices(filters)).toEqual(await memory.prices.searchPrices(filters));
      }
      const list = { items: [{ query: 'milk', quantity: 2 }, { query: 'banana' }], near };
      expect(await database.prices.priceShoppingList(list)).toEqual(await memory.prices.priceShoppingList(list));
      expect(await database.prices.storesWithinRadius(near.lat, near.lng, near.radiusKm)).toEqual(
        await memory.prices.storesWithinRadius(near.lat, near.lng, near.radiusKm),
      );
    } finally {
      await database.close();
    }
  });

  it('keeps saved lists, and keeps each person to their own', async () => {
    const lists = new PostgresListRepository(pool);
    const created = await lists.createList(ALICE, {
      name: 'Weekly',
      items: [{ query: 'milk', categories: ['dairy-eggs'], quantity: 2 }, { itemId: 'walmart:sim-bananas' }],
    });
    expect(created.items).toEqual([
      { query: 'milk', categories: ['dairy-eggs'], quantity: 2 },
      { itemId: 'walmart:sim-bananas', quantity: 1 },
    ]);
    expect(await lists.getList(ALICE, created.id)).toEqual(created);
    expect(await lists.listLists(ALICE)).toEqual([expect.objectContaining({ id: created.id, itemCount: 2 })]);

    expect(await lists.getList(BOB, created.id)).toBeUndefined();
    expect(await lists.listLists(BOB)).toEqual([]);
    expect(await lists.replaceList(BOB, created.id, { name: 'hacked', items: [] })).toBeUndefined();
    expect(await lists.deleteList(BOB, created.id)).toBe(false);
    expect((await lists.getList(ALICE, created.id))?.name).toBe('Weekly');

    const replaced = await lists.replaceList(ALICE, created.id, { name: 'Party', items: [{ query: 'chips' }] });
    expect(replaced).toMatchObject({ name: 'Party', items: [{ query: 'chips', quantity: 1 }] });
    expect(await lists.deleteList(ALICE, created.id)).toBe(true);
    expect(await lists.getList(ALICE, created.id)).toBeUndefined();
  });
});
