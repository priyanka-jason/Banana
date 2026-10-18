import type { PriceFilters } from '../types';

/**
 * Where the shopper wants to buy, as the website asks it, turned into the fields the API
 * understands. The shopper picks one of:
 *
 * - any store (no store filter),
 * - specific stores, picked on a map or from a list (ids from /api/stores or /api/stores/nearby),
 * - any store within a distance of them, e.g. 5 km or 10 km (needs the browser's location),
 *
 * and, separately, can narrow it to some chains (e.g. only Walmart and Costco).
 *
 * This file only imports types, so the website can import or copy it as it is.
 * Everything it builds goes in a POST body, never in a URL, because it can carry the
 * shopper's location (see "A visitor's location stays out of URLs" in api-contract.md).
 */

/** The distances to offer in the "stores near me" choice, in km. The API accepts any distance up to 200. */
export const STORE_RADIUS_OPTIONS_KM = [5, 10] as const;
export const DEFAULT_STORE_RADIUS_KM: (typeof STORE_RADIUS_OPTIONS_KM)[number] = 5;

export type StoreChoice =
  | { kind: 'any' }
  | { kind: 'stores'; locationIds: string[] }
  | { kind: 'nearby'; lat: number; lng: number; radiusKm: number };

export interface StoreSelection {
  where: StoreChoice;
  /** Only these chains. Empty or missing: every chain. */
  chainSlugs?: string[];
}

/** About 1 km of precision is all a radius search needs, so coordinates are sent to 2 decimals. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The store part of a POST /api/prices/search body. Spread it into the rest of the search:
 * `{ query: 'milk', ...storeSelectionFilters(selection) }`.
 *
 * Picked stores and chains both apply, so pick stores from the chosen chains only:
 * a Walmart store with only Costco chosen finds nothing.
 */
export function storeSelectionFilters(selection: StoreSelection): Pick<PriceFilters, 'chainSlugs' | 'locationIds' | 'near'> {
  const filters: Pick<PriceFilters, 'chainSlugs' | 'locationIds' | 'near'> = {};
  if (selection.chainSlugs !== undefined && selection.chainSlugs.length > 0) filters.chainSlugs = [...selection.chainSlugs];

  const where = selection.where;
  if (where.kind === 'stores' && where.locationIds.length > 0) {
    filters.locationIds = [...where.locationIds];
  } else if (where.kind === 'nearby') {
    filters.near = { lat: roundCoordinate(where.lat), lng: roundCoordinate(where.lng), radiusKm: where.radiusKm };
  }
  return filters;
}

/**
 * The POST /api/stores/nearby body for a "stores near me" choice: the stores to show on the
 * map or offer in a list, already narrowed to the chosen chains.
 */
export function nearbyStoresBody(
  where: Extract<StoreChoice, { kind: 'nearby' }>,
  chainSlugs?: string[],
): { lat: number; lng: number; radiusKm: number; chainSlugs?: string[] } {
  const body = { lat: roundCoordinate(where.lat), lng: roundCoordinate(where.lng), radiusKm: where.radiusKm };
  return chainSlugs !== undefined && chainSlugs.length > 0 ? { ...body, chainSlugs: [...chainSlugs] } : body;
}
