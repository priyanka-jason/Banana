import { describe, expect, it } from 'vitest';
import { createItemSearch } from './itemSearch';

const URL_ = 'https://example-project.supabase.co';
const KEY = 'sb_publishable_testkey';

function row(id: string, extra: Record<string, unknown> = {}) {
  const [chain = '', sku = ''] = id.split(':');
  return {
    id,
    chain_slug: chain,
    chain_name: chain === 'no-frills' ? 'No Frills' : 'Save-On-Foods',
    sku,
    name: 'Bananas',
    size: 'per lb',
    regular_price_cents: 79,
    sale_price_cents: null,
    discount_cents: null,
    sale_end: null,
    distance_km: '0.6',
    nearest_store_id: 'saveon-cambie',
    nearest_store_name: 'Save-On-Foods Cambie',
    total_count: 2,
    ...extra,
  };
}

function fakeFetch(pages: unknown[][], status = 200) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  let i = 0;
  const fetch = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const body = status === 200 ? (pages[i++] ?? []) : { message: 'p_radius_km must be more than 0 and at most 10' };
    return new Response(JSON.stringify(body), { status });
  };
  return { fetch, calls };
}

describe('searchItemPricesWithinProximityTS', () => {
  it('calls search_offers with the publishable key, the location rounded, cheapest first', async () => {
    const { fetch, calls } = fakeFetch([[row('save-on-foods:sim-bananas', { sale_price_cents: 49, discount_cents: 30, sale_end: '2026-10-22' }), row('no-frills:sim-bananas', { regular_price_cents: 149 })]]);
    const { searchItemPricesWithinProximityTS } = createItemSearch({ supabaseUrl: `${URL_}/`, publishableKey: KEY, fetch });

    const results = await searchItemPricesWithinProximityTS('  bananas ', 49.2621234, -123.1054321, 5);

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe(`${URL_}/rest/v1/rpc/search_offers`);
    const headers = call.init?.headers as Record<string, string>;
    expect(headers['apikey']).toBe(KEY);
    expect(headers['Content-Profile']).toBe('banana');
    expect(JSON.parse(String(call.init?.body))).toEqual({
      p_query: 'bananas',
      p_near_lat: 49.26,
      p_near_lng: -123.11,
      p_radius_km: 5,
      p_sort_by: 'price',
      p_limit: 100,
      p_offset: 0,
    });

    expect(results[0]).toEqual({
      chainSlug: 'save-on-foods',
      chainName: 'Save-On-Foods',
      productName: 'Bananas',
      sku: 'sim-bananas',
      basePriceCents: 79,
      discountedPriceCents: 49,
      discountAmountCents: 30,
      id: 'save-on-foods:sim-bananas',
      size: 'per lb',
      distanceKm: 0.6,
      storeId: 'saveon-cambie',
      storeName: 'Save-On-Foods Cambie',
      saleEnd: '2026-10-22',
    });
    expect(results[1]?.discountedPriceCents).toBeNull();
    expect(results[1]?.discountAmountCents).toBe(0);
  });

  it('pages through long results', async () => {
    const many = (n: number, from: number) => Array.from({ length: n }, (_, i) => row(`walmart:sim-${from + i}`, { total_count: 150 }));
    const { fetch, calls } = fakeFetch([many(100, 0), many(50, 100)]);
    const { searchItemPricesWithinProximityTS } = createItemSearch({ supabaseUrl: URL_, publishableKey: KEY, fetch });
    expect(await searchItemPricesWithinProximityTS('x', 49.26, -123.1)).toHaveLength(150);
    expect(calls.map((c) => JSON.parse(String(c.init?.body)).p_offset)).toEqual([0, 100]);
  });

  it('refuses secret keys and never prints a key', () => {
    expect(() => createItemSearch({ supabaseUrl: URL_, publishableKey: 'sb_secret_abc' })).toThrow('secret key');
    const jwt = ['eyJhbGciOiJIUzI1NiJ9', btoa(JSON.stringify({ role: 'service_role' })), 'sig'].join('.');
    expect(() => createItemSearch({ supabaseUrl: URL_, publishableKey: jwt })).toThrow('secret key');
    let message = '';
    try {
      createItemSearch({ supabaseUrl: '', publishableKey: 'sb_publishable_shouldnotappear' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toContain('shouldnotappear');
  });

  it('checks its inputs and passes on the database message', async () => {
    const ok = createItemSearch({ supabaseUrl: URL_, publishableKey: KEY, fetch: fakeFetch([]).fetch });
    expect(await ok.searchItemPricesWithinProximityTS('   ', 49.26, -123.1)).toEqual([]);
    await expect(ok.searchItemPricesWithinProximityTS('milk', 49.26, -123.1, 25)).rejects.toThrow('at most 10 km');
    await expect(ok.searchItemPricesWithinProximityTS('milk', Number.NaN, -123.1)).rejects.toThrow('location');

    const failing = createItemSearch({ supabaseUrl: URL_, publishableKey: KEY, fetch: fakeFetch([], 400).fetch });
    await expect(failing.searchItemPricesWithinProximityTS('milk', 49.26, -123.1, 5)).rejects.toThrow('p_radius_km');
  });
});
