import type { NearbyStore, PriceFilters, PriceRow } from '../types';

/**
 * The read side: everything the website needs from the database.
 * It only ever sees the final data, never the per-store layer.
 *
 * Writing is split off: StoreDataRepository (storeData.ts) for the per-store layer
 * and FinalRepository (final.ts) for the final layer. One version of this
 * will talk to Supabase with the limited key and another will work on
 * in-memory data for local work, so code using it works with either.
 */
export interface PriceRepository {
  /** Search prices using the filters. Leave `filters` out to get everything (up to the default limit). */
  searchPrices(filters?: PriceFilters): Promise<PriceRow[]>;

  /** Physical stores within `radiusKm` of a point, nearest first. */
  storesWithinRadius(lat: number, lng: number, radiusKm: number): Promise<NearbyStore[]>;
}
