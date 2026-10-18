import type {
  Chain,
  MemberPricing,
  NearbyStore,
  PriceFilters,
  PriceRow,
  PriceSearchResult,
  ShoppingListRequest,
  ShoppingListResult,
  StoreLocation,
} from '../types';

/**
 * The read side: everything the website needs from the database.
 * It only ever sees the final data, never the per-store layer.
 *
 * Writing is split off: StoreDataRepository (storeData.ts) for the per-store layer
 * and FinalRepository (final.ts) for the final layer. One version of this
 * will talk to Supabase with the limited key and another works on
 * in-memory data for local work (MemoryPriceRepository), so code using it
 * works with either. The rules for what each filter means are in search/search.ts.
 */
export interface PriceRepository {
  /** Search prices using the filters. Leave `filters` out to get everything (up to the default limit). */
  searchPrices(filters?: PriceFilters): Promise<PriceSearchResult>;

  /**
   * Rows for specific item ids, in the order asked for. Unknown ids are left out.
   * For an item page, or a saved shopping list.
   */
  getItems(ids: readonly string[], options?: { memberPricing?: MemberPricing }): Promise<PriceRow[]>;

  /**
   * Price a whole shopping list in the chosen stores: the cheapest matches for each entry,
   * the total at each chain, and the cheapest mix. The rules are in search/shoppingList.ts.
   */
  priceShoppingList(request: ShoppingListRequest): Promise<ShoppingListResult>;

  /** Every chain, for the list of available stores and the store filters. */
  listChains(): Promise<Chain[]>;

  /** Every physical store (or just some chains'), for showing on a map. */
  listStoreLocations(options?: { chainSlugs?: readonly string[] }): Promise<StoreLocation[]>;

  /**
   * Physical stores within `radiusKm` of a point, nearest first. `chainSlugs` keeps only
   * those chains' stores (empty or missing: every chain), e.g. "Walmart stores within 5 km".
   */
  storesWithinRadius(
    lat: number,
    lng: number,
    radiusKm: number,
    options?: { chainSlugs?: readonly string[] },
  ): Promise<NearbyStore[]>;
}
