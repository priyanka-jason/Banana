import { describe, expect, it } from 'vitest';
import type { RawItem } from '../types';
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

describe('cleanText', () => {
  it('trims and collapses spaces', () => {
    expect(cleanText('  2%   Milk  4 L ')).toBe('2% Milk 4 L');
  });
  it('turns empty or missing text into undefined', () => {
    expect(cleanText('   ')).toBeUndefined();
    expect(cleanText(undefined)).toBeUndefined();
    expect(cleanText(null)).toBeUndefined();
  });
});

describe('requireText', () => {
  it('returns cleaned text', () => {
    expect(requireText(' Bananas ', 'name')).toBe('Bananas');
  });
  it('throws when the text is missing', () => {
    expect(() => requireText('  ', 'name')).toThrow(/Missing text: name/);
  });
});

describe('toCents', () => {
  it('converts numbers and text to whole cents', () => {
    expect(toCents(3.49)).toBe(349);
    expect(toCents('3.49')).toBe(349);
    expect(toCents('$3.49')).toBe(349);
    expect(toCents('$1,299.00')).toBe(129900);
    expect(toCents('3.5')).toBe(350);
    expect(toCents(0)).toBe(0);
  });
  it('does not lose a cent to decimal rounding', () => {
    expect(toCents(1.15)).toBe(115);
    expect(toCents(0.29)).toBe(29);
    expect(toCents(4.35)).toBe(435);
  });
  it('gives undefined for missing values', () => {
    expect(toCents(undefined)).toBeUndefined();
    expect(toCents(null)).toBeUndefined();
    expect(toCents('')).toBeUndefined();
    expect(toCents('  ')).toBeUndefined();
  });
  it('throws on garbage instead of guessing', () => {
    expect(() => toCents('free')).toThrow(/Invalid price/);
    expect(() => toCents('$3.499')).toThrow(/Invalid price/);
    expect(() => toCents(-1)).toThrow(/Invalid price/);
    expect(() => toCents(Number.NaN)).toThrow(/Invalid price/);
  });
});

describe('requireCents', () => {
  it('returns cents when present', () => {
    expect(requireCents('$2.00', 'x')).toBe(200);
  });
  it('throws when the price is missing', () => {
    expect(() => requireCents(undefined, 'W-1 price')).toThrow(/Missing price: W-1 price/);
  });
});

describe('parseUnitPrice', () => {
  it('reads the different store wordings', () => {
    expect(parseUnitPrice('$0.70 / 100g')).toEqual({ unitPriceCents: 70, unitLabel: '100g' });
    expect(parseUnitPrice('$0.50/100g')).toEqual({ unitPriceCents: 50, unitLabel: '100g' });
    expect(parseUnitPrice('$4.50 per kg')).toEqual({ unitPriceCents: 450, unitLabel: 'kg' });
    expect(parseUnitPrice('$1.32/100 g')).toEqual({ unitPriceCents: 132, unitLabel: '100g' });
    expect(parseUnitPrice('$0.99/ea')).toEqual({ unitPriceCents: 99, unitLabel: 'ea' });
    expect(parseUnitPrice('$0.16 / 100ml')).toEqual({ unitPriceCents: 16, unitLabel: '100ml' });
  });
  it('gives undefined for missing or unrecognised text', () => {
    expect(parseUnitPrice(undefined)).toBeUndefined();
    expect(parseUnitPrice('')).toBeUndefined();
    expect(parseUnitPrice('ask in store')).toBeUndefined();
  });
});

describe('toIsoDate', () => {
  it('accepts a day or a full ISO date-time', () => {
    expect(toIsoDate('2026-10-22')).toBe('2026-10-22');
    expect(toIsoDate('2026-10-22T10:30:00Z')).toBe('2026-10-22');
  });
  it('gives undefined for missing values', () => {
    expect(toIsoDate(undefined)).toBeUndefined();
    expect(toIsoDate('')).toBeUndefined();
  });
  it('throws on other formats and on days that do not exist', () => {
    expect(() => toIsoDate('10/22/2026')).toThrow(/Invalid date/);
    expect(() => toIsoDate('2026-02-30')).toThrow(/Invalid date/);
    expect(() => toIsoDate('2026-13-01')).toThrow(/Invalid date/);
  });
});

