import type { SaveOnFoodsRawItem } from '../saveOnFoods';

/**
 * MADE-UP SAMPLE DATA for development. Not real products or prices.
 * Prices are dollars, the way this connector's raw format gives them.
 */
export const saveOnFoodsSample: SaveOnFoodsRawItem[] = [
  { sku: 'SOF-1001', title: 'Bananas', packageSize: 'per kg', categories: ['Produce', 'Fruit'], price: 1.69, memberPrice: 1.49, unitPrice: '$1.69 / kg' },
  { sku: 'SOF-1002', title: 'Gala Apples 1.36 kg Bag', packageSize: '1.36 kg', categories: ['Produce', 'Fruit'], price: 5.99, promoPrice: 4.99, promoStart: '2026-10-16', promoEnd: '2026-10-22', unitPrice: '$0.37 / 100g' },
  { sku: 'SOF-1003', title: 'Russet Potatoes 4.54 kg', packageSize: '4.54 kg', categories: ['Produce', 'Vegetables'], price: 6.99, memberPrice: 5.99, unitPrice: '$0.15 / 100g' },
  { sku: 'SOF-1004', title: 'Broccoli Crowns', categories: ['Produce', 'Vegetables'], price: 3.49 },
  { sku: 'SOF-1005', title: 'Boneless Skinless Chicken Breast', packageSize: 'per kg', categories: ['Meat & Seafood', 'Poultry'], price: 14.99, promoPrice: 11.99, promoStart: '2026-10-16', promoEnd: '2026-10-22', unitPrice: '$1.20 / 100g' },
  { sku: 'SOF-1006', title: 'Lean Ground Beef 454 g', packageSize: '454 g', categories: ['Meat & Seafood', 'Beef'], price: 7.49 },
  { sku: 'SOF-1007', title: 'Atlantic Salmon Fillet', packageSize: 'per 100 g', categories: ['Meat & Seafood', 'Fish'], price: 6.99, promoPrice: 5.99, promoStart: '2026-10-16', promoEnd: '2026-10-22' },
  { sku: 'SOF-1008', title: '2% Milk 4 L', packageSize: '4 L', categories: ['Dairy & Eggs', 'Milk'], price: 6.29, memberPrice: 5.99, unitPrice: '$0.16 / 100ml' },
  { sku: 'SOF-1009', title: 'Large Eggs 12 ct', packageSize: '12 ct', categories: ['Dairy & Eggs', 'Eggs'], price: 4.99, memberPrice: 4.49 },
  { sku: 'SOF-1010', title: 'Whole Wheat Bread 675 g', packageSize: '675 g', categories: ['Bakery', 'Bread'], price: 3.99 },
  { sku: 'SOF-1011', title: 'Frozen Peas 750 g', packageSize: '750 g', categories: ['Frozen', 'Frozen Vegetables'], price: 3.49 },
  { sku: 'SOF-1012', title: 'Orange Juice 1.75 L', packageSize: '1.75 L', categories: ['Beverages', 'Juice'], price: 4.99, promoPrice: 3.99, promoStart: '2026-10-16', promoEnd: '2026-10-22' },
  { sku: 'SOF-1013', title: 'Potato Chips 200 g', packageSize: '200 g', categories: ['Snacks', 'Chips'], price: 4.49 },
  { sku: 'SOF-1014', title: 'Penne Pasta 900 g', packageSize: '900 g', categories: ['Pantry', 'Pasta & Rice'], price: 2.79 },
  { sku: 'SOF-1015', title: 'Paper Towels 6 Rolls', packageSize: '6 rolls', categories: ['Household', 'Paper Goods'], price: 10.99, promoPrice: 8.99, promoStart: '2026-10-16', promoEnd: '2026-10-22' },
];
