/**
 * Shared data shapes for the Banana backend.
 *
 * Store connectors, the database layer and the front end all use these,
 * so change them deliberately and tell the team.
 *
 * Money is always whole cents: a $3.49 item is 349. Whole numbers avoid the
 * rounding errors decimals can cause.
 * Dates are ISO text: "2026-10-17" for a day, "2026-10-17T21:28:35Z" for a moment.
 */

import type { ProductCategory } from './categories';

/** One store brand, e.g. Save-On-Foods. Many physical stores belong to one chain. */
export interface Chain {
  /** Short lowercase id used everywhere, e.g. "save-on-foods". */
  slug: string;
  name: string;
  /** Company that owns the chain. Powers the "filter by parent company" option. */
  parentCompany: string;
  /** True if the chain shows different prices to members (loyalty card or paid membership). */
  hasMemberPricing: boolean;
}

/**
 * One physical store. Used for the distance filter and for showing stores on
 * a map (lat and lng are what map markers need).
 */
export interface StoreLocation {
  /** Stable text id the connector supplies, e.g. "costco-123" (chain + the chain's own store number). */
  id: string;
  chainSlug: string;
  name: string;
  address?: string;
  city?: string;
  postalCode?: string;
  lat: number;
  lng: number;
}

/** A store location plus how far it is from the point that was searched. */
export interface NearbyStore extends StoreLocation {
  distanceKm: number;
}

/** Units a pack size can be written in. Stores write them many ways ("KG", "lbs", "ea"), so we keep one fixed list. */
export type SizeUnit = 'g' | 'kg' | 'lb' | 'oz' | 'ml' | 'l' | 'fl oz' | 'ct';

/** What a size measures: weight, volume, or a count of items (eggs, rolls). */
export type SizeKind = 'weight' | 'volume' | 'count';

/** What a store connector returns for one item: the product and its current price. */
export interface RawItem {
  /**
   * The chain's own id for the item. It must stay the same between runs so
   * saving updates the existing price instead of creating a duplicate.
   */
  sku: string;
  name: string;
  brand?: string;
  /** Package size as printed, e.g. "500 g" or "12 ct". */
  size?: string;
  upc?: string;
  /**
   * The store's own category names for this item, broadest first, exactly as
   * the store's website words them, e.g. ["Produce", "Fruit"]. Every store uses
   * different words, so we keep them as they are. Combining them into our
   * shared categories (see categories.ts) is a separate, later step.
   */
  storeCategories: string[];
  imageUrl?: string;
  regularPriceCents: number;
  salePriceCents?: number;
  /** Price only members get, when it differs from the regular price. */
  memberPriceCents?: number;
  unitPriceCents?: number;
  /** What the unit price is per, e.g. "100g" or "ea". */
  unitLabel?: string;
  saleStart?: string;
  saleEnd?: string;
  sourceUrl?: string;
  /** Set if the price is for one physical store. Leave out if it applies to the whole chain. */
  locationId?: string;
  /**
   * The store's data for this item exactly as received, before we cleaned it
   * (for example Walmart's "$5.47" text and its "was" price). Every connector
   * should set this, so the per-store layer keeps the untouched original and
   * we can re-check or re-read it later. It is saved in its own column, apart
   * from the cleaned item.
   */
  original?: Record<string, unknown>;
}

/**
 * A price converted to one standard amount, so different stores, units and pack
 * sizes can be compared directly: per 100 g for things sold by weight, per
 * 100 ml for liquids, and per item for things sold by count (rolls, eggs).
 */
export interface ComparableUnitPrice {
  per: '100g' | '100ml' | 'each';
  /** Price in cents for that amount. It can have decimals (e.g. 15.21) because per-gram prices are small. */
  cents: number;
}

/** One result row from a price search: item, chain and price, ready to show. */
export interface PriceRow {
  /**
   * Unique across all stores and stable between scrapes: "chain:sku", built with itemId()
   * in pricing.ts. Treat it as plain text and encode it before putting it in a web address.
   */
  id: string;
  chainSlug: string;
  chainName: string;
  parentCompany: string;
  locationId?: string;
  sku: string;
  name: string;
  brand?: string;
  /** The size as the store wrote it, e.g. "2 x 4 L". Show this one to people. */
  size?: string;
  /** Amount in one pack, in `sizeUnit`: 4 for "2 x 4 L". Missing when the size can't be read. */
  sizeAmount?: number;
  sizeUnit?: SizeUnit;
  /** How many packs are bundled: 2 for "2 x 4 L". 1 for a single pack. Bulk packs often cost less per unit but more up front, so show both prices. */
  packCount: number;
  /** True when the price is per unit of weight ("per lb", "per kg") rather than for a package, so show it as "$/lb". */
  pricedByWeight: boolean;
  /** One of our shared categories, set once each store's own category names have been combined. */
  category?: ProductCategory;
  imageUrl?: string;
  /**
   * The price the shopper pays, after applying the `memberPricing` filter.
   * Non-member: the sale price if there is one, otherwise the regular price.
   * Member: the lowest of the member price and the non-member price.
   * Build it with effectivePriceCents() in pricing.ts.
   */
  priceCents: number;
  /** The original price, before any sale or member price. */
  regularPriceCents: number;
  /**
   * How much cheaper `priceCents` is than the original price, in cents.
   * Only set when the price is below the original. Build it with discountFor() in pricing.ts.
   */
  discountCents?: number;
  /** The same discount as a whole percent of the original price, e.g. 17. Only set with `discountCents`. */
  discountPercent?: number;
  salePriceCents?: number;
  memberPriceCents?: number;
  /** The store's own unit price, if it gave one. Stores use different units, so don't compare these across stores. */
  unitPriceCents?: number;
  unitLabel?: string;
  /**
   * `priceCents` converted to a standard unit (per 100 g, per 100 ml or per item), worked out
   * from the size. Compare these across stores. Missing when the size is missing or can't be read.
   */
  comparableUnitPrice?: ComparableUnitPrice;
  saleEnd?: string;
  sourceUrl?: string;
  /** When the connector last fetched this price. */
  scrapedAt: string;
  /** Only set when the search used a `near` filter. */
  distanceKm?: number;
}

