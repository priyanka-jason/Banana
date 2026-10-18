import { discountFor, effectivePriceCents } from '../pricing';
import type { Chain, MemberPricing, PriceRow } from '../types';
import { unitPriceFromTotal } from '../units';
import type { FinalItem } from './types';

/**
 * Build the row the website shows from a final item and its chain.
 * What the shopper pays, the discount and the comparable unit price depend on
 * whether they are a member, so they are worked out here and not stored.
 */
export function toPriceRow(
  item: FinalItem,
  chain: Chain,
  options: { memberPricing?: MemberPricing; distanceKm?: number } = {},
): PriceRow {
  const priceCents = effectivePriceCents(item, options.memberPricing);
  const discount = discountFor(item.regularPriceCents, priceCents);
  const comparable =
    item.sizeKind !== undefined && item.sizeTotalBase !== undefined
      ? unitPriceFromTotal(priceCents, item.sizeKind, item.sizeTotalBase)
      : undefined;

  return {
    id: item.id,
    chainSlug: chain.slug,
    chainName: chain.name,
    parentCompany: chain.parentCompany,
    locationId: item.locationId,
    sku: item.sku,
    name: item.name,
    brand: item.brand,
    size: item.size,
    sizeAmount: item.sizeAmount,
    sizeUnit: item.sizeUnit,
    packCount: item.packCount,
    pricedByWeight: item.pricedByWeight,
    category: item.category,
    imageUrl: item.imageUrl,
    priceCents,
    regularPriceCents: item.regularPriceCents,
    ...discount,
    salePriceCents: item.salePriceCents,
    memberPriceCents: item.memberPriceCents,
    unitPriceCents: item.unitPriceCents,
    unitLabel: item.unitLabel,
    comparableUnitPrice: comparable,
    saleEnd: item.saleEnd,
    sourceUrl: item.sourceUrl,
    scrapedAt: item.scrapedAt,
    distanceKm: options.distanceKm,
  };
}
