import type { Offer, Store } from '../types.ts'
import type { StoreBranch } from '../data/storeLocations.ts'
import { productImage } from '../lib/productImages.ts'

export const categoryLabels: Record<string, string> = {
  fruits: 'Fruits',
  vegetables: 'Vegetables',
  meat: 'Meat',
  seafood: 'Seafood',
  'dairy-eggs': 'Dairy & Eggs',
  bakery: 'Bakery',
  frozen: 'Frozen',
  beverages: 'Beverages',
  snacks: 'Snacks',
  pantry: 'Pantry',
  household: 'Household',
  other: 'Other',
}
export interface Catalogue {
  stores: Store[]
  offers: Offer[]
  branches: StoreBranch[]
  simulated: boolean
  diagnostics?: {
    priceRows: number
    excludedPrices: number
    excludedLocations: number
    missingAddresses: number
    missingWebsites: number
    missingPrices: number
  }
}
export interface ProductRow {
  id: number
  chain_slug: string
  sku: string
  name: string
  size: string | null
  category: string | null
  pack_count: number
  priced_by_weight: boolean
  size_kind: string | null
  size_total_base: number | null
  size_unit: string | null
}
export interface PriceRow {
  id: number
  location_id: string | null
  regular_price_cents: number | null
  sale_price_cents: number | null
  sale_start: string | null
  sale_end: string | null
  scraped_at: string | null
  source_url?: string | null
  products: ProductRow
}
interface ChainRow {
  slug: string
  name: string
  website_url?: string | null
}
interface BranchRow {
  id: string
  chain_slug: string
  name: string
  address: string | null
  city: string | null
  lat: number
  lng: number
}
const assets: Record<string, string> = {
  'save-on-foods': '/images/stores/save-on-foods.png',
  'no-frills': '/images/stores/no-frills.svg',
  walmart: '/images/stores/walmart.svg',
  'real-canadian-superstore': '/images/stores/superstore-mark.svg',
}
export function unitPrice(product: ProductRow, cents: number): string {
  const total = Number(product.size_total_base)
  if (!(total > 0)) return ''
  if (product.size_kind === 'count')
    return `$${(Math.round(cents / total) / 100).toFixed(2)} each`
  if (product.size_kind === 'volume')
    return `$${(Math.round((cents * 1000) / total) / 100).toFixed(2)}/L`
  if (product.size_kind === 'weight') {
    const pounds = product.priced_by_weight && product.size_unit === 'lb'
    return `$${(Math.round((cents * (pounds ? 453.59237 : 1000)) / total) / 100).toFixed(2)}/${pounds ? 'lb' : 'kg'}`
  }
  return ''
}
export function mapPrice(row: PriceRow, now = new Date()): Offer | null {
  const product = row.products
  const regular = row.regular_price_cents
  if (
    !product ||
    !product.sku ||
    !Number.isInteger(regular) ||
    regular === null ||
    regular < 0
  )
    return null
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const sale = row.sale_price_cents
  const active =
    Number.isInteger(sale) &&
    sale !== null &&
    sale >= 0 &&
    sale < regular &&
    (!row.sale_start || row.sale_start <= today) &&
    (!row.sale_end || row.sale_end >= today)
  const cents = active ? sale! : regular
  return {
    id: `${product.chain_slug}:${product.sku}`,
    name: product.name,
    pack: product.size ?? '',
    category: product.category ?? 'other',
    image: productImage(product.sku, product.size),
    price: cents / 100,
    regularPrice: active ? regular / 100 : undefined,
    unitPrice: unitPrice(product, cents),
    storeId: product.chain_slug,
    distances: {
      'mount-pleasant': Infinity,
      kitsilano: Infinity,
      downtown: Infinity,
    },
    featured: active,
    saleEnd: active ? (row.sale_end ?? undefined) : undefined,
    updatedAt: row.scraped_at ?? undefined,
    source: 'supabase',
    simulated: product.sku.startsWith('sim-'),
    sourceUrl: row.source_url?.startsWith('https://')
      ? row.source_url
      : undefined,
    missingFields: [
      !product.size?.trim() ? 'Package size' : '',
      !product.category ? 'Category' : '',
      !unitPrice(product, cents) ? 'Unit-price details' : '',
      active && !row.sale_end ? 'Sale expiry' : '',
      !row.scraped_at || !Number.isFinite(Date.parse(row.scraped_at))
        ? 'Update time'
        : '',
      !row.source_url?.startsWith('https://') ? 'Flyer/source link' : '',
    ].filter(Boolean),
  }
}

