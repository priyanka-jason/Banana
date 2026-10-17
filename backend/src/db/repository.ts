import type {
  Chain,
  NearbyStore,
  PriceFilters,
  PriceRow,
  RawItem,
  StoreLocation,
} from '../types';

/**
 * Everything the app needs from the database, in one place.
 * One version will talk to Supabase and another will keep data in memory
 * for local work. Code that uses this interface works with either.
 */
export interface PriceRepository {
  upsertChains(chains: Chain[]): Promise<void>;

  upsertLocations(locations: StoreLocation[]): Promise<void>;

  /**
   * Save items and their latest prices for one chain.
   * An item with a `sku` that already exists is updated, not duplicated.
   * Returns how many items were saved.
   */
  upsertItems(chainSlug: string, items: RawItem[], scrapedAt: string): Promise<number>;

  /** Search prices using the filters. Leave `filters` out to get everything (up to the default limit). */
  searchPrices(filters?: PriceFilters): Promise<PriceRow[]>;

  /** Physical stores within `radiusKm` of a point, nearest first. */
  storesWithinRadius(lat: number, lng: number, radiusKm: number): Promise<NearbyStore[]>;
}
