/**
 * Product categories, shared by the store connectors, the database and the
 * front end (for filter chips and labels).
 *
 * To add one: add its slug here, add its label below, and add it to the
 * category check in sql/draft-schema.sql.
 */
export const PRODUCT_CATEGORIES = [
  'fruits',
  'vegetables',
  'meat',
  'seafood',
  'dairy-eggs',
  'bakery',
  'frozen',
  'beverages',
  'snacks',
  'pantry',
  'household',
  'other',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/** Names to show people. The slugs above are for code and the database. */
export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  fruits: 'Fruits',
  vegetables: 'Vegetables',
  meat: 'Meat',
  seafood: 'Seafood',
  'dairy-eggs': 'Dairy & Eggs',
  bakery: 'Bakery',
  frozen: 'Frozen',
  beverages: 'Beverages',
  snacks: 'Snacks',
  pantry: 'Pantry',
  household: 'Household',
  other: 'Other',
};

export function isProductCategory(value: string): value is ProductCategory {
  return (PRODUCT_CATEGORIES as readonly string[]).includes(value);
}
