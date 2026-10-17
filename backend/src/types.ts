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
  size?: string;
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
  unitPriceCents?: number;
  unitLabel?: string;
  saleEnd?: string;
  sourceUrl?: string;
  /** When the connector last fetched this price. */
  scrapedAt: string;
  /** Only set when the search used a `near` filter. */
  distanceKm?: number;
}

export type MemberPricing = 'member' | 'non-member';

export type PriceSort = 'price' | 'unitPrice' | 'name';

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
  /** Default: 'price', cheapest first. */
  sortBy?: PriceSort;
  /** Default: 50. */
  limit?: number;
  offset?: number;
}
