import type { ProductCategory } from '../categories';

/**
 * The data goes through two layers:
 *
 *   store connectors -> per-store layer (StoreRecord) -> combine step -> final layer (FinalItem)
 *
 * The per-store layer is private: the website never reads it. Only the final
 * layer is exposed to the website.
 */

/**
 * One item as saved in a store's own layer: a few real columns plus the item's
 * data as JSON. It keeps the store's own category names and wording.
 */
export interface StoreRecord {
  chainSlug: string;
  /** The store's own id for the item. Same as `payload.sku`. */
  sku: string;
  /** When the connector fetched it (ISO date-time). */
  scrapedAt: string;
  /**
   * The item as the connector saved it, as plain JSON. Normally a RawItem.
   * Extra store-specific fields are allowed and are ignored by the combine step.
   */
  payload: Record<string, unknown>;
}

/**
 * One item in the final layer: checked, combined across stores and given a
 * shared category. The website's PriceRow is built from this plus the chain
 * (see toPriceRow). Prices that depend on the shopper (member or not) are
 * worked out at read time, not stored.
 */
export interface FinalItem {
  /** "chain:sku", unique across stores. */
  id: string;
  chainSlug: string;
  sku: string;
  name: string;
  brand?: string;
  size?: string;
  upc?: string;
  /** One of our shared categories. */
  category: ProductCategory;
  /** The store's own category names, kept so we can see where `category` came from. */
  storeCategories: string[];
  imageUrl?: string;
  locationId?: string;
  regularPriceCents: number;
  salePriceCents?: number;
  memberPriceCents?: number;
  unitPriceCents?: number;
  unitLabel?: string;
  /** How many packs are bundled for sizes written "N x size". Only set for multi-packs. */
  multipackOf?: number;
  saleStart?: string;
  saleEnd?: string;
  sourceUrl?: string;
  scrapedAt: string;
}

/** A saved item that could not be turned into a FinalItem, and why. */
export interface RejectedRecord {
  chainSlug: string;
  sku: string;
  reason: string;
}

/** A store's category names and the shared category they ended up in. */
export interface CategoryNote {
  chainSlug: string;
  storeCategories: string[];
  category: ProductCategory;
}

export interface CombineResult {
  items: FinalItem[];
  /** Items that failed the checks. They are left out of `items` and the rest still go through. */
  rejected: RejectedRecord[];
  /** Shared category was guessed from keywords. A person should review these. One entry per store category path. */
  guessedCategories: CategoryNote[];
  /** Nothing matched, so the shared category is 'other'. Add these to CATEGORY_MAP. One entry per store category path. */
  unmappedCategories: CategoryNote[];
}
