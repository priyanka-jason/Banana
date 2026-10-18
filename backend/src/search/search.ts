import { distanceKm } from '../geo';
import { toPriceRow } from '../pipeline/priceRow';
import type { FinalItem } from '../pipeline/types';
import type {
  Chain,
  MemberPricing,
  NearbyStore,
  PriceFilters,
  PriceRow,
  PriceSearchResult,
  PriceSort,
  SortOrder,
  StoreLocation,
} from '../types';

/**
 * The search rules, as plain functions over data in memory.
 *
 * This is the reference for what each filter means. The in-memory repository
 * uses it directly; a database version should return the same results.
 */

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;

/** Everything a search needs: the final items, their chains and the store locations. */
export interface SearchData {
  items: FinalItem[];
  chains: Chain[];
  locations: StoreLocation[];
}

/** Lowercase, drop accents, collapse spaces, so "Bañanas  " matches "bananas". */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Distances are shown to a tenth of a km. It is plenty for "3.4 km away" and no more precise than needed. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** An empty or missing list means "don't filter on this". */
function toSet<T>(values: readonly T[] | undefined): Set<T> | undefined {
  return values !== undefined && values.length > 0 ? new Set(values) : undefined;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function byNameThenId(a: PriceRow, b: PriceRow): number {
  return compareText(normalizeText(a.name), normalizeText(b.name)) || compareText(a.id, b.id);
}

function byPrice(a: PriceRow, b: PriceRow): number {
  return a.priceCents - b.priceCents || byNameThenId(a, b);
}

/** Unit prices are only comparable within the same kind, so kinds are kept together. */
const UNIT_KIND_ORDER = { '100g': 0, '100ml': 1, each: 2 } as const;

type Compare = (a: PriceRow, b: PriceRow) => number;

/**
 * How one `sortBy` orders rows. `key` is written in the sort's natural direction and is the
 * only part `sortOrder` flips. Rows that are `missing` the value always come last, and
 * `tieBreak` never flips, so equal rows keep the same order either way.
 */
interface SortRule {
  natural: SortOrder;
  key: Compare;
  tieBreak: Compare;
  /** Compared before `key` and never flipped, e.g. keeping per-100 g and per-100 ml prices apart. */
  group?: Compare;
  missing?: (row: PriceRow) => boolean;
}

const SORT_RULES: Record<PriceSort, SortRule> = {
  price: { natural: 'asc', key: (a, b) => a.priceCents - b.priceCents, tieBreak: byNameThenId },
  name: {
    natural: 'asc',
    key: (a, b) => compareText(normalizeText(a.name), normalizeText(b.name)),
    tieBreak: (a, b) => compareText(a.id, b.id),
  },
  unitPrice: {
    natural: 'asc',
    missing: (row) => row.comparableUnitPrice === undefined,
    group: (a, b) => UNIT_KIND_ORDER[a.comparableUnitPrice!.per] - UNIT_KIND_ORDER[b.comparableUnitPrice!.per],
    key: (a, b) => a.comparableUnitPrice!.cents - b.comparableUnitPrice!.cents,
    // Rows with no unit price are ordered among themselves by price.
    tieBreak: (a, b) => (a.comparableUnitPrice === undefined ? byPrice(a, b) : byNameThenId(a, b)),
  },
  distance: {
    natural: 'asc',
    missing: (row) => row.distanceKm === undefined,
    key: (a, b) => a.distanceKm! - b.distanceKm!,
    tieBreak: byPrice,
  },
  discount: {
    natural: 'desc',
    missing: (row) => row.discountCents === undefined,
    key: (a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0) || (b.discountCents ?? 0) - (a.discountCents ?? 0),
    tieBreak: byPrice,
  },
};

function comparatorFor(sortBy: PriceSort, sortOrder: SortOrder | undefined): Compare {
  const rule = SORT_RULES[sortBy];
  const sign = sortOrder === undefined || sortOrder === rule.natural ? 1 : -1;
  return (a, b) => {
    const missingA = rule.missing?.(a) ?? false;
    const missingB = rule.missing?.(b) ?? false;
    if (missingA !== missingB) return missingA ? 1 : -1;
    if (missingA) return rule.tieBreak(a, b);
    return (rule.group?.(a, b) ?? 0) || sign * rule.key(a, b) || rule.tieBreak(a, b);
  };
}

/**
 * Search the final items. What each filter means:
 *
 * - `query`: every word must appear in the item's name, brand, size or store name ("milk walmart",
 *   "milk 4 l"), in any order, ignoring case and accents. Blank means no filter. Category names are
 *   left out on purpose: "eggs" should find eggs, not every cheese in Dairy & Eggs.
 * - `chainSlugs`, `parentCompanies`, `categories`: the item must match one of the listed values.
 *   An empty list means no filter.
 * - `locationIds`: stores picked on a map. An item priced for one store must be at one of them.
 *   An item priced for the whole chain matches if the chain has one of them.
 * - `near`: same idea, for stores within `radiusKm`. Each row gets `distanceKm`, the distance to
 *   the nearest matching store of that chain.
 * - `onSaleOnly`: the price the shopper pays must be below the original price. That depends on
 *   `memberPricing`: a member price counts for a member but not for a non-member.
 * - `sortBy`, `sortOrder`: see PriceFilters. 'distance' without `near` is treated as 'price'.
 */
export function searchFinal(data: SearchData, filters: PriceFilters = {}): PriceSearchResult {
  const memberPricing = filters.memberPricing ?? 'non-member';
  const limit = filters.limit ?? DEFAULT_LIMIT;
  const offset = filters.offset ?? 0;

  const chainsBySlug = new Map(data.chains.map((chain) => [chain.slug, chain]));
  const chainFilter = toSet(filters.chainSlugs);
  const parentFilter = toSet(filters.parentCompanies?.map(normalizeText));
  const categoryFilter = toSet(filters.categories);
  const locationFilter = toSet(filters.locationIds);
  const words = filters.query === undefined ? [] : normalizeText(filters.query).split(' ').filter(Boolean);

  const chainsWithPickedLocation = locationFilter
    ? new Set(data.locations.filter((location) => locationFilter.has(location.id)).map((location) => location.chainSlug))
    : undefined;

  let nearestByLocation: Map<string, number> | undefined;
  let nearestByChain: Map<string, number> | undefined;
  if (filters.near !== undefined) {
    nearestByLocation = new Map();
    nearestByChain = new Map();
    for (const location of data.locations) {
      const distance = distanceKm(filters.near, location);
      if (distance > filters.near.radiusKm) continue;
      nearestByLocation.set(location.id, distance);
      const current = nearestByChain.get(location.chainSlug);
      if (current === undefined || distance < current) nearestByChain.set(location.chainSlug, distance);
    }
  }

  const rows: PriceRow[] = [];
  for (const item of data.items) {
    const chain = chainsBySlug.get(item.chainSlug);
    if (chain === undefined) continue;

    if (chainFilter !== undefined && !chainFilter.has(item.chainSlug)) continue;
    if (parentFilter !== undefined && !parentFilter.has(normalizeText(chain.parentCompany))) continue;
    if (categoryFilter !== undefined && !categoryFilter.has(item.category)) continue;

    if (words.length > 0) {
      const haystack = normalizeText(`${item.name} ${item.brand ?? ''} ${item.size ?? ''} ${chain.name}`);
      if (!words.every((word) => haystack.includes(word))) continue;
    }

    if (locationFilter !== undefined) {
      const matches =
        item.locationId !== undefined
          ? locationFilter.has(item.locationId)
          : chainsWithPickedLocation?.has(item.chainSlug) === true;
      if (!matches) continue;
    }

    let distance: number | undefined;
    if (nearestByLocation !== undefined && nearestByChain !== undefined) {
      distance =
        item.locationId !== undefined ? nearestByLocation.get(item.locationId) : nearestByChain.get(item.chainSlug);
      if (distance === undefined) continue;
    }

    const row = toPriceRow(item, chain, {
      memberPricing,
      distanceKm: distance === undefined ? undefined : round1(distance),
    });
    if (filters.onSaleOnly === true && row.discountCents === undefined) continue;
    rows.push(row);
  }

  const sortBy = filters.sortBy === 'distance' && filters.near === undefined ? 'price' : (filters.sortBy ?? 'price');
  rows.sort(comparatorFor(sortBy, filters.sortOrder));

  return { rows: rows.slice(offset, offset + limit), total: rows.length };
}

/**
 * Rows for specific item ids, in the order asked for. Unknown ids are left out and
 * an id asked for twice appears once. Used for item pages and shopping lists.
 */
export function findItems(
  data: SearchData,
  ids: readonly string[],
  memberPricing: MemberPricing = 'non-member',
): PriceRow[] {
  const itemsById = new Map(data.items.map((item) => [item.id, item]));
  const chainsBySlug = new Map(data.chains.map((chain) => [chain.slug, chain]));
  const seen = new Set<string>();
  const rows: PriceRow[] = [];

  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const item = itemsById.get(id);
    const chain = item === undefined ? undefined : chainsBySlug.get(item.chainSlug);
    if (item !== undefined && chain !== undefined) rows.push(toPriceRow(item, chain, { memberPricing }));
  }
  return rows;
}

/**
 * Stores within `radiusKm` of a point, nearest first. Distances are to a tenth of a km.
 * `chainSlugs` keeps only those chains' stores; empty or missing means every chain.
 */
export function storesWithinRadius(
  locations: readonly StoreLocation[],
  lat: number,
  lng: number,
  radiusKm: number,
  chainSlugs?: readonly string[],
): NearbyStore[] {
  const chainFilter = toSet(chainSlugs);
  const found: NearbyStore[] = [];
  for (const location of locations) {
    if (chainFilter !== undefined && !chainFilter.has(location.chainSlug)) continue;
    const distance = distanceKm({ lat, lng }, location);
    if (distance <= radiusKm) found.push({ ...location, distanceKm: round1(distance) });
  }
  return found.sort((a, b) => a.distanceKm - b.distanceKm || compareText(a.id, b.id));
}
