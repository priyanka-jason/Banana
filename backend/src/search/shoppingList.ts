import type {
  PriceFilters,
  PriceRow,
  ShoppingListChainTotal,
  ShoppingListEntryResult,
  ShoppingListPick,
  ShoppingListRequest,
  ShoppingListResult,
} from '../types';
import { searchFinal, type SearchData } from './search';

/**
 * Pricing a whole shopping list, as plain functions over data in memory, like search.ts.
 * Each entry is a normal search (same matching, same store choice, cheapest first), so a
 * database version only has to give the same answers for each entry.
 */

export const DEFAULT_MATCHES_PER_ITEM = 5;
export const MAX_MATCHES_PER_ITEM = 20;
export const MAX_LIST_ITEMS = 50;
export const MAX_QUANTITY = 99;

function pick(index: number, row: PriceRow, quantity: number): ShoppingListPick {
  return { index, row, lineCents: row.priceCents * quantity };
}

const sum = (picks: readonly ShoppingListPick[]): number => picks.reduce((total, p) => total + p.lineCents, 0);

/**
 * What the list costs in the chosen stores:
 *
 * - `entries`: the cheapest matches for each entry.
 * - `chains`: buying everything at one chain, using its cheapest match for each entry.
 *   Chains with the most entries come first, then the cheapest, then by name.
 * - `cheapestMix`: the cheapest match for each entry at any chain.
 *
 * An `itemId` entry is that one item, if it is sold in the chosen stores, so it only counts
 * for its own chain. Use a `query` entry to compare an item across chains.
 */
export function priceShoppingList(data: SearchData, request: ShoppingListRequest): ShoppingListResult {
  const matchesPerItem = request.matchesPerItem ?? DEFAULT_MATCHES_PER_ITEM;
  const everything = Math.max(1, data.items.length);
  const storeFilters: PriceFilters = {
    chainSlugs: request.chainSlugs,
    parentCompanies: request.parentCompanies,
    locationIds: request.locationIds,
    near: request.near,
    memberPricing: request.memberPricing,
    sortBy: 'price',
    limit: everything,
  };

  const entries: ShoppingListEntryResult[] = [];
  const mixPicks: ShoppingListPick[] = [];
  const mixMissing: number[] = [];
  const byChain = new Map<string, { chainName: string; picks: ShoppingListPick[]; distanceKm?: number }>();

  request.items.forEach((entry, index) => {
    const quantity = entry.quantity ?? 1;
    const { rows, total } =
      'itemId' in entry
        ? searchFinal({ ...data, items: data.items.filter((item) => item.id === entry.itemId) }, storeFilters)
        : searchFinal(data, { ...storeFilters, query: entry.query, categories: entry.categories });

    entries.push({ index, quantity, matches: rows.slice(0, matchesPerItem), total });

    const [cheapest] = rows;
    if (cheapest === undefined) mixMissing.push(index);
    else mixPicks.push(pick(index, cheapest, quantity));

    // Rows are cheapest first, so the first row of each chain is that chain's cheapest.
    const seen = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.chainSlug)) continue;
      seen.add(row.chainSlug);
      const chain = byChain.get(row.chainSlug) ?? { chainName: row.chainName, picks: [] };
      chain.picks.push(pick(index, row, quantity));
      if (row.distanceKm !== undefined && (chain.distanceKm === undefined || row.distanceKm < chain.distanceKm)) {
        chain.distanceKm = row.distanceKm;
      }
      byChain.set(row.chainSlug, chain);
    }
  });

  const chains: ShoppingListChainTotal[] = [...byChain].map(([chainSlug, chain]) => {
    const found = new Set(chain.picks.map((p) => p.index));
    const total: ShoppingListChainTotal = {
      chainSlug,
      chainName: chain.chainName,
      totalCents: sum(chain.picks),
      picks: chain.picks,
      missingIndexes: entries.map((entry) => entry.index).filter((index) => !found.has(index)),
    };
    if (chain.distanceKm !== undefined) total.distanceKm = chain.distanceKm;
    return total;
  });
  chains.sort(
    (a, b) =>
      a.missingIndexes.length - b.missingIndexes.length ||
      a.totalCents - b.totalCents ||
      (a.chainName < b.chainName ? -1 : a.chainName > b.chainName ? 1 : 0),
  );

  return { entries, chains, cheapestMix: { totalCents: sum(mixPicks), picks: mixPicks, missingIndexes: mixMissing } };
}
