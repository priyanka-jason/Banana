import type { CostcoRawItem } from '../costco';

/**
 * MADE-UP SAMPLE DATA for development. Not real products or prices.
 * Prices are dollars. "instantSavingsCad" is taken off the listed price for a limited time.
 * Packs are bulk sizes, so compare unit prices, not shelf prices.
 */
export const costcoSample: CostcoRawItem[] = [
  { itemNumber: 'C-3001', description: 'Bananas', packSize: '2 kg', category: 'Produce', subcategory: 'Fruit', priceCad: 2.99, perUnit: '$0.15 per 100g' },
  { itemNumber: 'C-3002', description: 'Gala Apples', packSize: '3.63 kg', category: 'Produce', subcategory: 'Fruit', priceCad: 11.99, instantSavingsCad: 2.0, savingsStart: '2026-10-14', savingsEnd: '2026-10-25', perUnit: '$0.28 per 100g' },
  { itemNumber: 'C-3003', description: 'Russet Potatoes', packSize: '9.07 kg', category: 'Produce', subcategory: 'Vegetables', priceCad: 9.49, perUnit: '$0.10 per 100g' },
  { itemNumber: 'C-3004', description: 'Broccoli Crowns', packSize: '1.36 kg', category: 'Produce', subcategory: 'Vegetables', priceCad: 5.99 },
  { itemNumber: 'C-3005', description: 'Boneless Skinless Chicken Breast', packSize: 'approx. 2.5 kg', category: 'Meat', subcategory: 'Chicken', priceCad: 24.99, perUnit: '$1.00 per 100g' },
  { itemNumber: 'C-3006', description: 'Lean Ground Beef', packSize: '1.36 kg', category: 'Meat', subcategory: 'Beef', priceCad: 14.99, instantSavingsCad: 2.5, savingsStart: '2026-10-14', savingsEnd: '2026-10-25' },
  { itemNumber: 'C-3007', description: 'Atlantic Salmon Fillet', packSize: '1.13 kg', category: 'Seafood', subcategory: 'Fish', priceCad: 24.99, perUnit: '$2.21 per 100g' },
  { itemNumber: 'C-3008', description: '2% Milk', packSize: '2 x 4 L', category: 'Dairy', subcategory: 'Milk', priceCad: 11.99, perUnit: '$0.15 per 100ml' },
  { itemNumber: 'C-3009', description: 'Large Eggs', packSize: '24 ct', category: 'Dairy', subcategory: 'Eggs', priceCad: 8.99 },
  { itemNumber: 'C-3010', description: 'Whole Wheat Bread', packSize: '2 x 675 g', category: 'Bakery', subcategory: 'Bread', priceCad: 6.49 },
  { itemNumber: 'C-3011', description: 'Frozen Peas', packSize: '2.5 kg', category: 'Frozen', subcategory: 'Frozen Vegetables', priceCad: 8.99 },
  { itemNumber: 'C-3012', description: 'Orange Juice', packSize: '2 x 2.63 L', category: 'Beverages', subcategory: 'Juice', priceCad: 10.99 },
  { itemNumber: 'C-3013', description: 'Potato Chips Variety Pack', packSize: '30 x 40 g', category: 'Snacks', subcategory: 'Chips', priceCad: 13.99 },
  { itemNumber: 'C-3014', description: 'Penne Pasta', packSize: '6 x 454 g', category: 'Pantry', subcategory: 'Pasta', priceCad: 7.99 },
  { itemNumber: 'C-3015', description: 'Paper Towels', packSize: '12 rolls', category: 'Household', subcategory: 'Paper Goods', priceCad: 24.99, instantSavingsCad: 5.0, savingsStart: '2026-10-14', savingsEnd: '2026-10-25' },
];
