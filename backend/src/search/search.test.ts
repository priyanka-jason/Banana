import { describe, expect, it } from 'vitest';
import { sampleConnectors } from '../connectors';
import { MemoryFinal, MemoryStoreData } from '../db/memory';
import { distanceKm } from '../geo';
import { runIngest } from '../pipeline/runIngest';
import type { FinalItem } from '../pipeline/types';
import type { Chain, PriceFilters, StoreLocation } from '../types';
import { DEFAULT_LIMIT, findItems, normalizeText, searchFinal, storesWithinRadius, type SearchData } from './search';

const NOW = new Date('2026-10-17T20:00:00.000Z');
/** A shopper in downtown Vancouver. The sample Save-On store is 0.3 km away. */
const SHOPPER = { lat: 49.28, lng: -123.12 };

async function sampleData(): Promise<SearchData> {
  const final = new MemoryFinal();
  await runIngest({ connectors: sampleConnectors, storeData: new MemoryStoreData(), final, now: () => NOW });
  return { items: await final.listItems(), chains: await final.listChains(), locations: await final.listLocations() };
}

const ids = (result: { rows: Array<{ id: string }> }): string[] => result.rows.map((row) => row.id);

function finalItem(overrides: Partial<FinalItem> & { id: string }): FinalItem {
  const [chainSlug = 'walmart', sku = 'X'] = overrides.id.split(':');
  return {
    chainSlug,
    sku,
    name: 'Test',
    category: 'pantry',
    storeCategories: [],
    packCount: 1,
    pricedByWeight: false,
    regularPriceCents: 100,
    scrapedAt: '2026-10-17T20:00:00.000Z',
    ...overrides,
  };
}

const walmart: Chain = { slug: 'walmart', name: 'Walmart', parentCompany: 'Walmart', hasMemberPricing: false };
const nearStore: StoreLocation = { id: 'walmart-a', chainSlug: 'walmart', name: 'A', lat: 49.2827, lng: -123.1207 };
const farStore: StoreLocation = { id: 'walmart-b', chainSlug: 'walmart', name: 'B', lat: 49.1, lng: -122.5 };

describe('normalizeText', () => {
  it('lowercases, drops accents and collapses spaces', () => {
    expect(normalizeText('  Bañanas   ÉCLAIR ')).toBe('bananas eclair');
  });
});

