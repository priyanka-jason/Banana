import type { ProductCategory } from '../categories';
import { costcoChain } from '../connectors/costco';
import { saveOnFoodsChain } from '../connectors/saveOnFoods';
import { walmartChain } from '../connectors/walmart';
import type { Chain } from '../types';

/** No Frills and Superstore are both Loblaw chains. The team's scrapers should reuse these. */
export const noFrillsChain: Chain = { slug: 'no-frills', name: 'No Frills', parentCompany: 'Loblaw Companies', hasMemberPricing: false };
export const superstoreChain: Chain = {
  slug: 'real-canadian-superstore',
  name: 'Real Canadian Superstore',
  parentCompany: 'Loblaw Companies',
  hasMemberPricing: false,
};

/**
 * SIMULATED store chains for the hackathon demo.
 *
 * The five chains: Save-On-Foods, Walmart and Costco, plus stand-ins for No
 * Frills and Real Canadian Superstore until the team's real scrapers for those
 * two are ready (they should use the same slugs). The chain names are real,
 * but every price, sale and store spot here is made up. Store spots are rough
 * neighbourhood centres, not real store addresses.
 *
 * Prices are chain-wide: every store of a chain charges the same price
 * anywhere in the Lower Mainland, so items carry no store id.
 */

/** Rough centres of Lower Mainland neighbourhoods. Not store addresses. */
export const AREAS = {
  'downtown-vancouver': { label: 'Downtown Vancouver', city: 'Vancouver', lat: 49.2827, lng: -123.1207 },
  'west-end': { label: 'West End', city: 'Vancouver', lat: 49.286, lng: -123.134 },
  'mount-pleasant': { label: 'Mount Pleasant', city: 'Vancouver', lat: 49.2635, lng: -123.1005 },
  kitsilano: { label: 'Kitsilano', city: 'Vancouver', lat: 49.268, lng: -123.168 },
  kerrisdale: { label: 'Kerrisdale', city: 'Vancouver', lat: 49.234, lng: -123.155 },
  marpole: { label: 'Marpole', city: 'Vancouver', lat: 49.21, lng: -123.13 },
  oakridge: { label: 'Oakridge', city: 'Vancouver', lat: 49.227, lng: -123.117 },
  grandview: { label: 'Grandview-Woodland', city: 'Vancouver', lat: 49.27, lng: -123.069 },
  'hastings-sunrise': { label: 'Hastings-Sunrise', city: 'Vancouver', lat: 49.278, lng: -123.04 },
  collingwood: { label: 'Collingwood', city: 'Vancouver', lat: 49.238, lng: -123.028 },
  metrotown: { label: 'Metrotown', city: 'Burnaby', lat: 49.226, lng: -123.0 },
  brentwood: { label: 'Brentwood', city: 'Burnaby', lat: 49.2665, lng: -123.0 },
  lougheed: { label: 'Lougheed', city: 'Burnaby', lat: 49.25, lng: -122.897 },
  edmonds: { label: 'Edmonds', city: 'Burnaby', lat: 49.212, lng: -122.96 },
  'new-westminster': { label: 'Uptown New Westminster', city: 'New Westminster', lat: 49.2057, lng: -122.911 },
  'richmond-centre': { label: 'Richmond Centre', city: 'Richmond', lat: 49.168, lng: -123.137 },
  aberdeen: { label: 'Aberdeen', city: 'Richmond', lat: 49.184, lng: -123.133 },
  steveston: { label: 'Steveston', city: 'Richmond', lat: 49.131, lng: -123.184 },
  lonsdale: { label: 'Lonsdale', city: 'North Vancouver', lat: 49.32, lng: -123.072 },
  'lynn-valley': { label: 'Lynn Valley', city: 'North Vancouver', lat: 49.34, lng: -123.035 },
  coquitlam: { label: 'Coquitlam Centre', city: 'Coquitlam', lat: 49.277, lng: -122.799 },
  'port-coquitlam': { label: 'Port Coquitlam', city: 'Port Coquitlam', lat: 49.262, lng: -122.781 },
  'surrey-central': { label: 'Surrey Central', city: 'Surrey', lat: 49.188, lng: -122.848 },
  guildford: { label: 'Guildford', city: 'Surrey', lat: 49.189, lng: -122.803 },
  newton: { label: 'Newton', city: 'Surrey', lat: 49.132, lng: -122.843 },
  'south-surrey': { label: 'South Surrey', city: 'Surrey', lat: 49.041, lng: -122.77 },
  'north-delta': { label: 'North Delta', city: 'Delta', lat: 49.159, lng: -122.91 },
  ladner: { label: 'Ladner', city: 'Delta', lat: 49.089, lng: -123.082 },
  willowbrook: { label: 'Willowbrook', city: 'Langley', lat: 49.106, lng: -122.66 },
  'maple-ridge': { label: 'Maple Ridge', city: 'Maple Ridge', lat: 49.219, lng: -122.601 },
} as const;

export type AreaId = keyof typeof AREAS;

/** The store's own words for each shared category: its department names. */
export type Departments = Record<Exclude<ProductCategory, 'other'>, string>;

