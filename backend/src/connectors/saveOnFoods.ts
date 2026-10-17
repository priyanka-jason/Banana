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
import { sampleLocationsFor } from './sample/locations';
import { saveOnFoodsSample } from './sample/saveOnFoods';
import type { StoreConnector } from './types';

export const saveOnFoodsChain: Chain = {
  slug: 'save-on-foods',
  name: 'Save-On-Foods',
  parentCompany: 'Pattison Food Group',
  // Members get extra prices through the store's rewards program.
  hasMemberPricing: true,
};

/**
 * One item as this connector expects the store's data to look. Prices are dollars.
 * This shape is a guess used by the sample data. When real fetching is built,
 * change it to match what the real source gives back.
 */
export interface SaveOnFoodsRawItem {
  sku: string;
  title: string;
  brand?: string;
  packageSize?: string;
  /** Category path, broadest first, e.g. ["Produce", "Fruit"]. */
  categories: string[];
  price: number;
  promoPrice?: number | null;
  promoStart?: string;
  promoEnd?: string;
  memberPrice?: number | null;
  /** Text like "$0.37 / 100g". */
  unitPrice?: string;
  url?: string;
}

/** Convert one Save-On-Foods item into our shared shape. */
export function parseSaveOnFoodsItem(raw: SaveOnFoodsRawItem): RawItem {
  const regularPriceCents = requireCents(raw.price, `${raw.sku} price`);

  const promoCents = toCents(raw.promoPrice);
  const salePriceCents = promoCents !== undefined && promoCents < regularPriceCents ? promoCents : undefined;

  const memberCents = toCents(raw.memberPrice);
  const memberPriceCents = memberCents !== undefined && memberCents < regularPriceCents ? memberCents : undefined;

  return {
    sku: raw.sku,
    name: requireText(raw.title, `${raw.sku} title`),
    brand: cleanText(raw.brand),
    size: cleanText(raw.packageSize),
    // The path is broadest first, so reverse it to try the most specific name first.
    category: categoryFromText(...[...raw.categories].reverse()),
    regularPriceCents,
    salePriceCents,
    memberPriceCents,
    ...parseUnitPrice(raw.unitPrice),
    saleStart: salePriceCents !== undefined ? toIsoDate(raw.promoStart) : undefined,
    saleEnd: salePriceCents !== undefined ? toIsoDate(raw.promoEnd) : undefined,
    sourceUrl: cleanText(raw.url),
  };
}

/**
 * Pass your own `loadRaw` to read real data instead of the sample data.
 * Everything after that (conversion and checks) stays the same.
 */
export function createSaveOnFoodsConnector(
  loadRaw: () => Promise<SaveOnFoodsRawItem[]> = async () => saveOnFoodsSample,
): StoreConnector {
  return {
    chain: saveOnFoodsChain,
    async fetchItems() {
      const raw = await loadRaw();
      return raw.map((item) => assertValidItem(parseSaveOnFoodsItem(item)));
    },
    async fetchLocations() {
      return sampleLocationsFor(saveOnFoodsChain.slug);
    },
  };
}
