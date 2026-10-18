// Writes matches.json: which flyer items are the same product as an existing
// simulated product (sim-* sku), decided by hand. Run: node build-matches.mjs
import { readFileSync, writeFileSync } from 'node:fs'

// flyer sku -> [simulated sku, confidence, note]
// confidence: exact = same product and size; likely = same product, size new or
// assumed; possible = may be the same product, check before using; none = new product.
const decisions = {
  // Save-On-Foods
  'fly-honeycrisp-apples-per-lb': ['sim-honeycrisp-apples', 'exact', 'per lb'],
  'fly-navel-oranges-per-lb': ['sim-navel-oranges', 'exact', 'per lb'],
  'fly-green-grapes-per-lb': ['sim-green-grapes', 'exact', 'per lb'],
  'fly-strawberries-1-lb': ['sim-strawberries', 'exact', '1 lb = the 454 g size'],
  'fly-gala-apples-3-lb': ['sim-gala-apples', 'likely', 'new size: 3 lb bag; flyer says "Gala or Ambrosia"'],
  'fly-royal-mixed-nuts-per-100g': ['sim-mixed-nuts', 'likely', 'new size: bulk per 100 g; flyer is salted'],
  'fly-miss-vickies-potato-chips-200g': ['sim-potato-chips', 'likely', 'same 200 g size; flyer is a brand, sim is generic sea salt'],
  'fly-bulk-bagels': ['sim-bagels', 'likely', 'new size: each (bulk); sim is plain bagels 6 or 12 ct'],
  'fly-western-family-potato-chips': ['sim-potato-chips', 'possible', 'store brand, size not printed'],
  // No Frills
  'fly-royal-gala-apples-per-lb': ['sim-gala-apples', 'exact', 'per lb'],
  'fly-red-seedless-grapes-per-lb': ['sim-red-grapes', 'exact', 'per lb'],
  'fly-english-cucumbers': ['sim-english-cucumber', 'exact', 'each'],
  'fly-chicken-breast-per-lb': ['sim-chicken-breast', 'likely', 'flyer does not say boneless skinless'],
  'fly-blueberries': ['sim-blueberries', 'likely', 'size not printed; sim has 510 g and 1 kg'],
  'fly-potatoes-10-lb-bag': ['sim-russet-potatoes', 'likely', '10 lb = the 4.54 kg size; flyer does not say russet'],
  'fly-lemons-2-lb-bag': ['sim-lemons', 'likely', 'new size: 2 lb bag; sim is each'],
  'fly-farmers-market-carrots-3-lb-bag': ['sim-carrots', 'likely', 'new size: 3 lb (1.36 kg); sim has 907 g and 2.27 kg'],
  'fly-farmers-market-grape-tomatoes-283g': ['sim-cherry-tomatoes', 'likely', 'same 283 g size; grape vs cherry tomatoes'],
  'fly-sliced-mushrooms-227g': ['sim-white-mushrooms', 'likely', 'same 227 g size; sliced vs whole'],
  'fly-farmers-market-mandarins-4-lb-bag': ['sim-mandarins', 'likely', 'new size: 4 lb; sim has 2 lb and 5 lb'],
  'fly-no-name-large-eggs': ['sim-large-eggs-12', 'likely', 'size not printed; $3.33 fits a dozen'],
  'fly-wonder-bread': ['sim-white-bread', 'likely', 'size not printed; Wonder white is 675 g'],
  'fly-neilson-trutaste-milk-2l': ['sim-milk-1-2l', 'possible', 'same 2 L size; fat % not printed, sim is 1%'],
  'fly-simply-juice-or-lemonade': ['sim-orange-juice', 'possible', 'flyer covers lemonade, limeade or juice; size not printed'],
}

// Flyer items that are close to a simulated product but not the same one.
const related = {
  'fly-avalanto-tomatoes-each': 'tomato, but sim has roma (per kg) and cherry only',
  'fly-coho-salmon-fillets-per-100g': 'salmon, but sim has atlantic and sockeye',
  'fly-yellow-potatoes-3-lb': 'potatoes, but sim has russet only',
  'fly-kettle-brand-potato-chips-50g': 'chips, but 50 g single-serve; sim is 200 g',
  'fly-country-farm-house-sourdough-675g': 'bread 675 g, but sim has white and whole wheat only',
  'fly-bens-and-jerrys-ice-cream': 'ice cream, but a pint; sim is vanilla 1.5 L',
  'fly-tomatoes-on-the-vine-per-lb': 'tomato, but sim has roma (per kg) and cherry only',
  'fly-red-onions-3-lb-bag': 'onions, but sim has yellow only',
  'fly-raspberries-6-oz': 'berries, but sim has blueberries and strawberries only',
}

const dir = new URL('./', import.meta.url)
const chains = ['save-on-foods', 'no-frills', 'costco', 'real-canadian-superstore', 'walmart']
const items = chains.flatMap((chain) =>
  JSON.parse(readFileSync(new URL(`${chain}.json`, dir), 'utf8')),
)
const matches = items.map((item) => {
  const [match = null, confidence = 'none', note = related[item.sku] ?? ''] =
    decisions[item.sku] ?? []
  return {
    flyerSku: item.sku,
    chainSlug: item.chainSlug,
    flyerName: item.name,
    flyerSize: [item.size, item.unitLabel].filter(Boolean).join(' '),
    match,
    confidence,
    note,
  }
})
const unknown = Object.keys(decisions).filter((sku) => !items.some((i) => i.sku === sku))
if (unknown.length) throw new Error(`decisions for unknown flyer skus: ${unknown.join(', ')}`)

writeFileSync(new URL('matches.json', dir), `${JSON.stringify(matches, null, 2)}\n`)
const count = (c) => matches.filter((m) => m.confidence === c).length
console.log(`${matches.length} flyer items: ${count('exact')} exact, ${count('likely')} likely, ${count('possible')} possible, ${count('none')} new products`)
