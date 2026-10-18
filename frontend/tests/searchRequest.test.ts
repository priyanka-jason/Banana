import test from 'node:test'
import assert from 'node:assert/strict'
import { roundedPoint, searchOffersBody } from '../src/lib/searchRequest.ts'
import {
  mapPrice,
  searchOffers,
  searchRowToOffer,
  type SearchRow,
} from '../src/api/supabaseCatalogue.ts'
import type { Filters } from '../src/types.ts'

const filters: Filters = {
  query: '',
  category: 'all',
  store: 'all',
  radius: 5,
  discountsOnly: false,
  sort: 'recommended',
  area: 'mount-pleasant',
}
const point = { latitude: 49.26234, longitude: -123.10567 }

test('default filters ask for everything nearby, deals first', () => {
  assert.deepEqual(searchOffersBody(filters, point), {
    p_query: null,
    p_categories: null,
    p_chain_slugs: null,
    p_location_ids: null,
    p_near_lat: 49.26,
    p_near_lng: -123.11,
    p_radius_km: 5,
    p_on_sale_only: false,
    p_sort_by: 'discount',
    p_sort_order: null,
    p_limit: 50,
    p_offset: 0,
  })
})

test('filters, branch and paging map to the function inputs', () => {
  const body = searchOffersBody(
    {
      ...filters,
      query: '  2% milk ',
      category: 'dairy-eggs',
      store: 'walmart',
      radius: 10,
      discountsOnly: true,
      sort: 'price-desc',
    },
    point,
    { branchId: 'walmart-grandview', limit: 20, offset: 40 },
  )
  assert.equal(body.p_query, '2% milk')
  assert.deepEqual(body.p_categories, ['dairy-eggs'])
  assert.deepEqual(body.p_chain_slugs, ['walmart'])
  assert.deepEqual(body.p_location_ids, ['walmart-grandview'])
  assert.equal(body.p_radius_km, 10)
  assert.equal(body.p_on_sale_only, true)
  assert.equal(body.p_sort_by, 'price')
  assert.equal(body.p_sort_order, 'desc')
  assert.equal(body.p_limit, 20)
  assert.equal(body.p_offset, 40)
})

test('each sort maps to a sort the database accepts', () => {
  const sorts = {
    recommended: ['discount', null],
    price: ['price', null],
    'price-desc': ['price', 'desc'],
    distance: ['distance', null],
    discount: ['discount', null],
  } as const
  for (const [sort, [by, order]] of Object.entries(sorts)) {
    const body = searchOffersBody(
      { ...filters, sort: sort as Filters['sort'] },
      point,
    )
    assert.equal(body.p_sort_by, by, sort)
    assert.equal(body.p_sort_order, order, sort)
  }
})

test('radius stays inside the 1–10 km the database allows', () => {
  assert.equal(
    searchOffersBody({ ...filters, radius: 50 }, point).p_radius_km,
    10,
  )
  assert.equal(
    searchOffersBody({ ...filters, radius: 0 }, point).p_radius_km,
    1,
  )
})

test('locations are rounded to two decimals before leaving the device', () => {
  assert.deepEqual(roundedPoint({ latitude: 49.2849, longitude: -123.1151 }), {
    latitude: 49.28,
    longitude: -123.12,
  })
})

const row: SearchRow = {
  id: 'no-frills:sim-gala-apples',
  chain_slug: 'no-frills',
  location_id: null,
  sku: 'sim-gala-apples',
  name: 'Gala apples',
  brand: null,
  size: '3 lb bag',
  size_unit: 'lb',
  size_kind: 'weight',
  size_total_base: 1360.77711,
  pack_count: 1,
  priced_by_weight: false,
  category: 'fruits',
  price_cents: 349,
  regular_price_cents: 499,
  sale_price_cents: 349,
  sale_start: '2026-10-16',
  sale_end: '2026-10-22',
  source_url: null,
  scraped_at: '2026-10-17T13:00:00Z',
  distance_km: 2.4,
  total_count: 1,
}
const now = new Date('2026-10-17T20:00:00Z')

test('a search row becomes the same offer the catalogue would show', () => {
  const offer = searchRowToOffer(row, undefined, now)!
  const fromCatalogue = mapPrice(
    {
      id: 1,
      location_id: null,
      regular_price_cents: 499,
      sale_price_cents: 349,
      sale_start: '2026-10-16',
      sale_end: '2026-10-22',
      scraped_at: '2026-10-17T13:00:00Z',
      source_url: null,
      products: {
        id: 1,
        chain_slug: 'no-frills',
        brand: null,
        sku: 'sim-gala-apples',
        name: 'Gala apples',
        size: '3 lb bag',
        category: 'fruits',
        pack_count: 1,
        priced_by_weight: false,
        size_kind: 'weight',
        size_total_base: 1360.77711,
        size_unit: 'lb',
      },
    },
    now,
  )!
  assert.deepEqual(offer, fromCatalogue)
  assert.equal(offer.price, 3.49)
  assert.equal(offer.regularPrice, 4.99)
  assert.equal(offer.unitPrice, '$2.56/kg')
})

test('the database price wins, and known catalogue details are kept', () => {
  const known = {
    ...searchRowToOffer(row, undefined, now)!,
    spec: {
      sku: 'sim-gala-apples',
      upc: '0123',
      comparisonGroupId: 'gala-3lb',
    },
  }
  const offer = searchRowToOffer(
    { ...row, price_cents: 499, sale_price_cents: null, sale_end: null },
    known,
    now,
  )!
  assert.equal(offer.price, 4.99)
  assert.equal(offer.regularPrice, undefined)
  assert.equal(offer.featured, false)
  assert.equal(offer.saleEnd, undefined)
  assert.equal(offer.spec?.upc, '0123')
  assert.equal(offer.spec?.comparisonGroupId, 'gala-3lb')
})

test('search calls the banana.search_offers function with the publishable key', async () => {
  let seen: { url: string; init: RequestInit } | undefined
  const fetcher = (async (url: URL, init: RequestInit) => {
    seen = { url: String(url), init }
    return new Response(JSON.stringify([row]), { status: 200 })
  }) as unknown as typeof fetch
  const rows = await searchOffers(
    'https://example.supabase.co',
    'sb_publishable_test',
    { p_query: 'apples' },
    new AbortController().signal,
    fetcher,
  )
  assert.equal(rows.length, 1)
  assert.ok(seen)
  assert.equal(
    seen.url,
    'https://example.supabase.co/rest/v1/rpc/search_offers',
  )
  assert.equal(seen.init.method, 'POST')
  const headers = seen.init.headers as Record<string, string>
  assert.equal(headers['Content-Profile'], 'banana')
  assert.equal(seen.init.body, JSON.stringify({ p_query: 'apples' }))
})
