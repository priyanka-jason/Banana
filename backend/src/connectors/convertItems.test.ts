import { describe, expect, it } from 'vitest';
import type { RawItem } from '../types';
import { convertItems, nameSku } from './convertItems';

interface Raw {
  id?: unknown;
  name: string;
  price: number;
}

const parse = (raw: Raw): RawItem => ({
  sku: String(raw.id),
  name: raw.name,
  storeCategories: [],
  regularPriceCents: Math.round(raw.price * 100),
});
const skuOf = (raw: Raw): unknown => raw.id;

describe('convertItems', () => {
  it('keeps the good items and skips the bad ones, with sku, position and reason', () => {
    const result = convertItems(
      [
        { id: 'A', name: 'A', price: 1 },
        { id: 'B', name: 'B', price: -5 },
        { id: 'C', name: 'C', price: 3 },
      ],
      parse,
      skuOf,
    );

    expect(result.items.map((item) => item.sku)).toEqual(['A', 'C']);
    expect(result.skipped).toEqual([
      { sku: 'B', index: 1, reason: expect.stringContaining('"B"') },
    ]);
    expect(result.skipped[0]?.reason).toMatch(/whole number of cents/);
  });

  it('puts the sku in front when the error did not mention it', () => {
    const result = convertItems(
      [{ id: 'X-1', name: 'X', price: 1 }],
      () => {
        throw new Error('Invalid price: "call us"');
      },
      skuOf,
    );
    expect(result.skipped).toEqual([{ sku: 'X-1', index: 0, reason: 'X-1: Invalid price: "call us"' }]);
  });

  it('does not repeat the sku when the error already names it', () => {
    const result = convertItems(
      [{ id: 'SOF-1001', name: 'X', price: 1 }],
      () => {
        throw new Error('Missing price: SOF-1001 price');
      },
      skuOf,
    );
    expect(result.skipped[0]?.reason).toBe('Missing price: SOF-1001 price');
  });

  it('names an item with no sku by its position', () => {
    const result = convertItems(
      [
        { id: 'A', name: 'A', price: 1 },
        { id: undefined, name: 'No sku', price: 1 },
      ],
      (raw) => {
        if (raw.id === undefined) throw new Error('no id');
        return parse(raw);
      },
      skuOf,
    );
    expect(result.skipped).toEqual([{ sku: '(item 2, no sku)', index: 1, reason: '(item 2, no sku): no id' }]);
  });

  it('accepts a numeric sku', () => {
    const result = convertItems(
      [{ id: 123, name: 'X', price: 1 }],
      () => {
        throw new Error('bad');
      },
      skuOf,
    );
    expect(result.skipped[0]).toMatchObject({ sku: '123', reason: '123: bad' });
  });

  it('copes with something thrown that is not an Error', () => {
    const result = convertItems(
      [{ id: 'A', name: 'A', price: 1 }],
      () => {
        throw 'boom';
      },
      skuOf,
    );
    expect(result.skipped[0]?.reason).toBe('A: boom');
  });

  it('skips an item that is not even an object, and keeps going', () => {
    const result = convertItems(
      [null, { id: 'B', name: 'B', price: 1 }] as unknown as Raw[],
      parse,
      skuOf,
    );
    expect(result.items.map((item) => item.sku)).toEqual(['B']);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toMatchObject({ sku: '(item 1, no sku)', index: 0 });
  });

  it('gives nothing and skips nothing for an empty list', () => {
    expect(convertItems([], parse, skuOf)).toEqual({ items: [], skipped: [] });
  });

  it('refuses something that is not a list, saying what it got', () => {
    expect(() => convertItems(null as unknown as Raw[], parse, skuOf)).toThrow(/list of items.*got null/);
    expect(() => convertItems({} as unknown as Raw[], parse, skuOf)).toThrow(/list of items.*got object/);
  });
});

describe('nameSku', () => {
  it('leaves a message alone when it already names the sku', () => {
    expect(nameSku('W-2003', 'Invalid item "W-2003": price')).toBe('Invalid item "W-2003": price');
    expect(nameSku('SOF-1001', 'Missing price: SOF-1001 price')).toBe('Missing price: SOF-1001 price');
  });

  it('puts the sku in front when the message does not name it', () => {
    expect(nameSku('W-2003', 'Invalid price: "call us"')).toBe('W-2003: Invalid price: "call us"');
  });

  it('is not fooled by a short sku inside a longer word or number', () => {
    expect(nameSku('1', 'got 100 cents')).toBe('1: got 100 cents');
    expect(nameSku('a', 'Invalid price')).toBe('a: Invalid price');
    expect(nameSku('1', 'price 1 is too low')).toBe('price 1 is too low');
  });

  it('copes with skus that contain special characters', () => {
    expect(nameSku('(item 2, no sku)', 'no id')).toBe('(item 2, no sku): no id');
    expect(nameSku('A.B+C', 'bad A.B+C value')).toBe('bad A.B+C value');
    expect(nameSku('A.B', 'bad AxB value')).toBe('A.B: bad AxB value');
  });
});