/** How one simulated chain behaves. */
export interface SimulatedChainProfile {
  chain: Chain;
  /** Short code used in store ids, e.g. "wm" makes "walmart-sim-wm-metrotown". */
  code: string;
  /** Where its stores are. */
  areas: AreaId[];
  /** Price level against the typical price: 0.92 is 8% cheaper, 1.1 is 10% dearer. */
  priceLevel: number;
  /** Price endings in cents the chain likes, e.g. [97, 47] for $x.97 and $x.47. */
  endings: number[];
  /** Weight-priced items are shown per lb or per kg. */
  weightUnit: 'lb' | 'kg';
  /** Share of the catalog this chain carries (Costco only carries items with a bulk size). */
  carries: number;
  /** Share of items on sale this week. */
  onSale: number;
  /** Share of items with a members-only price (only for chains with member pricing). */
  memberDeals: number;
  departments: Departments;
}

export const SIMULATED_CHAINS: SimulatedChainProfile[] = [
  {
    chain: saveOnFoodsChain,
    code: 'sof',
    areas: ['west-end', 'kitsilano', 'grandview', 'metrotown', 'brentwood', 'lonsdale', 'coquitlam', 'willowbrook', 'steveston'],
    priceLevel: 1.07,
    endings: [99, 49, 79],
    weightUnit: 'lb',
    carries: 0.85,
    onSale: 0.25,
    memberDeals: 0.12,
    departments: {
      fruits: 'Produce', vegetables: 'Produce', meat: 'Meat', seafood: 'Seafood', 'dairy-eggs': 'Dairy & Eggs',
      bakery: 'Bakery', frozen: 'Frozen', beverages: 'Beverages', snacks: 'Snacks & Candy', pantry: 'Pantry',
      household: 'Household & Cleaning',
    },
  },
  {
    chain: walmartChain,
    code: 'wm',
    areas: ['grandview', 'metrotown', 'richmond-centre', 'coquitlam', 'guildford', 'newton', 'willowbrook'],
    priceLevel: 0.94,
    endings: [97, 47],
    weightUnit: 'kg',
    carries: 0.8,
    onSale: 0.15,
    memberDeals: 0,
    departments: {
      fruits: 'Fruits & Vegetables', vegetables: 'Fruits & Vegetables', meat: 'Meat & Seafood', seafood: 'Meat & Seafood',
      'dairy-eggs': 'Dairy & Eggs', bakery: 'Bakery & Bread', frozen: 'Frozen Food', beverages: 'Drinks', snacks: 'Snacks',
      pantry: 'Pantry', household: 'Household Essentials',
    },
  },
  {
    chain: costcoChain,
    code: 'cos',
    areas: ['downtown-vancouver', 'brentwood', 'aberdeen', 'port-coquitlam', 'surrey-central', 'willowbrook'],
    priceLevel: 1,
    endings: [99, 49, 89],
    weightUnit: 'kg',
    carries: 0.9,
    onSale: 0.2,
    memberDeals: 0,
    departments: {
      fruits: 'Fresh Produce', vegetables: 'Fresh Produce', meat: 'Meat & Seafood', seafood: 'Meat & Seafood',
      'dairy-eggs': 'Deli & Dairy', bakery: 'Bakery', frozen: 'Frozen', beverages: 'Beverages', snacks: 'Snacks',
      pantry: 'Pantry & Dry Goods', household: 'Household',
    },
  },
  {
    chain: superstoreChain,
    code: 'rcss',
    areas: ['grandview', 'marpole', 'edmonds', 'richmond-centre', 'port-coquitlam', 'guildford', 'newton', 'maple-ridge'],
    priceLevel: 0.96,
    endings: [98, 48, 28],
    weightUnit: 'kg',
    carries: 0.85,
    onSale: 0.2,
    memberDeals: 0,
    departments: {
      fruits: 'Fruits & Vegetables', vegetables: 'Fruits & Vegetables', meat: 'Meat', seafood: 'Fish & Seafood',
      'dairy-eggs': 'Dairy & Eggs', bakery: 'Bakery', frozen: 'Frozen', beverages: 'Drinks', snacks: 'Snacks, Chips & Candy',
      pantry: 'Pantry', household: 'Cleaning, Laundry & Paper',
    },
  },
  {
    chain: noFrillsChain,
    code: 'nf',
    areas: ['mount-pleasant', 'hastings-sunrise', 'collingwood', 'edmonds', 'new-westminster', 'north-delta', 'surrey-central'],
    priceLevel: 0.91,
    endings: [99, 49, 29],
    weightUnit: 'kg',
    carries: 0.7,
    onSale: 0.15,
    memberDeals: 0,
    departments: {
      fruits: 'Fruits & Vegetables', vegetables: 'Fruits & Vegetables', meat: 'Meat', seafood: 'Fish & Seafood',
      'dairy-eggs': 'Dairy & Eggs', bakery: 'Bakery', frozen: 'Frozen', beverages: 'Drinks', snacks: 'Snacks, Chips & Candy',
      pantry: 'Pantry', household: 'Cleaning, Laundry & Paper',
    },
  },
];
