import type { ProductCategory } from '../categories';

/**
 * SIMULATED products for the hackathon demo. Not real products or real prices.
 *
 * One generic list that every simulated store picks from. Prices are rough
 * "typical regular price in Metro Vancouver" guesses. Each store then moves the
 * price up or down a little (see chains.ts), so stores differ in a believable way.
 */
export interface CatalogProduct {
  /** Stable id, used to build the sku: "sim-<key>". Never change one once the team relies on it. */
  key: string;
  name: string;
  /** Size as a store would print it. "per lb" means the price is per pound. */
  size?: string;
  /** Which shared category it really belongs to. Used to build the category map. */
  category: Exclude<ProductCategory, 'other'>;
  /** A store-style aisle name. Each aisle belongs to exactly one category. */
  aisle: string;
  /** Typical regular price in cents (per lb for "per lb" items). */
  cents: number;
  /** Costco sells a bigger pack instead: its size and typical price. Without this, Costco doesn't carry it. */
  costco?: { size: string; cents: number };
  /** Mostly carried by T&T; other stores carry it less often. */
  specialty?: boolean;
}

type Extra = Pick<CatalogProduct, 'costco' | 'specialty'>;

function p(
  key: string,
  name: string,
  size: string | undefined,
  category: CatalogProduct['category'],
  aisle: string,
  cents: number,
  extra: Extra = {},
): CatalogProduct {
  return { key, name, ...(size === undefined ? {} : { size }), category, aisle, cents, ...extra };
}

const bulk = (size: string, cents: number): Extra => ({ costco: { size, cents } });
const specialty: Extra = { specialty: true };

