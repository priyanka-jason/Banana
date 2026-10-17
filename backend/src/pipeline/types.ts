import type { ProductCategory } from '../categories';
import type { SizeKind, SizeUnit } from '../types';

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
   * The cleaned item as the connector saved it, as plain JSON. Normally a RawItem
   * (without `original`). Extra store-specific fields are allowed and are ignored
   * by the combine step.
   */
  payload: Record<string, unknown>;
  /**
   * The store's data for this item exactly as received, untouched. Kept in its
   * own column so the cleaned `payload` stays clean. Missing only if the connector
   * didn't provide it (the ingest summary warns about that).
   */
  original?: Record<string, unknown>;
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
  /** The size as the store wrote it, e.g. "2 x 4 L". Kept for showing to people. */
  size?: string;
  /** The size split into separate values, worked out once from `size`. Missing when the size can't be read. */
  sizeAmount?: number;
  sizeUnit?: SizeUnit;
  sizeKind?: SizeKind;
  /** Everything in the pack in a base unit: grams for weight, millilitres for volume, items for count. 8000 for "2 x 4 L". */
  sizeTotalBase?: number;
  /** How many packs are bundled: 2 for "2 x 4 L". 1 for a single pack, or when the size can't be read. */
  packCount: number;
  /** True when the price is per unit of weight ("per lb", "per kg") rather than for a package. */
  pricedByWeight: boolean;
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

/** An item whose size text could not be split into amount and unit. The item is still saved. */
export interface UnreadableSize {
  chainSlug: string;
  sku: string;
  size: string;
}

export interface CombineResult {
  items: FinalItem[];
  /** Items that failed the checks. They are left out of `items` and the rest still go through. */
  rejected: RejectedRecord[];
  /** Shared category was guessed from keywords. A person should review these. One entry per store category path. */
  guessedCategories: CategoryNote[];
  /** Nothing matched, so the shared category is 'other'. Add these to CATEGORY_MAP. One entry per store category path. */
  unmappedCategories: CategoryNote[];
  /** Items that have a size text we couldn't read. Their size columns are left empty. */
  unreadableSizes: UnreadableSize[];
}
