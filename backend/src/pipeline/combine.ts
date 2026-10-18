import { itemId } from '../pricing';
import type { Chain, RawItem } from '../types';
import { parseSize } from '../units';
import { CATEGORY_MAP, mapToSharedCategory, type CategoryMap } from './categoryMap';
import { toRawItem } from './storeRecords';
import type {
  CategoryNote,
  CombineResult,
  FinalItem,
  RejectedRecord,
  StoreRecord,
  UnreadableSize,
} from './types';

/**
 * The combine step: turns what is saved in each store's own layer into final items.
 *
 * For every saved record it:
 *  - keeps only the newest copy if the same item was saved more than once,
 *  - checks the JSON and rejects anything bad (the rest still go through),
 *  - gives it a shared category (see mapToSharedCategory),
 *  - builds the item id,
 *  - splits the size text into separate values (pack count, amount, unit, kind, total).
 *
 * It does not touch any database. The caller reads the records and saves the result.
 */
export function combine(
  chains: Chain[],
  records: StoreRecord[],
  categoryMap: CategoryMap = CATEGORY_MAP,
): CombineResult {
  const knownChains = new Set(chains.map((chain) => chain.slug));

  const newest = new Map<string, StoreRecord>();
  for (const record of records) {
    const key = `${record.chainSlug}\u0000${record.sku}`;
    const existing = newest.get(key);
    if (existing === undefined || record.scrapedAt >= existing.scrapedAt) newest.set(key, record);
  }

  const items: FinalItem[] = [];
  const rejected: RejectedRecord[] = [];
  const unreadableSizes: UnreadableSize[] = [];
  const guessed = new Map<string, CategoryNote>();
  const unmapped = new Map<string, CategoryNote>();

  for (const record of newest.values()) {
    const reject = (reason: string): void => {
      rejected.push({ chainSlug: record.chainSlug, sku: record.sku, reason });
    };

    if (!knownChains.has(record.chainSlug)) {
      reject(`unknown chain "${record.chainSlug}"`);
      continue;
    }

    let raw: RawItem;
    try {
      raw = toRawItem(record.payload);
    } catch (error) {
      reject(error instanceof Error ? error.message : String(error));
      continue;
    }
    if (raw.sku !== record.sku) {
      reject(`record sku "${record.sku}" does not match payload sku "${raw.sku}"`);
      continue;
    }

    const { category, how } = mapToSharedCategory(record.chainSlug, raw.storeCategories, categoryMap);
    const note: CategoryNote = { chainSlug: record.chainSlug, storeCategories: raw.storeCategories, category };
    const noteKey = `${record.chainSlug}\u0000${raw.storeCategories.join(' > ')}`;
    if (how === 'guess') guessed.set(noteKey, note);
    if (how === 'none') unmapped.set(noteKey, note);

    const size = parseSize(raw.size);
    if (raw.size !== undefined && raw.size.trim() !== '' && size === undefined) {
      unreadableSizes.push({ chainSlug: record.chainSlug, sku: raw.sku, size: raw.size });
    }

    items.push({
      id: itemId(record.chainSlug, raw.sku),
      chainSlug: record.chainSlug,
      sku: raw.sku,
      name: raw.name,
      brand: raw.brand,
      size: raw.size,
      sizeAmount: size?.amount,
      sizeUnit: size?.unit,
      sizeKind: size?.kind,
      sizeTotalBase: size?.totalBase,
      packCount: size?.packCount ?? 1,
      pricedByWeight: size?.pricedByWeight ?? false,
      upc: raw.upc,
      category,
      storeCategories: raw.storeCategories,
      imageUrl: raw.imageUrl,
      locationId: raw.locationId,
      regularPriceCents: raw.regularPriceCents,
      salePriceCents: raw.salePriceCents,
      memberPriceCents: raw.memberPriceCents,
      unitPriceCents: raw.unitPriceCents,
      unitLabel: raw.unitLabel,
      saleStart: raw.saleStart,
      saleEnd: raw.saleEnd,
      sourceUrl: raw.sourceUrl,
      scrapedAt: record.scrapedAt,
    });
  }

  items.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  rejected.sort((a, b) => `${a.chainSlug}:${a.sku}`.localeCompare(`${b.chainSlug}:${b.sku}`));
  unreadableSizes.sort((a, b) => `${a.chainSlug}:${a.sku}`.localeCompare(`${b.chainSlug}:${b.sku}`));

  return {
    items,
    rejected,
    guessedCategories: [...guessed.values()],
    unmappedCategories: [...unmapped.values()],
    unreadableSizes,
  };
}
