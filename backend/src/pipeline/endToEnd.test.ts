import { beforeAll, describe, expect, it } from 'vitest';
import { handleSearch } from '../api/handlers';
import type { SearchResponseBody } from '../api/types';
import type { ProductCategory } from '../categories';
import { MemoryFinal, MemoryStoreData } from '../db/memory';
import { MemoryPriceRepository } from '../db/memoryReader';
import { normalizeText } from '../search/search';
import { SIMULATED_CATEGORY_MAP, simulatedConnectors } from '../simulated/generate';
import type { PriceRow } from '../types';
import { runIngest } from './runIngest';
import type { FinalItem } from './types';

/**
 * The whole path a shopper's search takes, on the simulated chains:
 * connectors -> per-store layer -> combine -> final layer -> read repository -> search handler.
 * Expected answers are worked out straight from the final items, not with the search code.
 */

const NOW = new Date('2026-10-17T13:00:00.000Z');

let final: MemoryFinal;
let repo: MemoryPriceRepository;
let items: FinalItem[];

beforeAll(async () => {
  final = new MemoryFinal();
  const result = await runIngest({
    connectors: simulatedConnectors,
    storeData: new MemoryStoreData(),
    final,
    categoryMap: SIMULATED_CATEGORY_MAP,
    now: () => NOW,
  });
  expect(result.failures).toEqual([]);
  repo = new MemoryPriceRepository(final);
  items = await final.listItems();
});

async function search(body: unknown): Promise<SearchResponseBody> {
  const response = await handleSearch(repo, body);
  expect(response.status).toBe(200);
  return response.body as SearchResponseBody;
}

/** A non-member pays the sale price, so an item is on sale when that is below the regular price. */
const onSale = (item: FinalItem): boolean =>
  item.salePriceCents !== undefined && item.salePriceCents < item.regularPriceCents;

describe('end to end: simulated chains to search results', () => {
  it('loads all 5 chains and 283 items into the final layer, each with a shared category', async () => {
    expect((await final.listChains()).map((chain) => chain.slug).sort()).toEqual([
      'costco',
      'no-frills',
      'real-canadian-superstore',
      'save-on-foods',
      'walmart',
    ]);
    expect(items).toHaveLength(283);
    expect(items.filter((item) => item.category === 'other')).toEqual([]);
  });

  it('finds every item of a category, and only those', async () => {
    for (const category of ['meat', 'vegetables'] as ProductCategory[]) {
      const expected = items.filter((item) => item.category === category).map((item) => item.id).sort();
      const body = await search({ categories: [category], limit: 100 });
      expect(body.total, category).toBe(expected.length);
      expect(body.rows.map((row) => row.id).sort(), category).toEqual(expected);
      expect(body.rows.every((row) => row.category === category), category).toBe(true);
    }
  });

  it('combines category, chains, on sale, most expensive first and paging', async () => {
    const categories: ProductCategory[] = ['meat', 'vegetables'];
    const chainSlugs = ['save-on-foods', 'walmart', 'no-frills'];
    const filters = { categories, chainSlugs, onSaleOnly: true, sortBy: 'price', sortOrder: 'desc' };

    const expected = items.filter(
      (item) => categories.includes(item.category) && chainSlugs.includes(item.chainSlug) && onSale(item),
    );
    expect(expected.length).toBeGreaterThan(6);

    const pageSize = 4;
    const pages: SearchResponseBody[] = [];
    for (let offset = 0; offset < expected.length; offset += pageSize) {
      pages.push(await search({ ...filters, limit: pageSize, offset }));
    }
    const rows: PriceRow[] = pages.flatMap((page) => page.rows);

    // Every page reports the same total, its own paging, and no row is lost or repeated.
    expect(pages.every((page) => page.total === expected.length)).toBe(true);
    expect(pages.map((page) => page.offset)).toEqual(pages.map((_, index) => index * pageSize));
    expect(pages.every((page) => page.limit === pageSize)).toBe(true);
    expect(rows.map((row) => row.id).sort()).toEqual(expected.map((item) => item.id).sort());

    // Every row matches every filter.
    for (const row of rows) {
      expect(categories).toContain(row.category);
      expect(chainSlugs).toContain(row.chainSlug);
      expect(row.discountCents).toBeGreaterThan(0);
      expect(row.priceCents).toBeLessThan(row.regularPriceCents);
    }

    // Most expensive first; equal prices by name, then id.
    for (let i = 1; i < rows.length; i++) {
      const [a, b] = [rows[i - 1]!, rows[i]!];
      expect(a.priceCents).toBeGreaterThanOrEqual(b.priceCents);
      if (a.priceCents === b.priceCents) {
        const [nameA, nameB] = [normalizeText(a.name), normalizeText(b.name)];
        expect(nameA < nameB || (nameA === nameB && a.id < b.id)).toBe(true);
      }
    }

    // A page past the end is empty but still knows the total.
    const past = await search({ ...filters, limit: pageSize, offset: expected.length });
    expect(past).toMatchObject({ rows: [], total: expected.length });
  });

  it('flips only the direction: desc is asc reversed when no two prices tie', async () => {
    const body = { categories: ['meat'], chainSlugs: ['costco'], limit: 100 };
    const asc = (await search({ ...body, sortBy: 'price' })).rows;
    const desc = (await search({ ...body, sortBy: 'price', sortOrder: 'desc' })).rows;
    expect(new Set(asc.map((row) => row.priceCents)).size).toBe(asc.length);
    expect(desc.map((row) => row.id)).toEqual(asc.map((row) => row.id).reverse());
  });

  it('rejects a bad sortOrder through the handler, listing every problem', async () => {
    const response = await handleSearch(repo, { categories: ['meats'], sortOrder: 'down' });
    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body)).toContain('"field":"categories"');
    expect(JSON.stringify(response.body)).toContain('"field":"sortOrder"');
    expect(response.body).toMatchObject({ error: { message: 'The request has 2 problems.' } });
  });
});
