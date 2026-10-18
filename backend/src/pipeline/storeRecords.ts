import { assertValidItem } from '../connectors/normalize';
import type { RawItem } from '../types';
import type { StoreRecord } from './types';

/**
 * Turn a connector's items into records for the per-store layer. The store's
 * untouched data (`original`) goes in its own field, apart from the cleaned item.
 */
export function recordsFromItems(chainSlug: string, items: RawItem[], scrapedAt: string): StoreRecord[] {
  return items.map((item) => {
    const { original, ...cleaned } = item;
    return {
      chainSlug,
      sku: item.sku,
      scrapedAt,
      payload: { ...cleaned },
      ...(original !== undefined ? { original } : {}),
    };
  });
}

/**
 * Read a saved JSON payload back into a RawItem, checking every field.
 * JSON has no types, so we can't trust it: this throws one error that lists
 * every problem. Extra fields in the payload are ignored.
 *
 * JSON null counts as "missing" because JSON can't hold undefined.
 */
export function toRawItem(payload: unknown): RawItem {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error('payload must be a JSON object');
  }
  const data = payload as Record<string, unknown>;
  const problems: string[] = [];

  const text = (key: string): string | undefined => {
    const value = data[key];
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') {
      problems.push(`${key} must be text`);
      return undefined;
    }
    return value;
  };
  const number = (key: string): number | undefined => {
    const value = data[key];
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      problems.push(`${key} must be a number`);
      return undefined;
    }
    return value;
  };

  const sku = text('sku');
  if (sku === undefined) problems.push('sku is required');
  const name = text('name');
  if (name === undefined) problems.push('name is required');
  const regularPriceCents = number('regularPriceCents');
  if (regularPriceCents === undefined) problems.push('regularPriceCents is required');

  const categories = data['storeCategories'];
  let storeCategories: string[] = [];
  if (!Array.isArray(categories) || categories.some((entry) => typeof entry !== 'string')) {
    problems.push('storeCategories must be a list of text');
  } else {
    storeCategories = categories as string[];
  }

  const item: RawItem = {
    sku: sku ?? '',
    name: name ?? '',
    brand: text('brand'),
    size: text('size'),
    upc: text('upc'),
    storeCategories,
    imageUrl: text('imageUrl'),
    regularPriceCents: regularPriceCents ?? 0,
    salePriceCents: number('salePriceCents'),
    memberPriceCents: number('memberPriceCents'),
    unitPriceCents: number('unitPriceCents'),
    unitLabel: text('unitLabel'),
    saleStart: text('saleStart'),
    saleEnd: text('saleEnd'),
    sourceUrl: text('sourceUrl'),
    locationId: text('locationId'),
  };

  if (problems.length > 0) throw new Error(problems.join('; '));
  return assertValidItem(item);
}
