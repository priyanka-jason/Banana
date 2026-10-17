import { describe, expect, it } from 'vitest';
import { sampleConnectors } from '../connectors';
import type { Chain } from '../types';
import { combine } from './combine';
import { toPriceRow } from './priceRow';
import { recordsFromItems } from './storeRecords';
import type { FinalItem } from './types';

async function sampleFinal(): Promise<{ chains: Chain[]; items: FinalItem[] }> {
  const chains = sampleConnectors.map((connector) => connector.chain);
  const records = (
    await Promise.all(
      sampleConnectors.map(async (connector) =>
        recordsFromItems(connector.chain.slug, await connector.fetchItems(), '2026-10-17T20:00:00.000Z'),
      ),
    )
  ).flat();
  return { chains, items: combine(chains, records).items };
}

async function rowFor(id: string, options?: Parameters<typeof toPriceRow>[2]) {
  const { chains, items } = await sampleFinal();
  const item = items.find((candidate) => candidate.id === id);
  if (item === undefined) throw new Error(`No item ${id}`);
  const chain = chains.find((candidate) => candidate.slug === item.chainSlug);
  if (chain === undefined) throw new Error(`No chain for ${id}`);
  return toPriceRow(item, chain, options);
}

describe('toPriceRow', () => {
  it('shows a non-member the regular price, with no discount and a comparable unit price', async () => {
    const row = await rowFor('save-on-foods:SOF-1001');

    expect(row).toMatchObject({
      id: 'save-on-foods:SOF-1001',
      chainName: 'Save-On-Foods',
      parentCompany: 'Pattison Food Group',
      name: 'Bananas',
      category: 'fruits',
      priceCents: 169,
      regularPriceCents: 169,
    });
    expect(row).not.toHaveProperty('discountCents');
    expect(row).not.toHaveProperty('discountPercent');
    expect(row.comparableUnitPrice).toEqual({ per: '100g', cents: 16.9 });
  });

  it('shows a member the member price, the discount and a unit price for that price', async () => {
    const row = await rowFor('save-on-foods:SOF-1001', { memberPricing: 'member' });

    expect(row).toMatchObject({ priceCents: 149, regularPriceCents: 169, discountCents: 20, discountPercent: 12 });
    expect(row.comparableUnitPrice).toEqual({ per: '100g', cents: 14.9 });
  });

  it('shows a sale price as a discount on the original', async () => {
    const row = await rowFor('walmart:W-2002');

    expect(row).toMatchObject({ priceCents: 547, regularPriceCents: 597, discountCents: 50, discountPercent: 8 });
    expect(row.comparableUnitPrice).toEqual({ per: '100g', cents: 40.22 });
  });

  it('carries the multi-pack flag and the distance when given', async () => {
    const row = await rowFor('costco:C-3008', { distanceKm: 3.4 });
    expect(row.multipackOf).toBe(2);
    expect(row.distanceKm).toBe(3.4);
  });

  it('leaves the comparable unit price out when there is no size', async () => {
    const row = await rowFor('walmart:W-2004');
    expect(row.comparableUnitPrice).toBeUndefined();
  });
});