describe('categoryFromText', () => {
  it('maps common category names', () => {
    expect(categoryFromText('Fruit')).toBe('fruits');
    expect(categoryFromText('Fresh Vegetables')).toBe('vegetables');
    expect(categoryFromText('Poultry')).toBe('meat');
    expect(categoryFromText('Ground Beef')).toBe('meat');
    expect(categoryFromText('Fish')).toBe('seafood');
    expect(categoryFromText('Dairy & Eggs')).toBe('dairy-eggs');
    expect(categoryFromText('Bread')).toBe('bakery');
    expect(categoryFromText('Juice')).toBe('beverages');
    expect(categoryFromText('Chips')).toBe('snacks');
    expect(categoryFromText('Pasta & Rice')).toBe('pantry');
    expect(categoryFromText('Paper Goods')).toBe('household');
  });
  it('treats frozen as frozen, not as the food inside', () => {
    expect(categoryFromText('Frozen Vegetables')).toBe('frozen');
    expect(categoryFromText('Frozen Fruit')).toBe('frozen');
  });
  it('lets the first (most specific) name win', () => {
    expect(categoryFromText('Fresh Vegetables', 'Fruits & Vegetables')).toBe('vegetables');
    expect(categoryFromText('Fresh Fruit', 'Fruits & Vegetables')).toBe('fruits');
  });
  it('skips missing names and falls back to later ones', () => {
    expect(categoryFromText(undefined, 'Bakery')).toBe('bakery');
  });
  it("returns 'other' when nothing matches", () => {
    expect(categoryFromText('Mystery aisle')).toBe('other');
    expect(categoryFromText()).toBe('other');
  });
});

describe('assertValidItem', () => {
  const valid: RawItem = {
    sku: 'T-1',
    name: 'Test item',
    category: 'pantry',
    regularPriceCents: 500,
    salePriceCents: 400,
    memberPriceCents: 450,
    unitPriceCents: 50,
    unitLabel: '100g',
    saleStart: '2026-10-16',
    saleEnd: '2026-10-22',
  };

  it('returns a good item unchanged', () => {
    expect(assertValidItem(valid)).toBe(valid);
  });
  it('rejects an empty sku or name', () => {
    expect(() => assertValidItem({ ...valid, sku: ' ' })).toThrow(/sku is empty/);
    expect(() => assertValidItem({ ...valid, name: '' })).toThrow(/name is empty/);
  });
  it('rejects prices that are not whole cents', () => {
    expect(() => assertValidItem({ ...valid, regularPriceCents: 4.99 })).toThrow(/whole number of cents/);
    expect(() => assertValidItem({ ...valid, unitPriceCents: -1 })).toThrow(/whole number of cents/);
  });
  it('rejects a sale price that is not lower than the regular price', () => {
    expect(() => assertValidItem({ ...valid, salePriceCents: 500 })).toThrow(/salePriceCents must be lower/);
  });
  it('rejects a member price above the regular price', () => {
    expect(() => assertValidItem({ ...valid, memberPriceCents: 600 })).toThrow(/memberPriceCents must not be higher/);
  });
  it('rejects an unknown category', () => {
    expect(() => assertValidItem({ ...valid, category: 'snacks-and-stuff' as never })).toThrow(/not a known category/);
  });
  it('rejects bad or backwards dates', () => {
    expect(() => assertValidItem({ ...valid, saleStart: '16/10/2026' })).toThrow(/YYYY-MM-DD/);
    expect(() => assertValidItem({ ...valid, saleStart: '2026-10-23' })).toThrow(/saleEnd must not be before saleStart/);
  });
  it('names the item and lists every problem', () => {
    expect(() => assertValidItem({ ...valid, sku: 'BAD-1', name: '', regularPriceCents: -5, salePriceCents: undefined })).toThrow(
      /Invalid item "BAD-1".*name is empty.*regularPriceCents/,
    );
  });
});
