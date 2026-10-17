import type { Chain, RawItem, StoreLocation } from '../types';

/** An item a connector could not use, and why. The rest of the items still go through. */
export interface SkippedItem {
  /** The item's sku, or something like "(item 3, no sku)" when it had none. */
  sku: string;
  /** Where it was in the store's list, starting at 0. */
  index: number;
  /** Why it was skipped. Always names the sku. */
  reason: string;
}

/** The items a connector could use, plus the ones it had to skip. */
export interface FetchResult {
  items: RawItem[];
  skipped: SkippedItem[];
}

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
   * Gives only the usable items; use fetchResult() to also see what was skipped.
   */
  fetchItems(): Promise<RawItem[]>;

  /**
   * Like fetchItems(), but one bad item (a missing price, a garbled date) is skipped and
   * reported with its sku and the reason, instead of failing the whole store. Ingest uses
   * this when it exists. Connectors should provide it: convertItems() does the work.
   */
  fetchResult?(): Promise<FetchResult>;

  /** Optional: physical store addresses, for the distance filter. */
  fetchLocations?(): Promise<StoreLocation[]>;
}
