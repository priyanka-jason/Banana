import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createSupabaseReader,
  loadCatalogue,
  mapPrice,
  unitPrice,
  type PriceRow,
} from '../src/api/supabaseCatalogue.ts'

const row: PriceRow = {
  id: 1,
  location_id: null,
  regular_price_cents: 499,
  sale_price_cents: 349,
  sale_start: '2026-10-16',
  sale_end: '2026-10-22',
  scraped_at: '2026-10-17T13:00:00Z',
  products: {
    id: 1,
    chain_slug: 'no-frills',
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
}
const now = new Date('2026-10-17T20:00:00Z')
test('maps stable chain offers, cents, source metadata and local images', () => {
  const offer = mapPrice(row, now)!
  assert.equal(offer.id, 'no-frills:sim-gala-apples')
  assert.equal(offer.price, 3.49)
  assert.equal(offer.regularPrice, 4.99)
  assert.equal(offer.saleEnd, '2026-10-22')
  assert.equal(offer.image, '/images/gala-apples.webp')
  assert.equal(offer.source, 'supabase')
  assert.equal(offer.updatedAt, row.scraped_at)
  assert.equal(offer.simulated, true)
})
test('future/expired/invalid sales never create fake discounts; Vancouver date controls expiry', () => {
  for (const patch of [
    { sale_start: '2026-10-18' },
    { sale_end: '2026-10-16' },
    { sale_price_cents: 999 },
    { sale_price_cents: -1 },
  ]) {
    const offer = mapPrice({ ...row, ...patch }, now)!
    assert.equal(offer.price, 4.99)
    assert.equal(offer.regularPrice, undefined)
    assert.equal(offer.saleEnd, undefined)
  }
  assert.equal(
    mapPrice(
      { ...row, sale_end: '2026-10-17' },
      new Date('2026-10-18T02:00:00Z'),
    )!.price,
    3.49,
  )
})
test('missing prices are excluded; missing images, dates and units are not invented', () => {
  assert.equal(mapPrice({ ...row, regular_price_cents: null }, now), null)
  assert.equal(mapPrice({ ...row, regular_price_cents: 3.49 }, now), null)
  const offer = mapPrice(
    {
      ...row,
      sale_end: null,
      products: { ...row.products, sku: 'unknown', size_total_base: null },
    },
    now,
  )!
  assert.equal(offer.image, '')
  assert.equal(offer.unitPrice, '')
  assert.equal(offer.saleEnd, undefined)
})
test('unit prices account for total pack quantities and pounds', () => {
  assert.equal(
    unitPrice(
      { ...row.products, size_kind: 'volume', size_total_base: 2000 },
      349,
    ),
    '$1.75/L',
  )
  assert.equal(
    unitPrice(
      { ...row.products, size_kind: 'count', size_total_base: 12 },
      399,
    ),
    '$0.33 each',
  )
  assert.equal(
    unitPrice(
      {
        ...row.products,
        priced_by_weight: true,
        size_unit: 'lb',
        size_total_base: 453.59237,
      },
      49,
    ),
    '$0.49/lb',
  )
})
test('reader uses anonymous schema headers, POST body and abort signal; rejects admin keys', async () => {
  const signal = new AbortController().signal
  let observed: { url: string; init: RequestInit } | undefined
  const fake = async (url: string | URL | Request, init?: RequestInit) => {
    observed = { url: String(url), init: init! }
    return Response.json([])
  }
  const read = createSupabaseReader(
    'https://example.supabase.co',
    'sb_publishable_demo',
    fake,
  )
  await read('rpc/stores_within_radius', signal, {
    user_lat: 49.26,
    user_lng: -123.1,
    radius_km: 5,
  })
  assert.equal(
    observed!.url,
    'https://example.supabase.co/rest/v1/rpc/stores_within_radius',
  )
  assert.equal(observed!.init.method, 'POST')
  assert.equal(observed!.init.signal, signal)
  assert.equal(observed!.init.credentials, 'omit')
  assert.equal(
    new Headers(observed!.init.headers).get('Content-Profile'),
    'banana',
  )
  assert.ok(String(observed!.init.body).includes('49.26'))
  assert.throws(() =>
    createSupabaseReader('https://example.supabase.co', 'sb_secret_no'),
  )
  const admin = `eyJ.${btoa(JSON.stringify({ role: 'service_role' }))}.x`
  assert.throws(() =>
    createSupabaseReader('https://example.supabase.co', admin),
  )
})
test('permission failure is distinct from empty data and does not expose response secrets', async () => {
  const read = createSupabaseReader(
    'https://example.supabase.co',
    'sb_publishable_demo',
    async () => new Response('private error detail', { status: 403 }),
  )
  await assert.rejects(
    read('chains', new AbortController().signal),
    /request failed \(403\)/,
  )
})
test('snapshot paginates beyond one page, joins chains and excludes unsupported/invalid branches', async () => {
  const calls: string[] = []
  const fake = async (target: string | URL | Request) => {
    const url = new URL(String(target))
    calls.push(url.pathname + url.search)
    if (url.pathname.endsWith('/chains'))
      return Response.json([{ slug: 'no-frills', name: 'No Frills' }])
    if (url.pathname.endsWith('/products'))
      return Response.json([{ id: 1 }, { id: 999 }])
    if (url.pathname.endsWith('/store_locations'))
      return Response.json([
        {
          id: 'yes',
          chain_slug: 'no-frills',
          address: null,
          location: 'point',
        },
        {
          id: 'bad',
          chain_slug: 'no-frills',
          address: 'Street',
          location: null,
        },
      ])
    if (url.pathname.endsWith('/stores_within_radius'))
      return Response.json([
        {
          id: 'yes',
          chain_slug: 'no-frills',
          name: 'Broadway',
          address: null,
          city: 'Vancouver',
          lat: 49.26,
          lng: -123.1,
        },
        {
          id: 'no',
          chain_slug: 'unknown',
          name: 'No offers',
          lat: 49.26,
          lng: -123.1,
        },
        {
          id: 'bad',
          chain_slug: 'no-frills',
          name: 'No point',
          lat: null,
          lng: null,
        },
      ])
    const offset = Number(url.searchParams.get('offset'))
    return Response.json(
      offset === 0
        ? Array.from({ length: 200 }, (_, i) => ({
            ...row,
            id: i,
            products: { ...row.products, sku: `sim-${i}` },
          }))
        : [{ ...row, id: 201 }],
    )
  }
  const data = await loadCatalogue(
    'https://example.supabase.co',
    'sb_publishable_demo',
    new AbortController().signal,
    fake,
  )
  assert.equal(data.offers.length, 201)
  assert.equal(data.branches.length, 1)
  assert.equal(data.diagnostics?.missingPrices, 1)
  assert.equal(data.diagnostics?.missingAddresses, 1)
  assert.equal(data.diagnostics?.excludedLocations, 1)
  assert.equal(data.diagnostics?.missingWebsites, 1)
  assert.equal(data.stores[0].website, '')
  assert.ok(calls.some((path) => path.includes('offset=200')))
  assert.ok(calls.some((path) => path.includes('location_id=is.null')))
})
