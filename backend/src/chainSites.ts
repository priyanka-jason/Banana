/**
 * Each chain's public website, for "visit the store's site" links. Keyed by chain slug.
 * Public addresses, not data from the stores. Add a line when a chain is added.
 */
export const CHAIN_WEBSITES: Readonly<Record<string, string>> = {
  'save-on-foods': 'https://www.saveonfoods.com/',
  walmart: 'https://www.walmart.ca/',
  costco: 'https://www.costco.ca/',
  'no-frills': 'https://www.nofrills.ca/',
  'real-canadian-superstore': 'https://www.realcanadiansuperstore.ca/',
};

export function chainWebsite(slug: string): string | undefined {
  return Object.hasOwn(CHAIN_WEBSITES, slug) ? CHAIN_WEBSITES[slug] : undefined;
}
