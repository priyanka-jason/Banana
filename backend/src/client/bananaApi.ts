/**
 * Banana API connector for the website.
 *
 * Self-contained on purpose: copy this file into the frontend (for example
 * frontend/src/api/bananaApi.ts) and it works there as it is. It calls the backend API and turns
 * its rows into the shapes the website already uses (offers, stores, branches). It is tested
 * in the backend (src/client/bananaApi.test.ts) against the real API.
 *
 * Where the API is:
 *   - local development: leave `baseUrl` empty and start the site with
 *     API_PROXY_TARGET=http://127.0.0.1:8787, so "/api" goes through the Vite proxy;
 *   - the live site: set `baseUrl` to the deployed API, for example
 *     createBananaApi({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? '' }).
 *
 * Privacy: a location only ever goes in a POST body, rounded to 2 decimals (about 1 km),
 * never in a URL. Nothing here stores it.
 */

// ---------------------------------------------------------------------------
// What the API sends (a subset of backend/docs/api-contract.md)
// ---------------------------------------------------------------------------

export interface ApiPriceRow {
  id: string;
  chainSlug: string;
  chainName: string;
  sku: string;
  name: string;
  brand?: string;
  size?: string;
  sizeUnit?: string;
  packCount: number;
  pricedByWeight: boolean;
  category?: string;
  priceCents: number;
  regularPriceCents: number;
  discountCents?: number;
  discountPercent?: number;
  saleEnd?: string;
  comparableUnitPrice?: { per: '100g' | '100ml' | 'each'; cents: number };
  sourceUrl?: string;
  scrapedAt: string;
  distanceKm?: number;
}

export interface ApiStore {
  id: string;
  chainSlug: string;
  name: string;
  address?: string;
  city?: string;
  postalCode?: string;
  lat: number;
  lng: number;
  distanceKm?: number;
}

export interface ApiChain {
  slug: string;
  name: string;
  parentCompany: string;
  hasMemberPricing: boolean;
  websiteUrl?: string;
}

export interface ApiCategory {
  slug: string;
  label: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: Array<{ field: string; message: string }> };
}

/** The API answered with an error. `message` is safe to show; it never contains a location. */
export class BananaApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Array<{ field: string; message: string }> = [],
  ) {
    super(message);
    this.name = 'BananaApiError';
  }
}

// ---------------------------------------------------------------------------
// The website's shapes
// ---------------------------------------------------------------------------

/** A point to measure distance from: a neighbourhood, an address, or the visitor's location. */
export interface Origin {
  latitude: number;
  longitude: number;
}

/** One offer, shaped like the website's Offer / NearbyOffer. */
export interface BananaOffer {
  id: string;
  /** The same product at every chain, for picking an image: "sim-gala-apples". */
  productKey: string;
  name: string;
  pack: string;
  /** Category slug, like "fruits"; show its label from categories(). */
  category: string;
  price: number;
  /** Only when the offer is a discount. */
  regularPrice?: number;
  /** "$1.16/lb", "$2.60/L", "$0.80 each", or "" when unknown. */
  unitPrice: string;
  /** The website's store id ("superstore", not "real-canadian-superstore"). */
  storeId: string;
  storeName: string;
  /** Kilometres to the nearest branch in range; only when an origin or branch was given. */
  distance?: number;
  /** "2026-10-22" when the offer is a discount with an end date. */
  validUntil?: string;
  /** The offer's own page, when the data has one. Otherwise use the store's website. */
  link?: string;
  /** When the price was last updated (ISO time). */
  updatedAt: string;
}

/** One physical store, shaped like the website's StoreBranch. */
export interface BananaBranch {
  id: string;
  brandId: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  /** Only from nearbyBranches(). */
  distance?: number;
}

export type WebsiteSort = 'recommended' | 'featured' | 'price' | 'price-desc' | 'distance' | 'discount';

