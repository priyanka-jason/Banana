import type { WalmartRawItem } from '../walmart';

/**
 * MADE-UP SAMPLE DATA for development. Not real products or prices.
 * Prices are text like "$2.97", the way this connector's raw format gives them.
 * "wasPrice" is the old price when an item is on rollback.
 */
export const walmartSample: WalmartRawItem[] = [
  { sku: 'W-2001', name: 'Bananas', size: 'per lb', department: 'Fruits & Vegetables', aisle: 'Fresh Fruit', price: '$0.69', unitPriceText: '$1.52/kg' },
  { sku: 'W-2002', name: 'Gala Apples 1.36 kg', size: '1.36 kg', department: 'Fruits & Vegetables', aisle: 'Fresh Fruit', price: '$5.47', wasPrice: '$5.97', unitPriceText: '$0.40/100g' },
  { sku: 'W-2003', name: 'Russet Potatoes 4.54 kg', size: '4.54 kg', department: 'Fruits & Vegetables', aisle: 'Fresh Vegetables', price: '$5.97', unitPriceText: '$0.13/100g' },
  { sku: 'W-2004', name: 'Broccoli Crowns', department: 'Fruits & Vegetables', aisle: 'Fresh Vegetables', price: '$2.97' },
  { sku: 'W-2005', name: 'Boneless Skinless Chicken Breast Family Pack', size: 'per kg', department: 'Meat & Seafood', aisle: 'Chicken & Poultry', price: '$12.97', unitPriceText: '$1.30/100g' },
  { sku: 'W-2006', name: 'Lean Ground Beef 454 g', size: '454 g', department: 'Meat & Seafood', aisle: 'Ground Beef', price: '$6.97', wasPrice: '$7.47' },
  { sku: 'W-2007', name: 'Atlantic Salmon Fillet', size: 'per 100 g', department: 'Meat & Seafood', aisle: 'Fish', price: '$6.47' },
  { sku: 'W-2008', name: '2% Milk 4 L', size: '4 L', department: 'Dairy & Eggs', aisle: 'Milk & Cream', price: '$5.97', unitPriceText: '$0.15/100ml' },
  { sku: 'W-2009', name: 'Large Eggs 12 ct', size: '12 ct', department: 'Dairy & Eggs', aisle: 'Eggs', price: '$4.47' },
  { sku: 'W-2010', name: 'Whole Wheat Bread 675 g', size: '675 g', department: 'Bakery', aisle: 'Bread', price: '$2.97' },
  { sku: 'W-2011', name: 'Frozen Peas 750 g', size: '750 g', department: 'Frozen', aisle: 'Frozen Vegetables', price: '$2.97' },
  { sku: 'W-2012', name: 'Orange Juice 1.75 L', size: '1.75 L', department: 'Beverages', aisle: 'Juice', price: '$3.97' },
  { sku: 'W-2013', name: 'Potato Chips 200 g', size: '200 g', department: 'Snacks', aisle: 'Chips', price: '$3.47' },
  { sku: 'W-2014', name: 'Penne Pasta 900 g', size: '900 g', department: 'Pantry', aisle: 'Pasta', price: '$1.97' },
  { sku: 'W-2015', name: 'Paper Towels 6 Rolls', size: '6 rolls', department: 'Household Essentials', aisle: 'Paper Towels', price: '$8.97' },
];
