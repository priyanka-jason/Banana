import type { Chain, RawItem } from '../types';
import {
  assertValidItem,
  categoryFromText,
  cleanText,
  parseUnitPrice,
  requireCents,
  requireText,
  toCents,
  toIsoDate,
} from './normalize';
import { costcoSample } from './sample/costco';
import { sampleLocationsFor } from './sample/locations';
import type { StoreConnector } from './types';

export const costcoChain: Chain = {
  slug: 'costco',
  name: 'Costco',
  parentCompany: 'Costco Wholesale',
  // Costco only sells to members, so every price is already a member price.
  // There is no separate "member price" to show, so this stays false.
  hasMemberPricing: false,
};

/**
 * One item as this connector expects the store's data to look. Prices are dollars.
 * This shape is a guess used by the sample data. When real fetching is built,
 * change it to match what the real source gives back.
 */
export interface CostcoRawItem {
  itemNumber: string;
  description: string;
  brand?: string;
  /** Bulk pack size as printed, e.g. "2 x 4 L". */
  packSize?: string;
  /** Broad group, e.g. "Produce". */
  category: string;
  /** More specific group, e.g. "Fruit". */
  subcategory?: string;
  /** Listed price in dollars. */
  priceCad: number;
  /** Dollars taken off for a limited time. */
  instantSavingsCad?: number | null;
  savingsStart?: string;
  savingsEnd?: string;
  /** Text like "$0.28 per 100g". */
  perUnit?: string;
  url?: string;
}

/** Convert one Costco item into our shared shape. */
export function parseCostcoItem(raw: CostcoRawItem): RawItem {
  const regularPriceCents = requireCents(raw.priceCad, `${raw.itemNumber} priceCad`);

  // With instant savings, the sale price is the listed price minus the savings.
  const savingsCents = toCents(raw.instantSavingsCad) ?? 0;
  const salePriceCents =
    savingsCents > 0 && savingsCents < regularPriceCents ? regularPriceCents - savingsCents : undefined;

  return {
    sku: raw.itemNumber,
    name: requireText(raw.description, `${raw.itemNumber} description`),
    brand: cleanText(raw.brand),
    size: cleanText(raw.packSize),
    category: categoryFromText(raw.subcategory, raw.category),
    regularPriceCents,
    salePriceCents,
    ...parseUnitPrice(raw.perUnit),
    saleStart: salePriceCents !== undefined ? toIsoDate(raw.savingsStart) : undefined,
    saleEnd: salePriceCents !== undefined ? toIsoDate(raw.savingsEnd) : undefined,
    sourceUrl: cleanText(raw.url),
  };
}

/**
 * Pass your own `loadRaw` to read real data instead of the sample data.
 * Everything after that (conversion and checks) stays the same.
 */
export function createCostcoConnector(
  loadRaw: () => Promise<CostcoRawItem[]> = async () => costcoSample,
): StoreConnector {
  return {
    chain: costcoChain,
    async fetchItems() {
      const raw = await loadRaw();
      return raw.map((item) => assertValidItem(parseCostcoItem(item)));
    },
    async fetchLocations() {
      return sampleLocationsFor(costcoChain.slug);
    },
  };
}
