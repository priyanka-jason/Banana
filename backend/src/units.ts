import type { ComparableUnitPrice, SizeKind, SizeUnit } from './types';

/**
 * Stores price things in different ways: per kg, per lb, per 100 g, per roll,
 * or as a big multi-pack. This file splits a size like "2 x 4 L" into separate
 * values, and converts a price plus a size into one standard unit price, so
 * different stores and pack sizes can be compared.
 */

/** A size text split into separate values. */
export interface ParsedSize {
  /** How many packs are bundled: 2 for "2 x 4 L". 1 for a single pack. */
  packCount: number;
  /** Amount in one pack, in `unit`: 4 for "2 x 4 L". */
  amount: number;
  unit: SizeUnit;
  kind: SizeKind;
  /** Everything in the pack in a base unit: grams for weight, millilitres for volume, items for count. 8000 for "2 x 4 L". */
  totalBase: number;
  /** True for sizes written "per kg", "per lb" or "per 100 g": the price is for that weight, not for a package. */
  pricedByWeight: boolean;
}

const GRAMS_PER_LB = 453.592;
const GRAMS_PER_OZ = 28.3495;
const ML_PER_FL_OZ = 29.5735;

/** Every way a unit can be written, and the fixed unit it becomes. `factor` converts one of it to the base unit. */
const UNITS: Record<string, { unit: SizeUnit; kind: SizeKind; factor: number }> = {
  g: { unit: 'g', kind: 'weight', factor: 1 },
  kg: { unit: 'kg', kind: 'weight', factor: 1000 },
  lb: { unit: 'lb', kind: 'weight', factor: GRAMS_PER_LB },
  lbs: { unit: 'lb', kind: 'weight', factor: GRAMS_PER_LB },
  oz: { unit: 'oz', kind: 'weight', factor: GRAMS_PER_OZ },
  ml: { unit: 'ml', kind: 'volume', factor: 1 },
  l: { unit: 'l', kind: 'volume', factor: 1000 },
  'fl oz': { unit: 'fl oz', kind: 'volume', factor: ML_PER_FL_OZ },
  ct: { unit: 'ct', kind: 'count', factor: 1 },
  count: { unit: 'ct', kind: 'count', factor: 1 },
  ea: { unit: 'ct', kind: 'count', factor: 1 },
  each: { unit: 'ct', kind: 'count', factor: 1 },
  roll: { unit: 'ct', kind: 'count', factor: 1 },
  rolls: { unit: 'ct', kind: 'count', factor: 1 },
  pk: { unit: 'ct', kind: 'count', factor: 1 },
  pack: { unit: 'ct', kind: 'count', factor: 1 },
};

// Optional "N x" in front, then an optional amount, then the unit: "2 x 4 L", "12 ct", "kg".
const PACK_SIZE = /^(?:(\d+)\s*[x×]\s*)?(?:(\d+(?:\.\d+)?)\s*)?([a-z]+(?:\s+[a-z]+)?)$/;

/**
 * Split a size like "1.36 kg", "4 L", "12 ct", "2 x 4 L", "30 x 40 g", "per lb"
 * or "approx. 2.5 kg" into separate values. Text we don't recognise gives undefined.
 *
 * "per kg" and "per lb" mean the price is for that much (so 1 kg and 1 lb), and
 * set `pricedByWeight`.
 */
export function parseSize(text: string | null | undefined): ParsedSize | undefined {
  const clean = text
    ?.trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^(?:approx\.?|about|~)\s*/, '');
  if (!clean) return undefined;

  const pricedPer = /^per\s+/.test(clean);
  const match = PACK_SIZE.exec(clean.replace(/^per\s+/, ''));
  if (match === null) return undefined;

  const unitText = match[3] ?? '';
  const unit = Object.hasOwn(UNITS, unitText) ? UNITS[unitText] : undefined;
  if (unit === undefined) return undefined;

  const packCount = match[1] === undefined ? 1 : Number(match[1]);
  const amount = match[2] === undefined ? 1 : Number(match[2]);
  const totalBase = packCount * amount * unit.factor;
  if (!(totalBase > 0)) return undefined;

  return {
    packCount,
    amount,
    unit: unit.unit,
    kind: unit.kind,
    totalBase,
    pricedByWeight: pricedPer && unit.kind === 'weight',
  };
}

/** How big a pack is, in a base unit: grams for weight, millilitres for volume, or a count of items. */
export interface PackSize {
  kind: SizeKind;
  /** The total amount in the base unit. "2 x 4 L" is 8000 (ml). "12 ct" is 12. */
  total: number;
  /** For a multi-pack written "N x size" (like "30 x 40 g"), N. Left out for a single pack. */
  multipackOf?: number;
}

/** A shorter view of parseSize(): the kind, the total in the base unit, and how many packs. */
export function parsePackSize(text: string | null | undefined): PackSize | undefined {
  const parsed = parseSize(text);
  if (parsed === undefined) return undefined;
  return {
    kind: parsed.kind,
    total: parsed.totalBase,
    ...(parsed.packCount > 1 ? { multipackOf: parsed.packCount } : {}),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Standard unit price from a price and a size that is already split up: cents
 * per 100 g, per 100 ml, or per item. Gives undefined when the total isn't above zero.
 */
export function unitPriceFromTotal(
  priceCents: number,
  kind: SizeKind,
  totalBase: number,
): ComparableUnitPrice | undefined {
  if (!(totalBase > 0)) return undefined;

  switch (kind) {
    case 'weight':
      return { per: '100g', cents: round2((priceCents / totalBase) * 100) };
    case 'volume':
      return { per: '100ml', cents: round2((priceCents / totalBase) * 100) };
    case 'count':
      return { per: 'each', cents: round2(priceCents / totalBase) };
  }
}

/**
 * Convert what the shopper pays and a size text into a standard unit price:
 * cents per 100 g, per 100 ml, or per item. Compare these across stores.
 * Gives undefined when the size is missing or can't be read.
 */
export function comparableUnitPrice(
  priceCents: number,
  size: string | null | undefined,
): ComparableUnitPrice | undefined {
  const parsed = parseSize(size);
  if (parsed === undefined) return undefined;
  return unitPriceFromTotal(priceCents, parsed.kind, parsed.totalBase);
}

/**
 * Show a weight unit price per kg or per lb (shoppers see both on shelves and
 * in flyers). Gives cents per kg or per lb, or undefined if it isn't a weight price.
 */
export function weightUnitPrice(unitPrice: ComparableUnitPrice, to: 'kg' | 'lb'): number | undefined {
  if (unitPrice.per !== '100g') return undefined;
  const centsPerGram = unitPrice.cents / 100;
  return round2(centsPerGram * (to === 'kg' ? 1000 : GRAMS_PER_LB));
}
