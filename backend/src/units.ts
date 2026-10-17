import type { ComparableUnitPrice } from './types';

/**
 * Stores price things in different ways: per kg, per lb, per 100 g, per roll,
 * or as a big multi-pack. This file converts a price and a pack size into one
 * standard unit price, so different stores and pack sizes can be compared.
 */

/** How big a pack is, in a base unit: grams for weight, millilitres for volume, or a count of items. */
export interface PackSize {
  kind: 'weight' | 'volume' | 'count';
  /** The total amount in the base unit. "2 x 4 L" is 8000 (ml). "12 ct" is 12. */
  total: number;
  /** For a multi-pack written "N x size" (like "30 x 40 g"), N. Left out for a single pack. */
  multipackOf?: number;
}

const GRAMS_PER_LB = 453.592;
const GRAMS_PER_OZ = 28.3495;
const ML_PER_FL_OZ = 29.5735;

const UNITS: Record<string, { kind: PackSize['kind']; factor: number }> = {
  g: { kind: 'weight', factor: 1 },
  kg: { kind: 'weight', factor: 1000 },
  lb: { kind: 'weight', factor: GRAMS_PER_LB },
  lbs: { kind: 'weight', factor: GRAMS_PER_LB },
  oz: { kind: 'weight', factor: GRAMS_PER_OZ },
  ml: { kind: 'volume', factor: 1 },
  l: { kind: 'volume', factor: 1000 },
  'fl oz': { kind: 'volume', factor: ML_PER_FL_OZ },
  ct: { kind: 'count', factor: 1 },
  count: { kind: 'count', factor: 1 },
  ea: { kind: 'count', factor: 1 },
  each: { kind: 'count', factor: 1 },
  roll: { kind: 'count', factor: 1 },
  rolls: { kind: 'count', factor: 1 },
  pk: { kind: 'count', factor: 1 },
  pack: { kind: 'count', factor: 1 },
};

// Optional "N x" in front, then an optional amount, then the unit: "2 x 4 L", "12 ct", "kg".
const PACK_SIZE = /^(?:(\d+)\s*[x×]\s*)?(?:(\d+(?:\.\d+)?)\s*)?([a-z]+(?:\s+[a-z]+)?)$/;

/**
 * Read a pack size like "1.36 kg", "4 L", "12 ct", "2 x 4 L", "30 x 40 g",
 * "per lb" or "approx. 2.5 kg". Text we don't recognise gives undefined.
 *
 * "per kg" and "per lb" mean the price is for that much (so 1 kg and 1 lb).
 */
export function parsePackSize(text: string | null | undefined): PackSize | undefined {
  const clean = text
    ?.trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^(?:approx\.?|about|~)\s*/, '')
    .replace(/^per\s+/, '');
  if (!clean) return undefined;

  const match = PACK_SIZE.exec(clean);
  if (match === null) return undefined;

  const unit = UNITS[match[3] ?? ''];
  if (unit === undefined) return undefined;

  const packCount = match[1] === undefined ? undefined : Number(match[1]);
  const amount = match[2] === undefined ? 1 : Number(match[2]);
  const total = (packCount ?? 1) * amount * unit.factor;
  if (!(total > 0)) return undefined;

  return {
    kind: unit.kind,
    total,
    ...(packCount !== undefined && packCount > 1 ? { multipackOf: packCount } : {}),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Convert what the shopper pays and the pack size into a standard unit price:
 * cents per 100 g, per 100 ml, or per item. Compare these across stores.
 * Gives undefined when the pack size is missing or can't be read.
 */
export function comparableUnitPrice(
  priceCents: number,
  size: string | null | undefined,
): ComparableUnitPrice | undefined {
  const pack = parsePackSize(size);
  if (pack === undefined) return undefined;

  switch (pack.kind) {
    case 'weight':
      return { per: '100g', cents: round2((priceCents / pack.total) * 100) };
    case 'volume':
      return { per: '100ml', cents: round2((priceCents / pack.total) * 100) };
    case 'count':
      return { per: 'each', cents: round2(priceCents / pack.total) };
  }
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
