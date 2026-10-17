import { isProductCategory, type ProductCategory } from '../categories';
import type { RawItem } from '../types';

/**
 * Helpers that turn each store's own data into our shared RawItem shape.
 * Each store words things differently ("$3.49", 3.49, "was $3.99"), so every
 * connector uses these instead of doing its own conversions.
 *
 * Missing optional values give `undefined`. Values that are present but
 * garbage throw, so bad data fails loudly instead of saving a wrong price.
 */

/** Trim and collapse repeated spaces. Empty text becomes undefined. */
export function cleanText(value: string | null | undefined): string | undefined {
  const text = value?.replace(/\s+/g, ' ').trim();
  return text ? text : undefined;
}

/** Like cleanText, but throws if the text is missing. For required fields. */
export function requireText(value: string | null | undefined, label: string): string {
  const text = cleanText(value);
  if (text === undefined) throw new Error(`Missing text: ${label}`);
  return text;
}

const PRICE_TEXT = /^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/;

/** Turn dollars (3.49, "3.49" or "$3.49") into whole cents (349). */
export function toCents(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid price: ${value}`);
    return Math.round(value * 100);
  }

  const text = value.replace(/[$,\s]/g, '');
  if (text === '') return undefined;
  if (!PRICE_TEXT.test(text)) throw new Error(`Invalid price: "${value}"`);
  return Math.round(Number(text) * 100);
}

/** Like toCents, but throws if the price is missing. For required prices. */
export function requireCents(value: number | string | null | undefined, label: string): number {
  const cents = toCents(value);
  if (cents === undefined) throw new Error(`Missing price: ${label}`);
  return cents;
}

const UNIT_PRICE = /^\$?\s*(\d+(?:\.\d+)?)\s*(?:\/|per)\s*(\d*\s*[a-z]+)$/i;

/**
 * Read a unit price like "$0.70 / 100g", "$4.50 per kg" or "$0.99/ea".
 * Unit prices are optional, so text we don't recognise gives undefined
 * instead of stopping the whole run.
 */
export function parseUnitPrice(
  text: string | null | undefined,
): { unitPriceCents: number; unitLabel: string } | undefined {
  const clean = cleanText(text);
  if (clean === undefined) return undefined;

  const match = UNIT_PRICE.exec(clean);
  const amount = match?.[1];
  const unit = match?.[2];
  if (amount === undefined || unit === undefined) return undefined;

  return {
    unitPriceCents: Math.round(Number(amount) * 100),
    unitLabel: unit.replace(/\s+/g, '').toLowerCase(),
  };
}

/** Accept "2026-10-22" (or a full ISO date-time) and return "2026-10-22". Anything else throws. */
export function toIsoDate(value: string | null | undefined): string | undefined {
  const clean = cleanText(value);
  if (clean === undefined) return undefined;

  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(clean);
  if (match === null) throw new Error(`Invalid date: "${value}" (expected YYYY-MM-DD)`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!isRealDate) throw new Error(`Invalid date: "${value}"`);

  return `${match[1]}-${match[2]}-${match[3]}`;
}

/** Checked in this order, so "Frozen Vegetables" is frozen, not vegetables. */
const CATEGORY_RULES: ReadonlyArray<readonly [ProductCategory, RegExp]> = [
  ['frozen', /\bfrozen\b/],
  ['beverages', /\b(?:beverages?|drinks?|juices?|coffee|tea|water|soda|pop)\b/],
  ['meat', /\b(?:meat|beef|chicken|pork|poultry|turkey|lamb|sausages?|bacon)\b/],
  ['seafood', /\b(?:seafood|fish|salmon|shrimp|prawns?)\b/],
  ['dairy-eggs', /\b(?:dairy|milk|cheese|yogou?rt|butter|cream|eggs?)\b/],
  ['bakery', /\b(?:bakery|bread|bagels?|buns?|muffins?|tortillas?)\b/],
  ['snacks', /\b(?:snacks?|chips|crackers?|cookies?|candy|chocolate)\b/],
  ['fruits', /\b(?:fruits?|berries|apples?|bananas?|citrus)\b/],
  ['vegetables', /\b(?:vegetables?|veggies?|salad|potatoes|onions?)\b/],
  ['household', /\b(?:household|cleaning|paper|laundry|detergent)\b/],
  ['pantry', /\b(?:pantry|grocery|rice|pasta|cereal|canned|flour|oil|sugar|sauces?|spreads?|baking)\b/],
];

/**
 * Guess our category from a store's own category names.
 * Pass the most specific name first ("Fresh Vegetables" before "Fruits & Vegetables").
 * The first name that matches a rule wins; if none match the answer is 'other'.
 *
 * Limit: a combined name like "Meat & Seafood" on its own maps to 'meat'.
 * Use the store's more specific sub-category when it has one.
 */
export function categoryFromText(...texts: Array<string | null | undefined>): ProductCategory {
  for (const text of texts) {
    const lower = cleanText(text)?.toLowerCase();
    if (lower === undefined) continue;
    for (const [category, pattern] of CATEGORY_RULES) {
      if (pattern.test(lower)) return category;
    }
  }
  return 'other';
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Final safety check on a finished item. Returns the item if it is fine, throws if not. */
export function assertValidItem(item: RawItem): RawItem {
  const problems: string[] = [];

  if (item.sku.trim() === '') problems.push('sku is empty');
  if (item.name.trim() === '') problems.push('name is empty');

  const amounts: Array<[string, number | undefined]> = [
    ['regularPriceCents', item.regularPriceCents],
    ['salePriceCents', item.salePriceCents],
    ['memberPriceCents', item.memberPriceCents],
    ['unitPriceCents', item.unitPriceCents],
  ];
  for (const [label, value] of amounts) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      problems.push(`${label} must be a whole number of cents, 0 or more (got ${value})`);
    }
  }

  if (item.salePriceCents !== undefined && item.salePriceCents >= item.regularPriceCents) {
    problems.push('salePriceCents must be lower than regularPriceCents');
  }
  if (item.memberPriceCents !== undefined && item.memberPriceCents > item.regularPriceCents) {
    problems.push('memberPriceCents must not be higher than regularPriceCents');
  }

  if (item.category !== undefined && !isProductCategory(item.category)) {
    problems.push(`category "${item.category}" is not a known category`);
  }

  const dates: Array<[string, string | undefined]> = [
    ['saleStart', item.saleStart],
    ['saleEnd', item.saleEnd],
  ];
  for (const [label, value] of dates) {
    if (value !== undefined && !DATE_ONLY.test(value)) {
      problems.push(`${label} must look like YYYY-MM-DD (got "${value}")`);
    }
  }
  if (item.saleStart !== undefined && item.saleEnd !== undefined && item.saleEnd < item.saleStart) {
    problems.push('saleEnd must not be before saleStart');
  }

  if (problems.length > 0) {
    throw new Error(`Invalid item "${item.sku}": ${problems.join('; ')}`);
  }
  return item;
}
