import { describe, expect, it } from 'vitest';
import { buildSeedSql, sqlText } from './seedSql';

describe('sqlText', () => {
  it("doubles single quotes so text can't end the SQL string early", () => {
    expect(sqlText("Grandma's Pie")).toBe("'Grandma''s Pie'");
    expect(sqlText("x'); drop table banana.prices; --")).toBe("'x''); drop table banana.prices; --'");
    expect(sqlText(undefined)).toBe('null');
  });

  it('refuses null bytes', () => {
    expect(() => sqlText('a\u0000b')).toThrow('null byte');
  });
});

describe('buildSeedSql', () => {
  const sql = buildSeedSql({
    title: 'test',
    chains: [{ slug: 'walmart', name: 'Walmart', parentCompany: 'Walmart', hasMemberPricing: false }],
    locations: [{ id: 'walmart-1', chainSlug: 'walmart', name: "Walmart's Store", lat: 49.2, lng: -123.1 }],
    records: [
      {
        chainSlug: 'walmart',
        sku: 'W-1',
        scrapedAt: '2026-10-17T13:00:00.000Z',
        payload: { name: "Kid's cereal" },
        original: { price: '$1.00' },
      },
    ],
    items: [
      {
        id: 'walmart:W-1',
        chainSlug: 'walmart',
        sku: 'W-1',
        name: "Kid's cereal",
        packCount: 1,
        pricedByWeight: false,
        category: 'pantry',
        storeCategories: ['Pantry', "Kids' Cereal"],
        regularPriceCents: 100,
        scrapedAt: '2026-10-17T13:00:00.000Z',
      },
    ],
  });

  it('is one transaction that never deletes and updates rows that exist', () => {
    expect(sql).toMatch(/^begin;$/m);
    expect(sql.trimEnd().endsWith('commit;')).toBe(true);
    expect(sql).not.toMatch(/\b(delete|drop|truncate)\b/i);
    expect(sql.match(/on conflict/g)).toHaveLength(5);
  });

  it('writes to the per-store table for the chain and the banana tables', () => {
    expect(sql).toContain('insert into raw.walmart (sku, scraped_at, payload, original) values');
    for (const table of ['chains', 'store_locations', 'products', 'prices']) expect(sql).toContain(`insert into banana.${table}`);
    expect(sql).toContain("'Kid''s cereal'");
    expect(sql).toContain(`array['Pantry', 'Kids'' Cereal']::text[]`);
    expect(sql).toContain('extensions.st_makepoint(-123.1, 49.2)');
  });

  it('refuses money that is not whole cents', () => {
    expect(() =>
      buildSeedSql({ title: 't', chains: [], locations: [], records: [], items: [{ ...itemBase(), regularPriceCents: 1.5 }] }),
    ).toThrow('whole number');
  });
});

function itemBase() {
  return {
    id: 'walmart:W-1',
    chainSlug: 'walmart',
    sku: 'W-1',
    name: 'x',
    packCount: 1,
    pricedByWeight: false,
    storeCategories: [],
    regularPriceCents: 100,
    scrapedAt: '2026-10-17T13:00:00.000Z',
  };
}
