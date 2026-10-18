import { describe, expect, it } from 'vitest';
import { sampleConnectors } from './connectors';
import { effectivePriceCents } from './pricing';
import { comparableUnitPrice, parsePackSize, weightUnitPrice } from './units';
import type { RawItem } from './types';

function itemWithSku(items: RawItem[], sku: string): RawItem {
  const found = items.find((item) => item.sku === sku);
  if (found === undefined) throw new Error(`No item with sku ${sku}`);
  return found;
}

async function allSampleItems(): Promise<RawItem[]> {
  return (await Promise.all(sampleConnectors.map((connector) => connector.fetchItems()))).flat();
}

describe('parsePackSize', () => {
  it('reads weights', () => {
    expect(parsePackSize('1.36 kg')).toEqual({ kind: 'weight', total: 1360 });
    expect(parsePackSize('454 g')).toEqual({ kind: 'weight', total: 454 });
    expect(parsePackSize('4.54 kg')).toEqual({ kind: 'weight', total: 4540 });
    expect(parsePackSize('16 oz')?.total).toBeCloseTo(453.592, 2);
  });
  it('reads volumes', () => {
    expect(parsePackSize('4 L')).toEqual({ kind: 'volume', total: 4000 });
    expect(parsePackSize('750 ml')).toEqual({ kind: 'volume', total: 750 });
    expect(parsePackSize('1.75 L')).toEqual({ kind: 'volume', total: 1750 });
    expect(parsePackSize('12 fl oz')?.total).toBeCloseTo(354.882, 2);
  });
  it('reads counts', () => {
    expect(parsePackSize('12 ct')).toEqual({ kind: 'count', total: 12 });
    expect(parsePackSize('6 rolls')).toEqual({ kind: 'count', total: 6 });
    expect(parsePackSize('24 count')).toEqual({ kind: 'count', total: 24 });
  });
  it('reads "per" sizes as one of that unit', () => {
    expect(parsePackSize('per kg')).toEqual({ kind: 'weight', total: 1000 });
    expect(parsePackSize('per lb')?.total).toBeCloseTo(453.592, 2);
    expect(parsePackSize('per 100 g')).toEqual({ kind: 'weight', total: 100 });
    expect(parsePackSize('per 100g')).toEqual({ kind: 'weight', total: 100 });
  });
  it('reads approximate sizes', () => {
    expect(parsePackSize('approx. 2.5 kg')).toEqual({ kind: 'weight', total: 2500 });
  });
  it('multiplies multi-packs and records how many packs', () => {
    expect(parsePackSize('2 x 4 L')).toEqual({ kind: 'volume', total: 8000, multipackOf: 2 });
    expect(parsePackSize('30 x 40 g')).toEqual({ kind: 'weight', total: 1200, multipackOf: 30 });
    expect(parsePackSize('6 × 454 g')).toEqual({ kind: 'weight', total: 2724, multipackOf: 6 });
  });
  it('does not call a single pack a multi-pack', () => {
    expect(parsePackSize('1 x 4 L')).toEqual({ kind: 'volume', total: 4000 });
    expect(parsePackSize('12 ct')?.multipackOf).toBeUndefined();
  });
  it('ignores case and extra spaces', () => {
    expect(parsePackSize('  2  X  4  l ')).toEqual({ kind: 'volume', total: 8000, multipackOf: 2 });
  });
  it('gives undefined for missing or unreadable sizes', () => {
    expect(parsePackSize(undefined)).toBeUndefined();
    expect(parsePackSize('')).toBeUndefined();
    expect(parsePackSize('assorted')).toBeUndefined();
    expect(parsePackSize('large')).toBeUndefined();
    expect(parsePackSize('0 g')).toBeUndefined();
  });
});

describe('comparableUnitPrice', () => {
  it('gives cents per 100 g for weights', () => {
    expect(comparableUnitPrice(200, '1 kg')).toEqual({ per: '100g', cents: 20 });
    expect(comparableUnitPrice(200, '500 g')).toEqual({ per: '100g', cents: 40 });
  });
  it('gives cents per 100 ml for volumes', () => {
    expect(comparableUnitPrice(400, '2 L')).toEqual({ per: '100ml', cents: 20 });
  });
  it('gives cents per item for counts', () => {
    expect(comparableUnitPrice(300, '12 ct')).toEqual({ per: 'each', cents: 25 });
  });
  it('divides a multi-pack by everything in it', () => {
    expect(comparableUnitPrice(1600, '2 x 4 L')).toEqual({ per: '100ml', cents: 20 });
  });
  it('gives undefined when the size is missing or unreadable', () => {
    expect(comparableUnitPrice(500, undefined)).toBeUndefined();
    expect(comparableUnitPrice(500, 'assorted')).toBeUndefined();
  });
});

