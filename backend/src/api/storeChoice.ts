import type { PriceFilters } from '../types';

/**
 * Where the shopper wants to buy, as the website asks it, turned into the fields the API
 * understands. The shopper picks one of:
 *
 * - any store (no store filter),
 * - specific stores, picked on a map or from a list (ids from /api/stores or /api/stores/nearby),
 * - any store within a distance of them, set with a 1 to 10 km slider (needs the browser's location),
 *
 * and, separately, can narrow it to some chains (e.g. only Walmart and Costco).
 *
 * This file only imports types, so the website can import or copy it as it is.
 * Everything it builds goes in a POST body, never in a URL, because it can carry the
 * shopper's location (see "A visitor's location stays out of URLs" in api-contract.md).
 */

/**
 * The "stores near me" distance slider, in km: <input type="range" min max step value>.
 * The API itself accepts any distance above 0 and up to 200, so this range can change
 * without a backend change.
 */
export const STORE_RADIUS_SLIDER_KM = { min: 1, max: 10, step: 1, default: 5 } as const;

/** A slider value made safe to send: snapped to the step and kept between min and max. Not a number: the default. */
export function clampRadiusKm(value: number): number {
  const { min, max, step } = STORE_RADIUS_SLIDER_KM;
  if (!Number.isFinite(value)) return STORE_RADIUS_SLIDER_KM.default;
  const snapped = Math.round(value / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

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
 * The store part of a POST /api/prices/search (or /api/prices/list) body. The radius goes
 * through clampRadiusKm(). Spread it into the rest of the search:
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
    filters.near = { lat: roundCoordinate(where.lat), lng: roundCoordinate(where.lng), radiusKm: clampRadiusKm(where.radiusKm) };
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
  const body = { lat: roundCoordinate(where.lat), lng: roundCoordinate(where.lng), radiusKm: clampRadiusKm(where.radiusKm) };
  return chainSlugs !== undefined && chainSlugs.length > 0 ? { ...body, chainSlugs: [...chainSlugs] } : body;
}
