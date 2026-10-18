import { describe, expect, it } from 'vitest';
import {
  MAX_LIST_ENTRIES,
  MAX_LOOKUP_IDS,
  MAX_QUERY_LENGTH,
  parseChainParams,
  parseLookupBody,
  parseMemberPricingParam,
  parseNearbyBody,
  parseSearchBody,
} from './validate';

function problems(result: { ok: boolean; errors?: Array<{ field: string; message: string }> }): string[] {
  return (result.errors ?? []).map((error) => `${error.field}: ${error.message}`);
}

describe('parseSearchBody', () => {
  it('accepts a missing or empty body as "search everything"', () => {
    expect(parseSearchBody(undefined)).toEqual({ ok: true, value: {} });
    expect(parseSearchBody(null)).toEqual({ ok: true, value: {} });
    expect(parseSearchBody({})).toEqual({ ok: true, value: {} });
  });

  it('accepts a full valid search and passes it through', () => {
    const body = {
      query: 'milk',
      chainSlugs: ['walmart', 'costco'],
      parentCompanies: ['Walmart'],
      locationIds: ['walmart-sample-1'],
      near: { lat: 49.28, lng: -123.12, radiusKm: 5 },
      onSaleOnly: true,
      memberPricing: 'member',
      categories: ['dairy-eggs', 'fruits'],
      sortBy: 'distance',
      limit: 20,
      offset: 40,
    };
    expect(parseSearchBody(body)).toEqual({ ok: true, value: body });
  });

  it('rejects a body that is not a JSON object', () => {
    for (const bad of ['milk', 42, [], true]) {
      const result = parseSearchBody(bad);
      expect(result.ok).toBe(false);
      expect(problems(result)).toEqual(['(body): must be a JSON object']);
    }
  });

  it('rejects unknown fields and names the ones that are known', () => {
    const result = parseSearchBody({ chains: ['walmart'], colour: 'red' });
    expect(problems(result)).toHaveLength(2);
    expect(problems(result)[0]).toMatch(/^chains: is not a known field \(known fields: query, chainSlugs/);
    expect(problems(result)[1]).toMatch(/^colour:/);
  });

  it('reports every problem at once', () => {
    const result = parseSearchBody({ query: 5, onSaleOnly: 'yes', limit: 0, memberPricing: 'gold' });
    expect(problems(result)).toEqual([
      'query: must be text',
      'onSaleOnly: must be true or false',
      'memberPricing: must be one of: member, non-member',
      'limit: must be at least 1 and at most 100',
    ]);
  });

  describe('query', () => {
    it('trims it and leaves out a blank one', () => {
      expect(parseSearchBody({ query: '  milk  ' })).toEqual({ ok: true, value: { query: 'milk' } });
      expect(parseSearchBody({ query: '   ' })).toEqual({ ok: true, value: {} });
    });

    it('rejects one that is too long', () => {
      expect(parseSearchBody({ query: 'a'.repeat(MAX_QUERY_LENGTH) }).ok).toBe(true);
      expect(problems(parseSearchBody({ query: 'a'.repeat(MAX_QUERY_LENGTH + 1) }))).toEqual([
        `query: can be at most ${MAX_QUERY_LENGTH} characters`,
      ]);
    });
  });

  describe('lists', () => {
    it('trims entries', () => {
      expect(parseSearchBody({ chainSlugs: [' walmart '] })).toEqual({ ok: true, value: { chainSlugs: ['walmart'] } });
    });

    it('rejects anything that is not a list of non-empty text', () => {
      for (const bad of ['walmart', [1], [''], ['  '], [null], {}]) {
        expect(problems(parseSearchBody({ chainSlugs: bad })), JSON.stringify(bad)).toEqual([
          'chainSlugs: must be a list of non-empty text',
        ]);
      }
    });

    it('rejects too many entries, and entries that are too long', () => {
      expect(parseSearchBody({ chainSlugs: Array.from({ length: MAX_LIST_ENTRIES }, (_u, i) => `c${i}`) }).ok).toBe(true);
      expect(problems(parseSearchBody({ chainSlugs: Array.from({ length: MAX_LIST_ENTRIES + 1 }, (_u, i) => `c${i}`) }))).toEqual([
        `chainSlugs: can have at most ${MAX_LIST_ENTRIES} entries`,
      ]);
      expect(problems(parseSearchBody({ locationIds: ['x'.repeat(201)] }))).toEqual([
        'locationIds: entries can be at most 200 characters',
      ]);
    });

    it('rejects unknown categories and lists the known ones', () => {
      const result = parseSearchBody({ categories: ['fruits', 'candy-floss'] });
      expect(problems(result)).toHaveLength(1);
      expect(problems(result)[0]).toMatch(/^categories: has unknown categories \(candy-floss\)\. Known: fruits, vegetables/);
    });
  });

  describe('near', () => {
    it('accepts a good location', () => {
      expect(parseSearchBody({ near: { lat: 0, lng: 0, radiusKm: 0.5 } }).ok).toBe(true);
      expect(parseSearchBody({ near: { lat: -90, lng: 180, radiusKm: 200 } }).ok).toBe(true);
    });

    it('rejects something that is not an object', () => {
      for (const bad of ['here', 5, [], null]) {
        expect(problems(parseSearchBody({ near: bad })), JSON.stringify(bad)).toHaveLength(1);
        expect(problems(parseSearchBody({ near: bad }))[0]).toMatch(/^near: must be an object/);
      }
    });

    it('says which parts are missing', () => {
      expect(problems(parseSearchBody({ near: {} }))).toEqual([
        'near.lat: is required',
        'near.lng: is required',
        'near.radiusKm: is required',
      ]);
      expect(problems(parseSearchBody({ near: { lat: 49.28 } }))).toEqual([
        'near.lng: is required',
        'near.radiusKm: is required',
      ]);
    });

    it('checks each part on its own, even when another is missing', () => {
      expect(problems(parseSearchBody({ near: { lat: 123, radiusKm: 5 } }))).toEqual([
        'near.lng: is required',
        'near.lat: must be at least -90 and at most 90',
      ]);
    });

    it('rejects a place that is not on Earth, and a radius that makes no sense', () => {
      expect(problems(parseSearchBody({ near: { lat: 91, lng: -123, radiusKm: 5 } }))).toEqual([
        'near.lat: must be at least -90 and at most 90',
      ]);
      expect(problems(parseSearchBody({ near: { lat: 49, lng: -181, radiusKm: 5 } }))).toEqual([
        'near.lng: must be at least -180 and at most 180',
      ]);
      for (const radiusKm of [0, -1, 201]) {
        expect(problems(parseSearchBody({ near: { lat: 49, lng: -123, radiusKm } })), String(radiusKm)).toEqual([
          'near.radiusKm: must be more than 0 and at most 200',
        ]);
      }
    });

    it('rejects text where numbers should be', () => {
      expect(problems(parseSearchBody({ near: { lat: '49.28', lng: '-123.12', radiusKm: '5' } }))).toEqual([
        'near.lat: must be a number',
        'near.lng: must be a number',
        'near.radiusKm: must be a number',
      ]);
    });

    it('rejects extra fields inside near', () => {
      expect(problems(parseSearchBody({ near: { lat: 49, lng: -123, radiusKm: 5, accuracy: 10 } }))).toHaveLength(1);
      expect(problems(parseSearchBody({ near: { lat: 49, lng: -123, radiusKm: 5, accuracy: 10 } }))[0]).toMatch(/^near\.accuracy:/);
    });

    it('does not repeat the bad coordinates back in the error', () => {
      const text = JSON.stringify(parseSearchBody({ near: { lat: 123.456789, lng: -123.1, radiusKm: 5 } }));
      expect(text).not.toContain('123.456789');
    });
  });

  describe('sortBy', () => {
    it('accepts every sort, and distance only with near', () => {
      for (const sortBy of ['price', 'unitPrice', 'name', 'discount']) {
        expect(parseSearchBody({ sortBy }).ok, sortBy).toBe(true);
      }
      expect(parseSearchBody({ sortBy: 'distance', near: { lat: 49, lng: -123, radiusKm: 5 } }).ok).toBe(true);
    });

    it('rejects an unknown sort and distance without near', () => {
      expect(problems(parseSearchBody({ sortBy: 'cheapest' }))).toEqual([
        'sortBy: must be one of: price, unitPrice, name, distance, discount',
      ]);
      expect(problems(parseSearchBody({ sortBy: 'distance' }))).toEqual(['sortBy: can only be "distance" when "near" is given']);
    });
  });

  describe('sortOrder', () => {
    it('accepts asc and desc, with or without sortBy', () => {
      expect(parseSearchBody({ sortBy: 'price', sortOrder: 'desc' })).toEqual({
        ok: true,
        value: { sortBy: 'price', sortOrder: 'desc' },
      });
      expect(parseSearchBody({ sortOrder: 'asc' })).toEqual({ ok: true, value: { sortOrder: 'asc' } });
    });

    it('rejects anything else', () => {
      for (const sortOrder of ['DESC', 'down', '', 1, true, null, ['desc']]) {
        expect(problems(parseSearchBody({ sortOrder })), JSON.stringify(sortOrder)).toEqual([
          'sortOrder: must be one of: asc, desc',
        ]);
      }
    });

    it('is reported together with the other problems', () => {
      expect(problems(parseSearchBody({ sortBy: 'cheapest', sortOrder: 'down', categories: ['meats'] }))).toEqual([
        'categories: has unknown categories (meats). Known: fruits, vegetables, meat, seafood, dairy-eggs, bakery, frozen, beverages, snacks, pantry, household, other',
        'sortBy: must be one of: price, unitPrice, name, distance, discount',
        'sortOrder: must be one of: asc, desc',
      ]);
    });
  });

  describe('limit and offset', () => {
    it('accepts the edges', () => {
      expect(parseSearchBody({ limit: 1, offset: 0 }).ok).toBe(true);
      expect(parseSearchBody({ limit: 100 }).ok).toBe(true);
    });

    it('rejects out-of-range, fractional and text values', () => {
      for (const limit of [0, 101, 1.5, '10', -1, Number.NaN]) {
        expect(problems(parseSearchBody({ limit })), String(limit)).toHaveLength(1);
      }
      expect(problems(parseSearchBody({ offset: -1 }))).toEqual(['offset: must be at least 0 and at most 1000000']);
      expect(problems(parseSearchBody({ offset: 2.5 }))).toEqual(['offset: must be a whole number']);
    });
  });
});

describe('parseLookupBody', () => {
  it('accepts a list of ids and defaults to a non-member', () => {
    expect(parseLookupBody({ ids: ['walmart:W-2009', ' costco:C-3009 '] })).toEqual({
      ok: true,
      value: { ids: ['walmart:W-2009', 'costco:C-3009'], memberPricing: 'non-member' },
    });
    expect(parseLookupBody({ ids: ['a'], memberPricing: 'member' })).toEqual({
      ok: true,
      value: { ids: ['a'], memberPricing: 'member' },
    });
  });

  it('needs ids', () => {
    expect(problems(parseLookupBody({}))).toEqual(['ids: is required']);
    expect(problems(parseLookupBody(undefined))).toEqual(['ids: is required']);
    expect(problems(parseLookupBody({ ids: [] }))).toEqual(['ids: must have at least one id']);
  });

  it('rejects bad ids, too many ids, and unknown fields', () => {
    expect(problems(parseLookupBody({ ids: 'walmart:1' }))).toEqual(['ids: must be a list of non-empty text']);
    expect(problems(parseLookupBody({ ids: Array.from({ length: MAX_LOOKUP_IDS + 1 }, (_u, i) => `a${i}`) }))).toEqual([
      `ids: can have at most ${MAX_LOOKUP_IDS} entries`,
    ]);
    expect(problems(parseLookupBody({ ids: ['a'], memberPricing: 'gold', extra: 1 }))).toHaveLength(2);
  });
});

describe('parseNearbyBody', () => {
  it('accepts a point and a radius', () => {
    expect(parseNearbyBody({ lat: 49.28, lng: -123.12, radiusKm: 10 })).toEqual({
      ok: true,
      value: { lat: 49.28, lng: -123.12, radiusKm: 10 },
    });
  });

  it('needs all three', () => {
    expect(problems(parseNearbyBody({}))).toEqual(['lat: is required', 'lng: is required', 'radiusKm: is required']);
    expect(problems(parseNearbyBody(undefined))).toEqual(['lat: is required', 'lng: is required', 'radiusKm: is required']);
  });

  it('rejects a place off Earth, a bad radius, extra fields and a non-object', () => {
    expect(problems(parseNearbyBody({ lat: 200, lng: -123, radiusKm: 5 }))).toEqual(['lat: must be at least -90 and at most 90']);
    expect(problems(parseNearbyBody({ lat: 49, lng: -123, radiusKm: 0 }))).toEqual(['radiusKm: must be more than 0 and at most 200']);
    expect(problems(parseNearbyBody({ lat: 49, lng: -123, radiusKm: 5, extra: 1 }))).toHaveLength(1);
    expect(problems(parseNearbyBody('here'))).toEqual(['(body): must be a JSON object']);
  });
});

describe('parseMemberPricingParam', () => {
  it('defaults to a non-member and accepts the two choices', () => {
    expect(parseMemberPricingParam(undefined)).toEqual({ ok: true, value: 'non-member' });
    expect(parseMemberPricingParam('member')).toEqual({ ok: true, value: 'member' });
    expect(parseMemberPricingParam('non-member')).toEqual({ ok: true, value: 'non-member' });
  });

  it('rejects anything else', () => {
    for (const bad of ['gold', '', 5, ['member']]) {
      expect(parseMemberPricingParam(bad).ok, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe('parseChainParams', () => {
  it('accepts none, one or several', () => {
    expect(parseChainParams(undefined)).toEqual({ ok: true, value: [] });
    expect(parseChainParams('walmart')).toEqual({ ok: true, value: ['walmart'] });
    expect(parseChainParams(['walmart', ' costco '])).toEqual({ ok: true, value: ['walmart', 'costco'] });
  });

  it('rejects empty or non-text values', () => {
    expect(parseChainParams('').ok).toBe(false);
    expect(parseChainParams(['walmart', 5]).ok).toBe(false);
    expect(parseChainParams(7).ok).toBe(false);
  });
});