export interface OfferSearch {
  query?: string;
  /** A category slug from categories(), or "all". */
  category?: string;
  /** A website store id ("superstore", "no-frills", ...), or "all". */
  store?: string;
  discountsOnly?: boolean;
  sort?: WebsiteSort;
  /** With `radiusKm`: only stores within that distance, and each offer gets `distance`. */
  origin?: Origin | null;
  radiusKm?: number;
  /** A branch picked on the Locations page: that chain's offers. */
  branchId?: string | null;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Conversions
// ---------------------------------------------------------------------------

/** Backend chain slug to the website's store id, and back. Only Superstore differs. */
const WEBSITE_STORE_IDS: Readonly<Record<string, string>> = { 'real-canadian-superstore': 'superstore' };
const BACKEND_CHAIN_SLUGS: Readonly<Record<string, string>> = { superstore: 'real-canadian-superstore' };

export const toWebsiteStoreId = (chainSlug: string): string => WEBSITE_STORE_IDS[chainSlug] ?? chainSlug;
export const toBackendChainSlug = (storeId: string): string => BACKEND_CHAIN_SLUGS[storeId] ?? storeId;

const GRAMS_PER_LB = 453.59237;
const money = (dollars: number): string => `$${dollars.toFixed(2)}`;

/** The price per standard unit as the website shows it: "$1.16/lb", "$2.60/L", "$0.80 each". */
export function formatUnitPrice(row: Pick<ApiPriceRow, 'comparableUnitPrice' | 'sizeUnit'>): string {
  const unit = row.comparableUnitPrice;
  if (unit === undefined) return '';
  if (unit.per === 'each') return `${money(unit.cents / 100)} each`;
  if (unit.per === '100ml') return `${money((unit.cents * 10) / 100)}/L`;
  // Weight: per lb when the store sells it in pounds or ounces, otherwise per kg.
  if (row.sizeUnit === 'lb' || row.sizeUnit === 'oz') return `${money((unit.cents * (GRAMS_PER_LB / 100)) / 100)}/lb`;
  return `${money((unit.cents * 10) / 100)}/kg`;
}

/** An API row as a website offer. */
export function toOffer(row: ApiPriceRow): BananaOffer {
  const discounted = row.discountCents !== undefined && row.regularPriceCents > row.priceCents;
  return {
    id: row.id,
    productKey: row.sku,
    name: row.name,
    pack: row.size ?? '',
    category: row.category ?? 'other',
    price: row.priceCents / 100,
    ...(discounted ? { regularPrice: row.regularPriceCents / 100 } : {}),
    unitPrice: formatUnitPrice(row),
    storeId: toWebsiteStoreId(row.chainSlug),
    storeName: row.chainName,
    ...(row.distanceKm !== undefined ? { distance: row.distanceKm } : {}),
    ...(discounted && row.saleEnd !== undefined ? { validUntil: row.saleEnd } : {}),
    ...(row.sourceUrl !== undefined ? { link: row.sourceUrl } : {}),
    updatedAt: row.scrapedAt,
  };
}

/** An API store as a website branch. */
export function toBranch(store: ApiStore): BananaBranch {
  return {
    id: store.id,
    brandId: toWebsiteStoreId(store.chainSlug),
    name: store.name,
    address: store.address ?? '',
    city: store.city ?? '',
    postalCode: store.postalCode ?? '',
    latitude: store.lat,
    longitude: store.lng,
    ...(store.distanceKm !== undefined ? { distance: store.distanceKm } : {}),
  };
}

/** 2 decimals is about 1 km: enough for a radius, without sending an exact address. */
const round2 = (value: number): number => Math.round(value * 100) / 100;

const SORTS: Readonly<Record<WebsiteSort, { sortBy: string; sortOrder?: 'asc' | 'desc' }>> = {
  // "Recommended" / "Featured": the best deals first.
  recommended: { sortBy: 'discount' },
  featured: { sortBy: 'discount' },
  price: { sortBy: 'price' },
  'price-desc': { sortBy: 'price', sortOrder: 'desc' },
  distance: { sortBy: 'distance' },
  discount: { sortBy: 'discount' },
};

/** The JSON body for POST /api/prices/search. */
export function searchBody(search: OfferSearch): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (search.query?.trim()) body['query'] = search.query.trim();
  if (search.category && search.category !== 'all') body['categories'] = [search.category];
  if (search.store && search.store !== 'all') body['chainSlugs'] = [toBackendChainSlug(search.store)];
  if (search.discountsOnly) body['onSaleOnly'] = true;
  if (search.branchId) body['locationIds'] = [search.branchId];
  else if (search.origin && search.radiusKm !== undefined) {
    body['near'] = { lat: round2(search.origin.latitude), lng: round2(search.origin.longitude), radiusKm: search.radiusKm };
  }
  const sort = SORTS[search.sort ?? 'recommended'];
  // Distance needs a location; without one, fall back to price.
  if (sort.sortBy === 'distance' && body['near'] === undefined) body['sortBy'] = 'price';
  else {
    body['sortBy'] = sort.sortBy;
    if (sort.sortOrder !== undefined) body['sortOrder'] = sort.sortOrder;
  }
  if (search.limit !== undefined) body['limit'] = search.limit;
  if (search.offset !== undefined) body['offset'] = search.offset;
  return body;
}

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------

