import type { Filters, SortOrder } from '../types.ts'

// Turns the site's search filters into the inputs of the database function
// banana.search_offers (backend/sql/migrations/003_search_nearest_store.sql).
// The database decides which offers match, their order and their price, so the
// website and any phone app give the same answer for the same search.

export const SEARCH_PAGE_SIZE = 50

export interface SearchOffersBody {
  p_query: string | null
  p_categories: string[] | null
  p_chain_slugs: string[] | null
  p_location_ids: string[] | null
  p_near_lat: number
  p_near_lng: number
  p_radius_km: number
  p_on_sale_only: boolean
  p_sort_by: 'price' | 'distance' | 'discount'
  p_sort_order: 'asc' | 'desc' | null
  p_limit: number
  p_offset: number
}

export interface Point {
  latitude: number
  longitude: number
}

/** Two decimals (about 1 km): the exact address never leaves the device. */
export function roundedPoint(point: Point): Point {
  return {
    latitude: Math.round(point.latitude * 100) / 100,
    longitude: Math.round(point.longitude * 100) / 100,
  }
}

// 'recommended' (shown as "Featured") puts current deals first, biggest discount
// first, then everything else cheapest first.
const SORTS: Record<
  SortOrder,
  Pick<SearchOffersBody, 'p_sort_by' | 'p_sort_order'>
> = {
  recommended: { p_sort_by: 'discount', p_sort_order: null },
  price: { p_sort_by: 'price', p_sort_order: null },
  'price-desc': { p_sort_by: 'price', p_sort_order: 'desc' },
  distance: { p_sort_by: 'distance', p_sort_order: null },
  discount: { p_sort_by: 'discount', p_sort_order: null },
}

export function searchOffersBody(
  filters: Filters,
  point: Point,
  options: { branchId?: string | null; limit?: number; offset?: number } = {},
): SearchOffersBody {
  const near = roundedPoint(point)
  const query = filters.query.trim()
  return {
    p_query: query || null,
    p_categories: filters.category === 'all' ? null : [filters.category],
    p_chain_slugs: filters.store === 'all' ? null : [filters.store],
    p_location_ids: options.branchId ? [options.branchId] : null,
    p_near_lat: near.latitude,
    p_near_lng: near.longitude,
    // The database accepts more than 0 and at most 10 km.
    p_radius_km: Math.min(10, Math.max(1, filters.radius)),
    p_on_sale_only: filters.discountsOnly,
    ...(SORTS[filters.sort] ?? SORTS.recommended),
    p_limit: options.limit ?? SEARCH_PAGE_SIZE,
    p_offset: options.offset ?? 0,
  }
}
