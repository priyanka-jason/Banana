import type { ProductCategory } from '../categories';
import { categoryFromText } from '../connectors/normalize';

/**
 * Hand-checked mappings from a store's own category name to one of our shared
 * categories: { "store-slug": { "store category name in lowercase": "shared-category" } }.
 *
 * It starts empty. The combine step reports every store category it had to
 * guess or couldn't match, and a person adds the right answers here, e.g.
 *   'save-on-foods': { 'pasta & rice': 'pantry' }
 */
export type CategoryMap = Record<string, Record<string, ProductCategory>>;

export const CATEGORY_MAP: CategoryMap = {};

/** How a shared category was chosen: from the map, guessed from keywords, or not at all. */
export type CategoryHow = 'map' | 'guess' | 'none';

/**
 * Pick our shared category for an item from the store's own category names
 * (broadest first). The most specific name is tried first.
 *
 * 1. If the map has an entry for that name, use it.
 * 2. Otherwise guess from keywords (categoryFromText). A person should review guesses.
 * 3. If nothing matches the category is 'other'.
 */
export function mapToSharedCategory(
  chainSlug: string,
  storeCategories: string[],
  map: CategoryMap = CATEGORY_MAP,
): { category: ProductCategory; how: CategoryHow } {
  const mostSpecificFirst = [...storeCategories].reverse();

  const table = Object.hasOwn(map, chainSlug) ? map[chainSlug] : undefined;
  if (table !== undefined) {
    for (const name of mostSpecificFirst) {
      const key = name.trim().toLowerCase();
      const mapped = Object.hasOwn(table, key) ? table[key] : undefined;
      if (mapped !== undefined) return { category: mapped, how: 'map' };
    }
  }

  const guess = categoryFromText(...mostSpecificFirst);
  return guess === 'other' ? { category: 'other', how: 'none' } : { category: guess, how: 'guess' };
}