export interface BananaApiOptions {
  /** "" for the same site (or the dev proxy); the API's https address on the live site. */
  baseUrl?: string;
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
}

export function createBananaApi(options: BananaApiOptions = {}) {
  const base = (options.baseUrl ?? '').replace(/\/+$/, '');
  const doFetch = options.fetch ?? ((input: string, init?: RequestInit) => fetch(input, init));

  async function call<T>(path: string, init?: { body: unknown; signal?: AbortSignal } | { signal?: AbortSignal }): Promise<T> {
    const hasBody = init !== undefined && 'body' in init;
    const response = await doFetch(`${base}${path}`, {
      method: hasBody ? 'POST' : 'GET',
      headers: hasBody ? { 'Content-Type': 'application/json' } : {},
      ...(hasBody ? { body: JSON.stringify(init.body) } : {}),
      signal: init?.signal,
      credentials: 'omit',
    });
    const text = await response.text();
    let data: unknown;
    try {
      data = text === '' ? undefined : JSON.parse(text);
    } catch {
      throw new BananaApiError(response.status, 'bad_response', 'The price service sent an unreadable answer. Try again.');
    }
    if (!response.ok) {
      const error = (data as ApiErrorBody | undefined)?.error;
      throw new BananaApiError(
        response.status,
        error?.code ?? 'unavailable',
        error?.message ?? 'The price service is unavailable. Try again.',
        error?.details,
      );
    }
    return data as T;
  }

  return {
    /** Offers for the Home, Search and branch views, already in the website's shape. */
    async searchOffers(search: OfferSearch, signal?: AbortSignal): Promise<{ offers: BananaOffer[]; total: number }> {
      const page = await call<{ rows: ApiPriceRow[]; total: number }>('/api/prices/search', { body: searchBody(search), signal });
      return { offers: page.rows.map(toOffer), total: page.total };
    },

    /** Stores near a point, nearest first, with `distance` in km. */
    async nearbyBranches(origin: Origin, radiusKm: number, signal?: AbortSignal): Promise<BananaBranch[]> {
      const body = { lat: round2(origin.latitude), lng: round2(origin.longitude), radiusKm };
      const result = await call<{ stores: ApiStore[] }>('/api/stores/nearby', { body, signal });
      return result.stores.map(toBranch);
    },

    /** Every store, for map pins. */
    async allBranches(signal?: AbortSignal): Promise<BananaBranch[]> {
      return (await call<{ stores: ApiStore[] }>('/api/stores', { signal })).stores.map(toBranch);
    },

    /** Chains for the store filter, with the website's store ids and the chain's website. */
    async stores(signal?: AbortSignal): Promise<Array<{ id: string; name: string; website?: string }>> {
      const result = await call<{ chains: ApiChain[] }>('/api/chains', { signal });
      return result.chains.map((chain) => ({
        id: toWebsiteStoreId(chain.slug),
        name: chain.name,
        ...(chain.websiteUrl !== undefined ? { website: chain.websiteUrl } : {}),
      }));
    },

    /** Categories for the category filter: send `slug`, show `label`. */
    async categories(signal?: AbortSignal): Promise<ApiCategory[]> {
      return (await call<{ categories: ApiCategory[] }>('/api/categories', { signal })).categories;
    },

    async health(signal?: AbortSignal): Promise<boolean> {
      return (await call<{ status: string }>('/api/health', { signal })).status === 'ok';
    },
  };
}

export type BananaApi = ReturnType<typeof createBananaApi>;