describe('searchFinal: no filters', () => {
  it('returns everything, cheapest first, with the total', async () => {
    const result = searchFinal(await sampleData());

    expect(result.total).toBe(45);
    expect(result.rows).toHaveLength(45);
    const prices = result.rows.map((row) => row.priceCents);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('returns the same order every time', async () => {
    const data = await sampleData();
    expect(ids(searchFinal(data))).toEqual(ids(searchFinal(data)));
  });

  it('does not change the data it is given', async () => {
    const data = await sampleData();
    const before = JSON.stringify(data);
    searchFinal(data, { query: 'milk', near: { ...SHOPPER, radiusKm: 12 }, sortBy: 'distance', memberPricing: 'member' });
    expect(JSON.stringify(data)).toBe(before);
  });

  it('gives no results when there is no data', () => {
    expect(searchFinal({ items: [], chains: [], locations: [] })).toEqual({ rows: [], total: 0 });
  });

  it('leaves out an item whose chain is not in the data', () => {
    const result = searchFinal({ items: [finalItem({ id: 'ghost:1', chainSlug: 'ghost' })], chains: [walmart], locations: [] });
    expect(result.total).toBe(0);
  });
});

describe('searchFinal: text search', () => {
  it('finds items by name, ignoring case', async () => {
    const data = await sampleData();
    expect(searchFinal(data, { query: 'banana' }).total).toBe(3);
    expect(searchFinal(data, { query: 'BANANA' }).total).toBe(3);
    expect(searchFinal(data, { query: 'milk' }).total).toBe(3);
  });

  it('needs every word, in any order', async () => {
    const data = await sampleData();
    expect(searchFinal(data, { query: 'gala apples' }).total).toBe(3);
    expect(searchFinal(data, { query: 'apples gala' }).total).toBe(3);
    expect(searchFinal(data, { query: 'gala potatoes' }).total).toBe(0);
  });

  it('matches part of a word', async () => {
    expect(searchFinal(await sampleData(), { query: 'apple' }).total).toBe(3);
  });

  it('ignores accents', async () => {
    expect(searchFinal(await sampleData(), { query: 'bañanas' }).total).toBe(3);
  });

  it('finds nothing for a word that is not there', async () => {
    expect(searchFinal(await sampleData(), { query: 'zzzz' }).total).toBe(0);
  });

  it('treats a blank query as no search', async () => {
    expect(searchFinal(await sampleData(), { query: '   ' }).total).toBe(45);
  });

  it('also searches the brand', () => {
    const data: SearchData = {
      items: [finalItem({ id: 'walmart:1', name: 'Rice', brand: 'Great Value' }), finalItem({ id: 'walmart:2', name: 'Rice' })],
      chains: [walmart],
      locations: [],
    };
    expect(ids(searchFinal(data, { query: 'great value' }))).toEqual(['walmart:1']);
    expect(ids(searchFinal(data, { query: 'rice great' }))).toEqual(['walmart:1']);
    expect(searchFinal(data, { query: 'rice' }).total).toBe(2);
  });
});

describe('searchFinal: chain, company and category filters', () => {
  it('filters by chain', async () => {
    const data = await sampleData();
    expect(searchFinal(data, { chainSlugs: ['walmart'] }).total).toBe(15);
    expect(searchFinal(data, { chainSlugs: ['walmart', 'costco'] }).total).toBe(30);
    expect(searchFinal(data, { chainSlugs: ['no-such-chain'] }).total).toBe(0);
  });

  it('treats an empty list as no filter', async () => {
    const data = await sampleData();
    expect(searchFinal(data, { chainSlugs: [], parentCompanies: [], categories: [], locationIds: [] }).total).toBe(45);
  });

  it('filters by parent company, ignoring case', async () => {
    const data = await sampleData();
    expect(searchFinal(data, { parentCompanies: ['Pattison Food Group'] }).total).toBe(15);
    expect(searchFinal(data, { parentCompanies: ['pattison food group'] }).total).toBe(15);
    expect(searchFinal(data, { parentCompanies: ['Costco Wholesale', 'Walmart'] }).total).toBe(30);
  });

  it('filters by shared category', async () => {
    const data = await sampleData();
    expect(searchFinal(data, { categories: ['fruits'] }).total).toBe(6);
    expect(searchFinal(data, { categories: ['fruits', 'vegetables'] }).total).toBe(12);
    expect(searchFinal(data, { categories: ['other'] }).total).toBe(0);
  });

  it('combines filters: every one must match', async () => {
    const data = await sampleData();
    const result = searchFinal(data, { query: 'milk', chainSlugs: ['costco', 'walmart'], categories: ['dairy-eggs'] });
    expect(ids(result).sort()).toEqual(['costco:C-3008', 'walmart:W-2008']);
  });
});

describe('searchFinal: on sale and member pricing', () => {
  it('shows a non-member the regular price, and a member the member price', async () => {
    const data = await sampleData();
    const nonMember = searchFinal(data, { query: 'banana' });
    const member = searchFinal(data, { query: 'banana', memberPricing: 'member' });

    const price = (result: typeof nonMember, id: string) => result.rows.find((row) => row.id === id)?.priceCents;
    expect(price(nonMember, 'save-on-foods:SOF-1001')).toBe(169);
    expect(price(member, 'save-on-foods:SOF-1001')).toBe(149);
    expect(price(member, 'walmart:W-2001')).toBe(69);
  });

  it('only shows items below their original price when asked for sales', async () => {
    const result = searchFinal(await sampleData(), { onSaleOnly: true });

    expect(result.total).toBe(10);
    expect(result.rows.every((row) => row.discountCents !== undefined && row.priceCents < row.regularPriceCents)).toBe(true);
  });

  it('counts member prices as sales only for a member', async () => {
    const data = await sampleData();
    const memberSales = searchFinal(data, { onSaleOnly: true, memberPricing: 'member' });

    expect(memberSales.total).toBe(14);
    expect(ids(memberSales)).toContain('save-on-foods:SOF-1001');
    expect(ids(searchFinal(data, { onSaleOnly: true }))).not.toContain('save-on-foods:SOF-1001');
  });
});

describe('searchFinal: sorting', () => {
  it('sorts by price by default, with ties broken by name then id', async () => {
    const data: SearchData = {
      items: [
        finalItem({ id: 'walmart:3', name: 'Same price B' }),
        finalItem({ id: 'walmart:2', name: 'Same price A', regularPriceCents: 100 }),
        finalItem({ id: 'walmart:1', name: 'Same price A', regularPriceCents: 100 }),
        finalItem({ id: 'walmart:0', name: 'Cheap', regularPriceCents: 50 }),
      ],
      chains: [walmart],
      locations: [],
    };
    expect(ids(searchFinal(data))).toEqual(['walmart:0', 'walmart:1', 'walmart:2', 'walmart:3']);
  });

  it('sorts by name, then id', async () => {
    const result = searchFinal(await sampleData(), { sortBy: 'name' });
    // Names that start with a digit sort before letters: "2% Milk" is first, then the two "2% Milk 4 L".
    expect(ids(result).slice(0, 3)).toEqual(['costco:C-3008', 'save-on-foods:SOF-1008', 'walmart:W-2008']);
    const names = result.rows.map((row) => normalizeText(row.name));
    expect(names).toEqual([...names].sort());
  });

  it('sorts by unit price, so a bulk bag and a per-lb price can be compared', async () => {
    const result = searchFinal(await sampleData(), { query: 'banana', sortBy: 'unitPrice' });
    expect(ids(result)).toEqual(['costco:C-3001', 'walmart:W-2001', 'save-on-foods:SOF-1001']);
  });

  it('puts items with no unit price last when sorting by unit price', async () => {
    const rows = searchFinal(await sampleData(), { sortBy: 'unitPrice' }).rows;
    const firstMissing = rows.findIndex((row) => row.comparableUnitPrice === undefined);

    expect(firstMissing).toBeGreaterThan(0);
    expect(rows.slice(firstMissing).every((row) => row.comparableUnitPrice === undefined)).toBe(true);
  });

  it('keeps unit prices of the same kind together when sorting by unit price', async () => {
    const rows = searchFinal(await sampleData(), { sortBy: 'unitPrice' }).rows.filter((row) => row.comparableUnitPrice);
    const kinds = rows.map((row) => row.comparableUnitPrice?.per);
    // Once the kind changes it never changes back.
    const order = ['100g', '100ml', 'each'];
    const indexes = kinds.map((kind) => order.indexOf(kind ?? ''));
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });

  it('sorts by biggest percent off for top deals, then by biggest saving', async () => {
    const result = searchFinal(await sampleData(), { onSaleOnly: true, sortBy: 'discount' });

    expect(ids(result).slice(0, 3)).toEqual(['costco:C-3015', 'save-on-foods:SOF-1005', 'save-on-foods:SOF-1012']);
    const percents = result.rows.map((row) => row.discountPercent ?? 0);
    expect(percents).toEqual([...percents].sort((a, b) => b - a));
  });

  it('puts items with no discount last when sorting by discount', async () => {
    const rows = searchFinal(await sampleData(), { sortBy: 'discount' }).rows;
    const firstWithout = rows.findIndex((row) => row.discountPercent === undefined);

    expect(firstWithout).toBe(10);
    expect(rows.slice(firstWithout).every((row) => row.discountPercent === undefined)).toBe(true);
  });
});

describe('searchFinal: sortOrder', () => {
  const tied: SearchData = {
    items: [
      finalItem({ id: 'walmart:3', name: 'B', regularPriceCents: 300 }),
      finalItem({ id: 'walmart:2', name: 'A', regularPriceCents: 300 }),
      finalItem({ id: 'walmart:1', name: 'A', regularPriceCents: 300 }),
      finalItem({ id: 'walmart:0', name: 'Cheap', regularPriceCents: 50 }),
      finalItem({ id: 'walmart:9', name: 'Dear', regularPriceCents: 900 }),
    ],
    chains: [walmart],
    locations: [],
  };

  it('sorts most expensive first with desc, keeping ties in name then id order', () => {
    expect(ids(searchFinal(tied, { sortBy: 'price', sortOrder: 'desc' }))).toEqual([
      'walmart:9',
      'walmart:1',
      'walmart:2',
      'walmart:3',
      'walmart:0',
    ]);
  });

  it('applies to the default sort (price) when sortBy is left out', () => {
    expect(ids(searchFinal(tied, { sortOrder: 'desc' }))).toEqual(ids(searchFinal(tied, { sortBy: 'price', sortOrder: 'desc' })));
  });

  it('gives the same order as no sortOrder when asking for the natural direction', async () => {
    const data = await sampleData();
    const natural = { price: 'asc', unitPrice: 'asc', name: 'asc', discount: 'desc' } as const;
    for (const [sortBy, sortOrder] of Object.entries(natural)) {
      const filters = { sortBy: sortBy as keyof typeof natural };
      expect(ids(searchFinal(data, { ...filters, sortOrder })), sortBy).toEqual(ids(searchFinal(data, filters)));
    }
  });

  it('sorts names Z to A with desc, ties still by id A to Z', () => {
    expect(ids(searchFinal(tied, { sortBy: 'name', sortOrder: 'desc' }))).toEqual([
      'walmart:9',
      'walmart:0',
      'walmart:3',
      'walmart:1',
      'walmart:2',
    ]);
  });

  it('keeps items with no unit price last in both directions, and unit kinds in the same groups', async () => {
    const data = await sampleData();
    for (const sortOrder of ['asc', 'desc'] as const) {
      const rows = searchFinal(data, { sortBy: 'unitPrice', sortOrder }).rows;
      const firstMissing = rows.findIndex((row) => row.comparableUnitPrice === undefined);
      expect(firstMissing, sortOrder).toBeGreaterThan(0);
      expect(rows.slice(firstMissing).every((row) => row.comparableUnitPrice === undefined), sortOrder).toBe(true);

      const order = ['100g', '100ml', 'each'];
      const kinds = rows.slice(0, firstMissing).map((row) => order.indexOf(row.comparableUnitPrice?.per ?? ''));
      expect(kinds, sortOrder).toEqual([...kinds].sort((a, b) => a - b));
    }
  });

  it('sorts most expensive per unit first with desc, within one kind', async () => {
    const result = searchFinal(await sampleData(), { query: 'banana', sortBy: 'unitPrice', sortOrder: 'desc' });
    expect(ids(result)).toEqual(['save-on-foods:SOF-1001', 'walmart:W-2001', 'costco:C-3001']);
  });

  it('sorts smallest discount first with asc, with items not on sale still last', async () => {
    const rows = searchFinal(await sampleData(), { sortBy: 'discount', sortOrder: 'asc' }).rows;
    const onSale = rows.filter((row) => row.discountPercent !== undefined);
    expect(onSale).toHaveLength(10);
    expect(rows.slice(0, 10)).toEqual(onSale);
    const percents = onSale.map((row) => row.discountPercent ?? 0);
    expect(percents).toEqual([...percents].sort((a, b) => a - b));
  });

  it('sorts farthest first with distance desc', () => {
    const data: SearchData = {
      items: [
        finalItem({ id: 'walmart:near', locationId: 'walmart-a' }),
        finalItem({ id: 'walmart:far', locationId: 'walmart-b' }),
      ],
      chains: [walmart],
      locations: [nearStore, farStore],
    };
    const near = { ...SHOPPER, radiusKm: 100 };
    expect(ids(searchFinal(data, { near, sortBy: 'distance' }))).toEqual(['walmart:near', 'walmart:far']);
    expect(ids(searchFinal(data, { near, sortBy: 'distance', sortOrder: 'desc' }))).toEqual(['walmart:far', 'walmart:near']);
  });
});

describe('searchFinal: categories', () => {
  it('finds only meat', async () => {
    const result = searchFinal(await sampleData(), { categories: ['meat'] });
    expect(result.total).toBe(6);
    expect(result.rows.every((row) => row.category === 'meat')).toBe(true);
  });

  it('finds only vegetables', async () => {
    const result = searchFinal(await sampleData(), { categories: ['vegetables'] });
    expect(result.total).toBe(6);
    expect(result.rows.every((row) => row.category === 'vegetables')).toBe(true);
  });

  it('combines several categories with a sort and pages through them without gaps or repeats', async () => {
    const data = await sampleData();
    const filters: PriceFilters = { categories: ['meat', 'vegetables', 'fruits'], sortBy: 'price', sortOrder: 'desc' };
    const all = searchFinal(data, { ...filters, limit: 100 });
    expect(all.total).toBe(18);
    expect(new Set(all.rows.map((row) => row.category))).toEqual(new Set(['meat', 'vegetables', 'fruits']));
    const prices = all.rows.map((row) => row.priceCents);
    expect(prices).toEqual([...prices].sort((a, b) => b - a));

    const pages = [0, 5, 10, 15].map((offset) => searchFinal(data, { ...filters, limit: 5, offset }));
    expect(pages.every((page) => page.total === 18)).toBe(true);
    expect(pages.flatMap(ids)).toEqual(ids(all));
  });
});

describe('searchFinal: paging', () => {
  it('returns a page and the total before paging', async () => {
    const data = await sampleData();
    const all = searchFinal(data);
    const page1 = searchFinal(data, { limit: 10 });
    const page2 = searchFinal(data, { limit: 10, offset: 10 });

    expect(page1.total).toBe(45);
    expect(page1.rows).toHaveLength(10);
    expect(ids(page1)).toEqual(ids(all).slice(0, 10));
    expect(ids(page2)).toEqual(ids(all).slice(10, 20));
  });

  it('gives a short last page and an empty page past the end', async () => {
    const data = await sampleData();
    expect(searchFinal(data, { limit: 10, offset: 40 }).rows).toHaveLength(5);
    expect(searchFinal(data, { limit: 10, offset: 100 })).toMatchObject({ rows: [], total: 45 });
  });

  it('uses the default page size of 50', async () => {
    const items = Array.from({ length: 60 }, (_unused, index) => finalItem({ id: `walmart:${index}` }));
    const result = searchFinal({ items, chains: [walmart], locations: [] });

    expect(DEFAULT_LIMIT).toBe(50);
    expect(result.rows).toHaveLength(50);
    expect(result.total).toBe(60);
  });
});

describe('searchFinal: near me', () => {
  it('only shows chains with a store inside the radius', async () => {
    const result = searchFinal(await sampleData(), { near: { ...SHOPPER, radiusKm: 3 } });

    expect(result.total).toBe(15);
    expect(result.rows.every((row) => row.chainSlug === 'save-on-foods')).toBe(true);
  });

  it('shows every chain once the radius is big enough', async () => {
    expect(searchFinal(await sampleData(), { near: { ...SHOPPER, radiusKm: 12 } }).total).toBe(45);
  });

  it('shows nothing when no store is that close', async () => {
    expect(searchFinal(await sampleData(), { near: { lat: 49.0, lng: -122.0, radiusKm: 5 } }).total).toBe(0);
  });

  it("gives each row the distance to that chain's nearest store, to a tenth of a km", async () => {
    const data = await sampleData();
    const result = searchFinal(data, { near: { ...SHOPPER, radiusKm: 12 } });

    for (const row of result.rows) {
      const nearest = Math.min(
        ...data.locations.filter((location) => location.chainSlug === row.chainSlug).map((location) => distanceKm(SHOPPER, location)),
      );
      expect(row.distanceKm, row.id).toBe(Math.round(nearest * 10) / 10);
    }
  });

  it('includes a store exactly at the edge of the radius', async () => {
    const data = await sampleData();
    const costco = data.locations.find((location) => location.id === 'costco-sample-1');
    if (costco === undefined) throw new Error('no sample location');
    const exact = distanceKm(SHOPPER, costco);

    expect(searchFinal(data, { chainSlugs: ['costco'], near: { ...SHOPPER, radiusKm: exact } }).total).toBe(15);
    expect(searchFinal(data, { chainSlugs: ['costco'], near: { ...SHOPPER, radiusKm: exact - 0.001 } }).total).toBe(0);
  });

  it('sorts nearest first', async () => {
    const rows = searchFinal(await sampleData(), { near: { ...SHOPPER, radiusKm: 12 }, sortBy: 'distance' }).rows;

    expect(rows[0]?.chainSlug).toBe('save-on-foods');
    const distances = rows.map((row) => row.distanceKm ?? Number.POSITIVE_INFINITY);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('breaks ties in distance by price', async () => {
    const rows = searchFinal(await sampleData(), { near: { ...SHOPPER, radiusKm: 12 }, sortBy: 'distance', chainSlugs: ['walmart'] }).rows;
    const prices = rows.map((row) => row.priceCents);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('sorts by price when asked for distance but no location was given', async () => {
    const data = await sampleData();
    expect(ids(searchFinal(data, { sortBy: 'distance' }))).toEqual(ids(searchFinal(data)));
  });

  it('works together with the other filters', async () => {
    const result = searchFinal(await sampleData(), { query: 'banana', near: { ...SHOPPER, radiusKm: 3 } });
    expect(ids(result)).toEqual(['save-on-foods:SOF-1001']);
  });

  it('leaves distance off the rows when no location was given', async () => {
    const rows = searchFinal(await sampleData(), { query: 'banana' }).rows;
    expect(rows.every((row) => row.distanceKm === undefined)).toBe(true);
  });
});

describe('searchFinal: stores picked on a map', () => {
  it("shows a chain's prices when one of its stores is picked", async () => {
    const data = await sampleData();
    const result = searchFinal(data, { locationIds: ['walmart-sample-1'] });

    expect(result.total).toBe(15);
    expect(result.rows.every((row) => row.chainSlug === 'walmart')).toBe(true);
  });

  it('shows every chain that has a picked store', async () => {
    expect(searchFinal(await sampleData(), { locationIds: ['walmart-sample-1', 'costco-sample-2'] }).total).toBe(30);
  });

  it('shows nothing for an unknown store', async () => {
    expect(searchFinal(await sampleData(), { locationIds: ['nope'] }).total).toBe(0);
  });

  it('keeps a price set for one store to that store', () => {
    const data: SearchData = {
      items: [
        finalItem({ id: 'walmart:at-a', locationId: 'walmart-a' }),
        finalItem({ id: 'walmart:at-b', locationId: 'walmart-b' }),
        finalItem({ id: 'walmart:chain-wide' }),
      ],
      chains: [walmart],
      locations: [nearStore, farStore],
    };

    expect(ids(searchFinal(data, { locationIds: ['walmart-a'] })).sort()).toEqual(['walmart:at-a', 'walmart:chain-wide']);
    expect(ids(searchFinal(data, { locationIds: ['walmart-b'] })).sort()).toEqual(['walmart:at-b', 'walmart:chain-wide']);
  });

  it('uses the distance to that one store for a price set for one store', () => {
    const data: SearchData = {
      items: [
        finalItem({ id: 'walmart:at-a', locationId: 'walmart-a' }),
        finalItem({ id: 'walmart:at-b', locationId: 'walmart-b' }),
        finalItem({ id: 'walmart:chain-wide' }),
      ],
      chains: [walmart],
      locations: [nearStore, farStore],
    };
    const result = searchFinal(data, { near: { ...SHOPPER, radiusKm: 5 } });

    expect(ids(result).sort()).toEqual(['walmart:at-a', 'walmart:chain-wide']);
    expect(result.rows.find((row) => row.id === 'walmart:at-a')?.distanceKm).toBe(0.3);
  });

  it('needs both when given picked stores and a radius', async () => {
    const result = searchFinal(await sampleData(), {
      locationIds: ['walmart-sample-1', 'save-on-foods-sample-1'],
      near: { ...SHOPPER, radiusKm: 3 },
    });
    expect(result.rows.every((row) => row.chainSlug === 'save-on-foods')).toBe(true);
    expect(result.total).toBe(15);
  });
});

describe('findItems', () => {
  it('returns rows in the order asked for and leaves out unknown ids', async () => {
    const rows = findItems(await sampleData(), ['costco:C-3009', 'walmart:NOPE', 'walmart:W-2009']);
    expect(rows.map((row) => row.id)).toEqual(['costco:C-3009', 'walmart:W-2009']);
  });

  it('returns an id asked for twice only once', async () => {
    expect(findItems(await sampleData(), ['walmart:W-2009', 'walmart:W-2009']).map((row) => row.id)).toEqual(['walmart:W-2009']);
  });

  it('applies member pricing', async () => {
    const data = await sampleData();
    expect(findItems(data, ['save-on-foods:SOF-1001'])[0]?.priceCents).toBe(169);
    expect(findItems(data, ['save-on-foods:SOF-1001'], 'member')[0]?.priceCents).toBe(149);
  });

  it('returns nothing for an empty list', async () => {
    expect(findItems(await sampleData(), [])).toEqual([]);
  });
});

describe('storesWithinRadius', () => {
  it('lists stores inside the radius, nearest first, to a tenth of a km', async () => {
    const data = await sampleData();
    const stores = storesWithinRadius(data.locations, SHOPPER.lat, SHOPPER.lng, 12);

    expect(stores.map((store) => store.id)).toEqual([
      'save-on-foods-sample-1',
      'costco-sample-1',
      'walmart-sample-1',
      'costco-sample-2',
      'save-on-foods-sample-2',
    ]);
    expect(stores[0]?.distanceKm).toBe(0.3);
    for (const store of stores) expect(store.distanceKm).toBe(Math.round(store.distanceKm * 10) / 10);
  });

  it('is empty when nothing is close', async () => {
    expect(storesWithinRadius((await sampleData()).locations, 0, 0, 100)).toEqual([]);
  });
});