describe('weightUnitPrice', () => {
  it('shows a weight price per kg or per lb', () => {
    const perLb = comparableUnitPrice(69, 'per lb');
    expect(perLb?.cents).toBeCloseTo(15.21, 2);
    expect(weightUnitPrice(perLb!, 'lb')).toBeCloseTo(69, 1);
    expect(weightUnitPrice(perLb!, 'kg')).toBeCloseTo(152.1, 1);
  });
  it('gives undefined for prices that are not by weight', () => {
    expect(weightUnitPrice({ per: '100ml', cents: 15 }, 'kg')).toBeUndefined();
    expect(weightUnitPrice({ per: 'each', cents: 150 }, 'lb')).toBeUndefined();
  });
});

describe('comparing the sample stores', () => {
  it('puts "per lb" and "per kg" bananas on the same footing', async () => {
    const [saveOn, walmart, costco] = await Promise.all(sampleConnectors.map((connector) => connector.fetchItems()));
    const saveOnBananas = itemWithSku(saveOn ?? [], 'SOF-1001'); // $1.69 per kg
    const walmartBananas = itemWithSku(walmart ?? [], 'W-2001'); // $0.69 per lb
    const costcoBananas = itemWithSku(costco ?? [], 'C-3001'); // $2.99 for 2 kg

    const prices = [saveOnBananas, walmartBananas, costcoBananas].map(
      (item) => comparableUnitPrice(effectivePriceCents(item), item.size)?.cents,
    );
    expect(prices[0]).toBeCloseTo(16.9, 1);
    expect(prices[1]).toBeCloseTo(15.21, 2);
    expect(prices[2]).toBeCloseTo(14.95, 2);
  });

  it('shows a bulk 2 x 4 L milk is not automatically cheaper per ml than a single 4 L', async () => {
    const [saveOn, walmart, costco] = await Promise.all(sampleConnectors.map((connector) => connector.fetchItems()));
    const unit = (item: RawItem) => comparableUnitPrice(effectivePriceCents(item), item.size);

    const saveOnMilk = unit(itemWithSku(saveOn ?? [], 'SOF-1008'));
    const walmartMilk = unit(itemWithSku(walmart ?? [], 'W-2008'));
    const costcoItem = itemWithSku(costco ?? [], 'C-3008');
    const costcoMilk = unit(costcoItem);

    expect(costcoItem.size && parsePackSize(costcoItem.size)?.multipackOf).toBe(2);
    expect(walmartMilk!.cents).toBeLessThan(costcoMilk!.cents);
    expect(costcoMilk!.cents).toBeLessThan(saveOnMilk!.cents);
    // The shelf price tells a different story: the 2-pack costs about twice as much up front.
    expect(effectivePriceCents(costcoItem)).toBeGreaterThan(effectivePriceCents(itemWithSku(walmart ?? [], 'W-2008')) * 1.9);
  });

  it('shows what a roll of paper towel costs in a 6-pack versus a 12-pack', async () => {
    const [saveOn, , costco] = await Promise.all(sampleConnectors.map((connector) => connector.fetchItems()));
    const small = itemWithSku(saveOn ?? [], 'SOF-1015'); // 6 rolls, on sale at $8.99
    const big = itemWithSku(costco ?? [], 'C-3015'); // 12 rolls, on sale at $19.99

    expect(comparableUnitPrice(effectivePriceCents(small), small.size)?.cents).toBeCloseTo(149.83, 2);
    expect(comparableUnitPrice(effectivePriceCents(big), big.size)?.cents).toBeCloseTo(166.58, 2);
  });

  it('can read the size of every sample item that has one', async () => {
    for (const item of await allSampleItems()) {
      if (item.size === undefined) continue;
      expect(comparableUnitPrice(effectivePriceCents(item), item.size), `${item.sku} size "${item.size}"`).toBeDefined();
    }
  });

  it("agrees with each store's own per-100g and per-100ml unit price to within a cent", async () => {
    let checked = 0;
    for (const item of await allSampleItems()) {
      if (item.unitPriceCents === undefined) continue;
      if (item.unitLabel !== '100g' && item.unitLabel !== '100ml') continue;

      const ours = comparableUnitPrice(effectivePriceCents(item), item.size);
      expect(ours?.per, item.sku).toBe(item.unitLabel);
      expect(Math.abs((ours?.cents ?? 0) - item.unitPriceCents), `${item.sku} ours ${ours?.cents} vs store ${item.unitPriceCents}`).toBeLessThanOrEqual(1);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(8);
  });
});