export type MemberPricing = 'member' | 'non-member';

export type PriceSort = 'price' | 'unitPrice' | 'name' | 'distance' | 'discount';

/** Which way to sort: 'asc' is low to high (A to Z, nearest first), 'desc' is high to low. */
export type SortOrder = 'asc' | 'desc';

/** One page of search results. */
export interface PriceSearchResult {
  rows: PriceRow[];
  /** How many items match in all, before paging, so the website can show "page 2 of 5". */
  total: number;
}

/** Every option a user can pick when searching. Leave a field out to not filter on it. */
export interface PriceFilters {
  /** Text to look for in the item name and brand. */
  query?: string;
  chainSlugs?: string[];
  /** Filter by owning company, e.g. everything owned by one parent. */
  parentCompanies?: string[];
  /** Specific physical stores, e.g. picked on a map. */
  locationIds?: string[];
  /**
   * Only stores within `radiusKm` of this point.
   *
   * The point comes from the browser's location request, and the user can say
   * no. So this is always optional and the website must still work without it
   * (for example by falling back to picking stores or chains by hand).
   * It is personal data: use it for the search only, and never store or log it.
   */
  near?: { lat: number; lng: number; radiusKm: number };
  onSaleOnly?: boolean;
  /** Which price to compare. Default: 'non-member', what an anonymous visitor sees. */
  memberPricing?: MemberPricing;
  /** Only items in these shared categories, e.g. ['fruits', 'vegetables']. */
  categories?: ProductCategory[];
  /**
   * How to order the results, each in its natural direction:
   * 'price' cheapest first (the default); 'unitPrice' cheapest per standard unit first
   * (best compared within one kind of item, like milk); 'name' A to Z; 'distance' nearest
   * first (needs `near`); 'discount' biggest percent off first (for "top deals").
   */
  sortBy?: PriceSort;
  /**
   * Flip the direction of `sortBy`. Leave it out for the natural direction above:
   * 'asc' for price, unitPrice, name and distance, 'desc' for discount.
   * So { sortBy: 'price', sortOrder: 'desc' } is most expensive first.
   * Only the main value flips. Ties are still broken by price (cheapest first), then name
   * (A to Z), then id, and items with no unit price, distance or discount still come last.
   */
  sortOrder?: SortOrder;
  /** Default: 50. Largest allowed: 100. */
  limit?: number;
  offset?: number;
}

/**
 * One line of a shopping list. Either a search, like "milk" (optionally only in some
 * categories), which is compared across every chain, or one exact item by id, like
 * "walmart:W-2002", which only that chain sells.
 */
export type ShoppingListEntry =
  | { query: string; categories?: ProductCategory[]; quantity?: number }
  | { itemId: string; quantity?: number };

/** A shopping list to price, and where the shopper is willing to buy. */
export interface ShoppingListRequest {
  items: ShoppingListEntry[];
  /** The same store choice as a search: chains, owners, picked stores or a radius. */
  chainSlugs?: string[];
  parentCompanies?: string[];
  locationIds?: string[];
  /** Personal data: use for this request only, never store or log it. */
  near?: { lat: number; lng: number; radiusKm: number };
  memberPricing?: MemberPricing;
  /** How many matches to send back for each entry, cheapest first. Default: 5. Largest allowed: 20. */
  matchesPerItem?: number;
}

/** What one entry costs at one place: the cheapest match there, times the quantity. */
export interface ShoppingListPick {
  /** Position of the entry in the request, from 0. */
  index: number;
  row: PriceRow;
  /** `row.priceCents` times the quantity. For an item priced by weight that is per lb or kg. */
  lineCents: number;
}

export interface ShoppingListEntryResult {
  /** Position of the entry in the request, from 0. */
  index: number;
  quantity: number;
  /** Cheapest first, at most `matchesPerItem`. Empty when nothing matches in the chosen stores. */
  matches: PriceRow[];
  /** How many items match in all. */
  total: number;
}

/** Buying the whole list at one chain. */
export interface ShoppingListChainTotal {
  chainSlug: string;
  chainName: string;
  /** Sum of `lineCents` for the entries this chain has. Compare it only between chains with the same `missingIndexes`. */
  totalCents: number;
  /** The cheapest match at this chain for each entry it has. */
  picks: ShoppingListPick[];
  /** Entries this chain doesn't have (in the chosen stores). */
  missingIndexes: number[];
  /** Only with `near`: distance to this chain's nearest store in range. */
  distanceKm?: number;
}

export interface ShoppingListResult {
  /** One per entry, in the order asked for. */
  entries: ShoppingListEntryResult[];
  /** Chains that have at least one entry: the most entries first, then the cheapest. */
  chains: ShoppingListChainTotal[];
  /** The cheapest match for each entry at any chain: the lowest total if the shopper splits the list between stores. */
  cheapestMix: { totalCents: number; picks: ShoppingListPick[]; missingIndexes: number[] };
}
