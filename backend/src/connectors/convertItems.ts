import type { RawItem } from '../types';
import { assertValidItem } from './normalize';
import type { FetchResult, SkippedItem } from './types';

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Make sure a problem message names the item, even when the original error
 * didn't. If the message already has the sku as a whole word it is left alone,
 * otherwise "sku: " is put in front. A short sku like "1" is not mistaken for
 * the "1" inside "100".
 */
export function nameSku(sku: string, message: string): string {
  const mentionsIt = new RegExp(`(^|[^A-Za-z0-9_-])${escapeForRegExp(sku)}($|[^A-Za-z0-9_-])`).test(message);
  return mentionsIt ? message : `${sku}: ${message}`;
}

/** A name for an item in error messages: its sku, or its position when it has none. */
function labelFor<T>(raw: T, skuOf: (raw: T) => unknown, index: number): string {
  try {
    const value = skuOf(raw);
    if (typeof value === 'string' && value.trim() !== '') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  } catch {
    // The raw item isn't even an object. Fall through to the position.
  }
  return `(item ${index + 1}, no sku)`;
}

/**
 * Turn a store's raw items into our items, one at a time.
 *
 * An item that can't be converted or fails the checks (a missing price, a
 * garbled date, a sale price above the regular price) is skipped and reported
 * with its sku and the reason. The other items still go through. Without this,
 * one bad item on a real site would throw away the whole store's run.
 *
 * Every reason names the sku, even when the original error didn't.
 */
export function convertItems<T>(
  rawItems: readonly T[],
  parse: (raw: T) => RawItem,
  skuOf: (raw: T) => unknown,
): FetchResult {
  if (!Array.isArray(rawItems)) {
    const got = (rawItems as unknown) === null ? 'null' : typeof rawItems;
    throw new Error(`Expected a list of items from the store, got ${got}`);
  }

  const items: RawItem[] = [];
  const skipped: SkippedItem[] = [];

  rawItems.forEach((raw, index) => {
    const sku = labelFor(raw, skuOf, index);
    try {
      items.push(assertValidItem(parse(raw)));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      skipped.push({ sku, index, reason: nameSku(sku, message) });
    }
  });

  return { items, skipped };
}
