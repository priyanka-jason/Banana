import { describe, expect, it } from 'vitest';
import { comparableUnitPrice, parsePackSize, parseSize, unitPriceFromTotal } from './units';

describe('parseSize', () => {
  it('splits a size into pack count, amount, unit, kind and total', () => {
    expect(parseSize('1.36 kg')).toEqual({
      packCount: 1,
      amount: 1.36,
      unit: 'kg',
      kind: 'weight',
      totalBase: 1360,
      pricedByWeight: false,
    });
    expect(parseSize('2 x 4 L')).toEqual({
      packCount: 2,
      amount: 4,
      unit: 'l',
      kind: 'volume',
      totalBase: 8000,
      pricedByWeight: false,
    });
    expect(parseSize('30 x 40 g')).toEqual({
      packCount: 30,
      amount: 40,
      unit: 'g',
      kind: 'weight',
      totalBase: 1200,
      pricedByWeight: false,
    });
    expect(parseSize('12 ct')).toEqual({
      packCount: 1,
      amount: 12,
      unit: 'ct',
      kind: 'count',
      totalBase: 12,
      pricedByWeight: false,
    });
  });

  it('turns the different ways of writing a unit into one fixed unit', () => {
    expect(parseSize('2 lbs')?.unit).toBe('lb');
    expect(parseSize('750 ML')?.unit).toBe('ml');
    expect(parseSize('1.75 L')?.unit).toBe('l');
    expect(parseSize('12 fl oz')?.unit).toBe('fl oz');
    for (const text of ['12 ct', '12 count', '12 ea', '12 each', '6 rolls', '1 roll', '6 pk', '6 pack']) {
      expect(parseSize(text), text).toMatchObject({ unit: 'ct', kind: 'count' });
    }
  });

  it('marks sizes written "per" a weight as priced by weight', () => {
    expect(parseSize('per kg')).toMatchObject({ pricedByWeight: true, amount: 1, unit: 'kg', totalBase: 1000 });
    expect(parseSize('per lb')).toMatchObject({ pricedByWeight: true, amount: 1, unit: 'lb' });
    expect(parseSize('per lb')?.totalBase).toBeCloseTo(453.592, 2);
    expect(parseSize('per 100 g')).toMatchObject({ pricedByWeight: true, amount: 100, unit: 'g', totalBase: 100 });
  });

  it('does not call a package priced by weight just because the weight is approximate', () => {
    expect(parseSize('approx. 2.5 kg')).toMatchObject({ pricedByWeight: false, amount: 2.5, unit: 'kg', totalBase: 2500 });
    expect(parseSize('1.36 kg')?.pricedByWeight).toBe(false);
  });

  it('only counts "per" as priced by weight for weights', () => {
    expect(parseSize('per each')?.pricedByWeight).toBe(false);
    expect(parseSize('per 100 ml')?.pricedByWeight).toBe(false);
  });

  it('does not call a "1 x" size a multi-pack', () => {
    expect(parseSize('1 x 4 L')).toMatchObject({ packCount: 1, totalBase: 4000 });
  });

  it('gives undefined for missing, unreadable or empty sizes', () => {
    expect(parseSize(undefined)).toBeUndefined();
    expect(parseSize(null)).toBeUndefined();
    expect(parseSize('')).toBeUndefined();
    expect(parseSize('assorted')).toBeUndefined();
    expect(parseSize('0 g')).toBeUndefined();
    expect(parseSize('0 x 4 L')).toBeUndefined();
  });

  it('is not fooled by units that are names of built-in JavaScript properties', () => {
    expect(parseSize('constructor')).toBeUndefined();
    expect(parseSize('12 constructor')).toBeUndefined();
    expect(parseSize('2 x 4 toString')).toBeUndefined();
  });

  it('agrees with parsePackSize', () => {
    for (const text of ['1.36 kg', '2 x 4 L', '12 ct', 'per lb', 'approx. 2.5 kg', '30 x 40 g', 'assorted']) {
      const parsed = parseSize(text);
      const pack = parsePackSize(text);
      if (parsed === undefined) {
        expect(pack, text).toBeUndefined();
      } else {
        expect(pack?.kind, text).toBe(parsed.kind);
        expect(pack?.total, text).toBe(parsed.totalBase);
        expect(pack?.multipackOf, text).toBe(parsed.packCount > 1 ? parsed.packCount : undefined);
      }
    }
  });
});

describe('unitPriceFromTotal', () => {
  it('gives cents per 100 g, per 100 ml or per item', () => {
    expect(unitPriceFromTotal(200, 'weight', 1000)).toEqual({ per: '100g', cents: 20 });
    expect(unitPriceFromTotal(400, 'volume', 2000)).toEqual({ per: '100ml', cents: 20 });
    expect(unitPriceFromTotal(300, 'count', 12)).toEqual({ per: 'each', cents: 25 });
  });

  it('gives undefined when the total is not above zero', () => {
    expect(unitPriceFromTotal(300, 'count', 0)).toBeUndefined();
    expect(unitPriceFromTotal(300, 'weight', -5)).toBeUndefined();
  });

  it('gives the same answer as reading the size text', () => {
    for (const size of ['1.36 kg', '2 x 4 L', '12 ct', 'per lb', '30 x 40 g']) {
      const parsed = parseSize(size);
      if (parsed === undefined) throw new Error(`could not read ${size}`);
      expect(unitPriceFromTotal(799, parsed.kind, parsed.totalBase), size).toEqual(comparableUnitPrice(799, size));
    }
  });
});
