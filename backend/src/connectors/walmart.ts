import type { Chain, RawItem } from '../types';
import {
  assertValidItem,
  categoryFromText,
  cleanText,
  parseUnitPrice,
  requireCents,
  requireText,
  toCents,
} from './normalize';
import { sampleLocationsFor } from './sample/locations';
import { walmartSample } from './sample/walmart';
import type { StoreConnector } from './types';

export const walmartChain: Chain = {
  slug: 'walmart',
  name: 'Walmart',
  parentCompany: 'Walmart',
  hasMemberPricing: false,
};

/**
 * One item as this connector expects the store's data to look. Prices are text like "$2.97".
 * This shape is a guess used by the sample data. When real fetching is built,
 * change it to match what the real source gives back.
 */
export interface WalmartRawItem {
  sku: string;
  name: string;
  brand?: string;
  size?: string;
  /** Broad group, e.g. "Fruits & Vegetables". */
  department: string;
  /** More specific group inside the department, e.g. "Fresh Vegetables". */
  aisle?: string;
  /** What it costs now. */
  price: string;
  /** The old price, when the item is on rollback. */
  wasPrice?: string;
  /** Text like "$0.40/100g". */
  unitPriceText?: string;
  link?: string;
}

/** Convert one Walmart item into our shared shape. */
export function parseWalmartItem(raw: WalmartRawItem): RawItem {
  const price = requireCents(raw.price, `${raw.sku} price`);
  const was = toCents(raw.wasPrice);

  // On rollback the old price is the regular price and today's price is the sale price.
  const regularPriceCents = was !== undefined && was > price ? was : price;
  const salePriceCents = regularPriceCents > price ? price : undefined;

  return {
    sku: raw.sku,
    name: requireText(raw.name, `${raw.sku} name`),
    brand: cleanText(raw.brand),
    size: cleanText(raw.size),
    category: categoryFromText(raw.aisle, raw.department),
    regularPriceCents,
    salePriceCents,
    ...parseUnitPrice(raw.unitPriceText),
    sourceUrl: cleanText(raw.link),
  };
}

/**
 * Pass your own `loadRaw` to read real data instead of the sample data.
 * Everything after that (conversion and checks) stays the same.
 */
export function createWalmartConnector(
  loadRaw: () => Promise<WalmartRawItem[]> = async () => walmartSample,
): StoreConnector {
  return {
    chain: walmartChain,
    async fetchItems() {
      const raw = await loadRaw();
      return raw.map((item) => assertValidItem(parseWalmartItem(item)));
    },
    async fetchLocations() {
      return sampleLocationsFor(walmartChain.slug);
    },
  };
}
