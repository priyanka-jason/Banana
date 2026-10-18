import { convertItems } from '../connectors/convertItems';
import { cleanPath, requireText } from '../connectors/normalize';
import type { StoreConnector } from '../connectors/types';
import type { CategoryMap } from '../pipeline/categoryMap';
import type { RawItem, StoreLocation } from '../types';
import { CATALOG, type CatalogProduct } from './catalog';
import { storeLocationsFor } from '../stores';
import { SIMULATED_CHAINS, type SimulatedChainProfile } from './chains';
import { between, chance } from './random';

/**
 * SIMULATED data for the hackathon demo: made-up prices for Save-On-Foods,
 * Walmart and Costco, built from catalog.ts and chains.ts. One price per item
 * per chain, the same at every store in the Lower Mainland.
 *
 * It is the same every run (no real randomness), so item ids and tests are stable.
 * It goes through the same pipeline as real data would: connector, per-store
 * layer, combine step, final layer.
 */

/** This week's flyer: Friday Oct 16 to Thursday Oct 22, 2026. */
export const SIMULATED_FLYER_WEEK = { start: '2026-10-16', end: '2026-10-22' } as const;
/** Costco's coupon book runs longer. */
const COSTCO_SALE_END = '2026-11-01';

const GRAMS_PER_LB = 453.59237;
const LB_PER_KG = 1000 / GRAMS_PER_LB;

/** Items every chain carries, so common searches like "bananas" find every store. */
const STAPLES = new Set(['bananas', 'milk-2-4l', 'large-eggs-12', 'white-bread', 'chicken-breast']);

/** What the simulated "store" hands to its connector for one item. Prices are whole cents. */
export interface SimulatedRawItem {
  simulated: true;
  sku: string;
  name: string;
  size?: string;
  department: string;
  aisle: string;
  regularCents: number;
  saleCents?: number;
  memberCents?: number;
  saleStart?: string;
  saleEnd?: string;
}

/** Round to the nearest price with one of the chain's favourite endings, like $x.97. */
export function roundToEnding(cents: number, endings: readonly number[]): number {
  const dollars = Math.floor(cents / 100);
  let best: number | undefined;
  for (const d of [dollars - 1, dollars, dollars + 1]) {
    for (const ending of endings) {
      const candidate = d * 100 + ending;
      if (candidate <= 0) continue;
      if (best === undefined || Math.abs(candidate - cents) < Math.abs(best - cents)) best = candidate;
    }
  }
  return best ?? Math.max(1, Math.round(cents));
}

function carries(profile: SimulatedChainProfile, product: CatalogProduct): boolean {
  const isCostco = profile.chain.slug === 'costco';
  if (isCostco && product.costco === undefined) return false;
  if (STAPLES.has(product.key)) return true;

  const share = product.specialty === true ? profile.carries * 0.4 : profile.carries;
  return chance(profile.chain.slug, product.key, 'carries') < share;
}

/** The size and typical price this chain sells the product at. */
function sizeAndBase(profile: SimulatedChainProfile, product: CatalogProduct): { size?: string; cents: number } {
  if (profile.chain.slug === 'costco' && product.costco !== undefined) return product.costco;
  if (product.size === 'per lb' && profile.weightUnit === 'kg') return { size: 'per kg', cents: product.cents * LB_PER_KG };
  return { size: product.size, cents: product.cents };
}

function simulatedItem(profile: SimulatedChainProfile, product: CatalogProduct): SimulatedRawItem {
  const slug = profile.chain.slug;
  const { size, cents } = sizeAndBase(profile, product);
  const regularCents = roundToEnding(cents * profile.priceLevel * between(0.92, 1.08, slug, product.key, 'price'), profile.endings);

  const item: SimulatedRawItem = {
    simulated: true,
    sku: `sim-${product.key}`,
    name: product.name,
    ...(size === undefined ? {} : { size }),
    department: profile.departments[product.category],
    aisle: product.aisle,
    regularCents,
  };

  let current = regularCents;
  if (chance(slug, product.key, 'sale') < profile.onSale) {
    const sale = roundToEnding(regularCents * (1 - between(0.1, 0.35, slug, product.key, 'off')), profile.endings);
    if (sale < regularCents) {
      item.saleCents = sale;
      item.saleStart = SIMULATED_FLYER_WEEK.start;
      item.saleEnd = slug === 'costco' ? COSTCO_SALE_END : SIMULATED_FLYER_WEEK.end;
      current = sale;
    }
  }

  if (profile.chain.hasMemberPricing && chance(slug, product.key, 'member') < profile.memberDeals) {
    const member = roundToEnding(current * (1 - between(0.08, 0.2, slug, product.key, 'member-off')), profile.endings);
    if (member < current) item.memberCents = member;
  }

  return item;
}

/** Every item one simulated chain sells this week. */
export function simulatedItemsFor(profile: SimulatedChainProfile): SimulatedRawItem[] {
  return CATALOG.filter((product) => carries(profile, product)).map((product) => simulatedItem(profile, product));
}

/** Convert one simulated item into our shared shape, keeping the untouched item as `original`. */
export function parseSimulatedItem(raw: SimulatedRawItem): RawItem {
  return {
    sku: raw.sku,
    name: requireText(raw.name, `${raw.sku} name`),
    size: raw.size,
    storeCategories: cleanPath(raw.department, raw.aisle),
    regularPriceCents: raw.regularCents,
    salePriceCents: raw.saleCents,
    memberPriceCents: raw.memberCents,
    saleStart: raw.saleStart,
    saleEnd: raw.saleEnd,
    original: { ...raw },
  };
}

/** The chain's stores: the real branches the website shows (stores.ts). Prices stay simulated. */
export function simulatedLocationsFor(profile: SimulatedChainProfile): StoreLocation[] {
  return storeLocationsFor(profile.chain.slug);
}

/** A connector for one simulated chain. It works exactly like a real one. */
export function createSimulatedConnector(profile: SimulatedChainProfile): StoreConnector {
  const fetchResult = async () => convertItems(simulatedItemsFor(profile), parseSimulatedItem, (raw) => raw.sku);
  return {
    chain: profile.chain,
    fetchResult,
    async fetchItems() {
      return (await fetchResult()).items;
    },
    async fetchLocations() {
      return simulatedLocationsFor(profile);
    },
  };
}

/** One connector per simulated chain. */
export const simulatedConnectors: StoreConnector[] = SIMULATED_CHAINS.map(createSimulatedConnector);

/**
 * The category map for the simulated chains: each aisle name to its shared category.
 * We made the aisles up, so we know the right answers and nothing has to be guessed.
 */
export const SIMULATED_CATEGORY_MAP: CategoryMap = Object.fromEntries(
  SIMULATED_CHAINS.map((profile) => [
    profile.chain.slug,
    Object.fromEntries(CATALOG.map((product) => [product.aisle.toLowerCase(), product.category])),
  ]),
);