export function createSupabaseReader(
  url: string,
  key: string,
  fetcher: typeof fetch = fetch,
) {
  const origin = new URL(url)
  if (
    origin.protocol !== 'https:' ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  )
    throw new Error('Use the HTTPS Supabase project URL.')
  if (!key || key.startsWith('sb_secret_'))
    throw new Error('Configure a browser-safe Supabase publishable key.')
  // Refuse legacy privileged JWTs too; never send an administrative key from the browser.
  if (key.startsWith('eyJ')) {
    try {
      if (JSON.parse(atob(key.split('.')[1])).role !== 'anon')
        throw new Error('role')
    } catch {
      throw new Error('Only a publishable key or legacy anon key is allowed.')
    }
  }
  return async function read<T>(
    path: string,
    signal: AbortSignal,
    body?: object,
  ): Promise<T> {
    const response = await fetcher(new URL(`/rest/v1/${path}`, origin), {
      method: body ? 'POST' : 'GET',
      signal,
      credentials: 'omit',
      headers: {
        apikey: key,
        [body ? 'Content-Profile' : 'Accept-Profile']: 'banana',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    if (!response.ok)
      throw new Error(
        `Supabase catalogue request failed (${response.status}). Check catalogue read permissions and try again.`,
      )
    return response.json() as Promise<T>
  }
}

export async function loadCatalogue(
  url: string,
  key: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<Catalogue> {
  const read = createSupabaseReader(url, key, fetcher)
  const pageSize = 200
  // Temporary bounded demo snapshot: paginate completely, never silently truncate.
  // Replace with server search RPC before growing beyond the 5,000-offer demo limit.
  async function pages<T>(table: string, select: string, extra = '') {
    const result: T[] = []
    for (let offset = 0; offset <= 5000; offset += pageSize) {
      const params = new URLSearchParams({
        select,
        order: table === 'chains' ? 'slug' : 'id',
        limit: String(pageSize),
        offset: String(offset),
      })
      const page = await read<T[]>(`${table}?${params}${extra}`, signal)
      result.push(...page)
      if (result.length > 5000)
        throw new Error(
          'The catalogue exceeds the demo limit. Server-side search is required; results have not been truncated.',
        )
      if (page.length < pageSize) return result
    }
    throw new Error('Catalogue pagination could not complete.')
  }
  const [chains, prices, locations, products, branchMetadata] =
    await Promise.all([
      pages<ChainRow>('chains', '*'),
      pages<PriceRow>(
        'prices',
        'id,location_id,regular_price_cents,sale_price_cents,sale_start,sale_end,scraped_at,source_url,products!inner(id,chain_slug,sku,name,size,category,pack_count,priced_by_weight,size_kind,size_total_base,size_unit)',
        '&location_id=is.null',
      ),
      read<BranchRow[]>('rpc/stores_within_radius', signal, {
        user_lat: 49.26,
        user_lng: -123.1,
        radius_km: 150,
      }),
      pages<{ id: number }>('products', 'id'),
      pages<{
        id: string
        chain_slug: string
        address: string | null
        location: unknown
      }>('store_locations', 'id,chain_slug,address,location'),
    ])
  const stores = chains.map((chain) => ({
    id: chain.slug,
    name: chain.name,
    logo: assets[chain.slug] ?? '',
    website: chain.website_url?.startsWith('https://') ? chain.website_url : '',
  }))
  const offers = prices
    .map((row) => mapPrice(row))
    .filter(
      (offer): offer is Offer =>
        offer !== null && stores.some((store) => store.id === offer.storeId),
    )
  const supported = new Set(offers.map((offer) => offer.storeId))
  const branches = locations
    .filter(
      (branch) =>
        supported.has(branch.chain_slug) &&
        Number.isFinite(branch.lat) &&
        Number.isFinite(branch.lng),
    )
    .map((branch) => ({
      id: branch.id,
      brandId: branch.chain_slug,
      name: branch.name,
      address: [branch.address, branch.city].filter(Boolean).join(', '),
      latitude: branch.lat,
      longitude: branch.lng,
      missingAddress: !branch.address?.trim(),
    }))
  return {
    stores,
    offers,
    branches,
    simulated: offers.some((offer) => offer.simulated),
    diagnostics: {
      priceRows: prices.length,
      missingPrices: products.filter(
        (product) => !prices.some((price) => price.products.id === product.id),
      ).length,
      missingWebsites: chains.filter(
        (chain) => !chain.website_url?.startsWith('https://'),
      ).length,
      excludedPrices: prices.length - offers.length,
      excludedLocations: branchMetadata.filter(
        (branch) => supported.has(branch.chain_slug) && !branch.location,
      ).length,
      missingAddresses: branchMetadata.filter(
        (branch) => supported.has(branch.chain_slug) && !branch.address?.trim(),
      ).length,
    },
  }
}
