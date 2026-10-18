import type { MemberPricing, RawItem } from './types';

/** The prices that decide what a shopper pays. */
type PriceFields = Pick<RawItem, 'regularPriceCents' | 'salePriceCents' | 'memberPriceCents'>;

/**
 * The id the website uses for an item: the chain's slug and the store's own
 * sku joined as "chain:sku", e.g. "save-on-foods:SOF-1001".
 *
 * It is unique across all stores and stays the same every time the item is
 * scraped again. Treat it as plain text: don't take it apart, and encode it
 * before putting it in a web address.
 */
export function itemId(chainSlug: string, sku: string): string {
  if (chainSlug.trim() === '' || sku.trim() === '') {
    throw new Error('itemId needs both a chain slug and a sku');
  }
  return `${chainSlug}:${sku}`;
}

/**
 * The price a shopper actually pays, in cents.
 *
 * Non-member (the default): the sale price if there is one, otherwise the regular price.
 * Member: the lowest of the member price and the non-member price.
 * A sale price that is not lower than the regular price is ignored.
 */
export function effectivePriceCents(item: PriceFields, memberPricing: MemberPricing = 'non-member'): number {
  const nonMember =
    item.salePriceCents !== undefined && item.salePriceCents < item.regularPriceCents
      ? item.salePriceCents
      : item.regularPriceCents;

  if (memberPricing === 'member' && item.memberPriceCents !== undefined) {
    return Math.min(nonMember, item.memberPriceCents);
  }
  return nonMember;
}

/**
 * How much cheaper the price is than the original price: the amount in cents
 * and as a whole percent of the original (rounded, so a tiny discount can be 0%).
 * Gives undefined when the price is not below the original, so there is nothing to show.
 */
export function discountFor(
  regularPriceCents: number,
  priceCents: number,
): { discountCents: number; discountPercent: number } | undefined {
  if (regularPriceCents <= 0 || priceCents >= regularPriceCents) return undefined;

  const discountCents = regularPriceCents - priceCents;
  return {
    discountCents,
    discountPercent: Math.round((discountCents / regularPriceCents) * 100),
  };
}
