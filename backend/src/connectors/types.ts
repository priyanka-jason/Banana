import type { Chain, RawItem, StoreLocation } from '../types';

/**
 * Every store gets one connector. Save-On-Foods, Walmart, Costco, and the
 * No Frills and Superstore scrapers all implement this, so the rest of the
 * code can treat every store the same way.
 */
export interface StoreConnector {
  readonly chain: Chain;

  /**
   * Fetch the store's current items and prices. Sample data is fine until real fetching exists.
   * Set `original` on every item to the store's untouched data, so the per-store layer keeps it.
   */
  fetchItems(): Promise<RawItem[]>;

  /** Optional: physical store addresses, for the distance filter. */
  fetchLocations?(): Promise<StoreLocation[]>;
}