export const CATALOG: CatalogProduct[] = [
  // Fruits
  p('bananas', 'Bananas', 'per lb', 'fruits', 'Fresh Fruit', 79, bulk('3 lb', 249)),
  p('organic-bananas', 'Organic Bananas', 'per lb', 'fruits', 'Fresh Fruit', 99),
  p('gala-apples', 'Gala Apples', 'per lb', 'fruits', 'Fresh Fruit', 179, bulk('2.27 kg', 849)),
  p('honeycrisp-apples', 'Honeycrisp Apples', 'per lb', 'fruits', 'Fresh Fruit', 299),
  p('navel-oranges', 'Navel Oranges', 'per lb', 'fruits', 'Citrus', 149),
  p('mandarins', 'Mandarin Oranges', '2 lb', 'fruits', 'Citrus', 549, bulk('5 lb', 1099)),
  p('lemons', 'Lemons', '1 each', 'fruits', 'Citrus', 89),
  p('strawberries', 'Strawberries', '454 g', 'fruits', 'Berries', 499, bulk('907 g', 799)),
  p('blueberries', 'Blueberries', '510 g', 'fruits', 'Berries', 599, bulk('1 kg', 1199)),
  p('red-grapes', 'Red Seedless Grapes', 'per lb', 'fruits', 'Fresh Fruit', 349),
  p('green-grapes', 'Green Seedless Grapes', 'per lb', 'fruits', 'Fresh Fruit', 349, bulk('1.36 kg', 999)),
  p('avocados', 'Avocados', '4 ct', 'fruits', 'Fresh Fruit', 499, bulk('6 ct', 849)),

  // Vegetables
  p('english-cucumber', 'English Cucumber', '1 each', 'vegetables', 'Fresh Vegetables', 179),
  p('mini-cucumbers', 'Mini Cucumbers', '397 g', 'vegetables', 'Fresh Vegetables', 399, bulk('907 g', 649)),
  p('roma-tomatoes', 'Roma Tomatoes', 'per lb', 'vegetables', 'Fresh Vegetables', 199),
  p('cherry-tomatoes', 'Cherry Tomatoes', '283 g', 'vegetables', 'Fresh Vegetables', 349, bulk('907 g', 799)),
  p('red-peppers', 'Red Bell Peppers', 'per lb', 'vegetables', 'Fresh Vegetables', 399, bulk('6 ct', 799)),
  p('broccoli', 'Broccoli Crowns', 'per lb', 'vegetables', 'Fresh Vegetables', 249),
  p('carrots', 'Carrots', '907 g', 'vegetables', 'Fresh Vegetables', 249, bulk('2.27 kg', 499)),
  p('russet-potatoes', 'Russet Potatoes', '4.54 kg', 'vegetables', 'Potatoes & Onions', 699, bulk('9.07 kg', 1199)),
  p('yellow-onions', 'Yellow Onions', '1.36 kg', 'vegetables', 'Potatoes & Onions', 349),
  p('romaine-hearts', 'Romaine Hearts', '3 ct', 'vegetables', 'Salad & Greens', 449, bulk('6 ct', 699)),
  p('baby-spinach', 'Baby Spinach', '312 g', 'vegetables', 'Salad & Greens', 549),
  p('white-mushrooms', 'White Mushrooms', '227 g', 'vegetables', 'Mushrooms', 279, bulk('907 g', 699)),
  p('baby-bok-choy', 'Baby Bok Choy', 'per lb', 'vegetables', 'Asian Vegetables', 199, specialty),
  p('gai-lan', 'Gai Lan (Chinese Broccoli)', 'per lb', 'vegetables', 'Asian Vegetables', 299, specialty),
  p('firm-tofu', 'Firm Tofu', '454 g', 'vegetables', 'Tofu', 279, specialty),

  // Meat
  p('chicken-breast', 'Boneless Skinless Chicken Breast', 'per lb', 'meat', 'Chicken', 699, bulk('per kg', 1519)),
  p('chicken-thighs', 'Boneless Skinless Chicken Thighs', 'per lb', 'meat', 'Chicken', 549, bulk('per kg', 1199)),
  p('whole-chicken', 'Whole Chicken', 'per lb', 'meat', 'Chicken', 349),
  p('lean-ground-beef', 'Lean Ground Beef', '454 g', 'meat', 'Beef', 749, bulk('1.8 kg', 2499)),
  p('extra-lean-ground-beef', 'Extra Lean Ground Beef', '454 g', 'meat', 'Beef', 849),
  p('striploin-steak', 'Beef Striploin Steak', 'per lb', 'meat', 'Beef', 1499, bulk('per kg', 2999)),
  p('pork-chops', 'Pork Loin Chops', 'per lb', 'meat', 'Pork', 449),
  p('bacon', 'Bacon', '375 g', 'meat', 'Bacon & Sausages', 699, bulk('3 x 500 g', 2199)),

  // Seafood
  p('atlantic-salmon', 'Atlantic Salmon Fillet', 'per lb', 'seafood', 'Fresh Fish', 1299, bulk('per kg', 2299)),
  p('sockeye-salmon', 'Wild Sockeye Salmon Fillet', 'per lb', 'seafood', 'Fresh Fish', 1699),
  p('raw-shrimp', 'Raw Shrimp 31/40', '680 g', 'seafood', 'Shrimp & Prawns', 1499, bulk('907 g', 1899)),
  p('canned-tuna', 'Chunk Light Tuna', '170 g', 'seafood', 'Canned Fish', 179, bulk('8 x 170 g', 1199)),

  // Dairy & eggs
  p('milk-2-4l', '2% Milk', '4 L', 'dairy-eggs', 'Milk & Cream', 649, bulk('2 x 4 L', 1149)),
  p('milk-1-2l', '1% Milk', '2 L', 'dairy-eggs', 'Milk & Cream', 429),
  p('large-eggs-12', 'Large Eggs', '12 ct', 'dairy-eggs', 'Eggs', 479),
  p('large-eggs-30', 'Large Eggs', '30 ct', 'dairy-eggs', 'Eggs', 1099, bulk('30 ct', 949)),
  p('cheddar', 'Medium Cheddar Cheese', '400 g', 'dairy-eggs', 'Cheese', 699, bulk('1.2 kg', 1599)),
  p('mozzarella', 'Shredded Mozzarella', '320 g', 'dairy-eggs', 'Cheese', 699),
  p('greek-yogurt', 'Plain Greek Yogurt', '750 g', 'dairy-eggs', 'Yogurt', 599, bulk('2 x 750 g', 999)),
  p('butter', 'Salted Butter', '454 g', 'dairy-eggs', 'Butter', 649, bulk('4 x 454 g', 2199)),
  p('oat-milk', 'Oat Beverage', '1.89 L', 'dairy-eggs', 'Plant-Based Milk', 499),

  // Bakery
  p('white-bread', 'White Sandwich Bread', '675 g', 'bakery', 'Bread', 329),
  p('whole-wheat-bread', 'Whole Wheat Bread', '675 g', 'bakery', 'Bread', 349, bulk('2 x 675 g', 649)),
  p('bagels', 'Plain Bagels', '6 ct', 'bakery', 'Bagels & Buns', 449, bulk('12 ct', 799)),
  p('croissants', 'Butter Croissants', '6 ct', 'bakery', 'Sweet Bakery', 549, bulk('12 ct', 899)),

  // Frozen
  p('frozen-peas', 'Green Peas, Frozen', '750 g', 'frozen', 'Frozen Vegetables', 349),
  p('frozen-mixed-veg', 'Mixed Vegetables, Frozen', '1 kg', 'frozen', 'Frozen Vegetables', 449, bulk('2.5 kg', 899)),
  p('frozen-berries', 'Mixed Berries, Frozen', '600 g', 'frozen', 'Frozen Fruit', 699, bulk('2 kg', 1599)),
  p('frozen-pizza', 'Pepperoni Pizza, Frozen', '850 g', 'frozen', 'Frozen Meals', 799),
  p('ice-cream', 'Vanilla Ice Cream', '1.5 L', 'frozen', 'Ice Cream', 699),
  p('frozen-dumplings', 'Pork & Chive Dumplings, Frozen', '1 kg', 'frozen', 'Frozen Dumplings', 999, specialty),

  // Beverages
  p('orange-juice', 'Orange Juice', '1.75 L', 'beverages', 'Juice', 499, bulk('3 x 1.75 L', 1199)),
  p('ground-coffee', 'Medium Roast Ground Coffee', '920 g', 'beverages', 'Coffee', 1599, bulk('1.36 kg', 1999)),
  p('spring-water', 'Spring Water', '24 x 500 ml', 'beverages', 'Water', 449, bulk('40 x 500 ml', 549)),
  p('sparkling-water', 'Lime Sparkling Water', '12 x 355 ml', 'beverages', 'Water', 699),

  // Snacks
  p('potato-chips', 'Sea Salt Potato Chips', '200 g', 'snacks', 'Chips', 449),
  p('tortilla-chips', 'Tortilla Chips', '300 g', 'snacks', 'Chips', 449, bulk('907 g', 799)),
  p('mixed-nuts', 'Roasted Mixed Nuts', '600 g', 'snacks', 'Nuts', 1299, bulk('1.13 kg', 1999)),

  // Pantry
  p('spaghetti', 'Spaghetti', '900 g', 'pantry', 'Pasta', 249),
  p('penne', 'Penne', '900 g', 'pantry', 'Pasta', 249),
  p('jasmine-rice', 'Jasmine Rice', '8 kg', 'pantry', 'Rice', 2299, bulk('8 kg', 1999)),
  p('diced-tomatoes', 'Diced Tomatoes', '796 ml', 'pantry', 'Canned Vegetables', 199),
  p('canola-oil', 'Canola Oil', '3 L', 'pantry', 'Oils & Vinegar', 999, bulk('2 x 3 L', 1799)),
  p('peanut-butter', 'Smooth Peanut Butter', '1 kg', 'pantry', 'Spreads', 649, bulk('2 kg', 1099)),
  p('soy-sauce', 'Soy Sauce', '500 ml', 'pantry', 'Asian Pantry', 349),
  p('instant-ramen', 'Instant Ramen Noodles', '5 x 85 g', 'pantry', 'Asian Pantry', 399, specialty),

  // Household
  p('paper-towels', 'Paper Towels', '6 rolls', 'household', 'Paper Towels', 999, bulk('12 rolls', 2299)),
  p('toilet-paper', 'Toilet Paper, Double Rolls', '12 rolls', 'household', 'Toilet Paper', 999, bulk('40 rolls', 3299)),
  p('laundry-detergent', 'Liquid Laundry Detergent', '2.95 L', 'household', 'Laundry', 1299, bulk('4.43 L', 2299)),
  p('dish-soap', 'Dish Soap', '709 ml', 'household', 'Cleaning', 399),
];
