import type { StoreLocation } from './types';

/**
 * The real grocery stores the website shows, one per physical branch.
 *
 * Copied from the frontend's list (frontend/src/data/storeLocations.ts on the frontend/setup
 * branch, commit d3c676e), so the website and the API agree on every store and its id.
 * The frontend's "superstore" is "real-canadian-superstore" here. Phone numbers and Google
 * place ids are not copied: the database has no columns for them yet.
 *
 * Addresses are real; the prices for them are still simulated. Every branch of a chain has
 * the chain's prices.
 */
export const STORE_LOCATIONS: readonly StoreLocation[] = [
  {id: "nofrills-joti", chainSlug: "no-frills", name: "Joti's NOFRILLS Vancouver", address: "310 W Broadway", city: "Vancouver", postalCode: "V5Y 1R2", lat: 49.263006, lng: -123.11135},
  {id: "nofrills-denman", chainSlug: "no-frills", name: "Brandon & Joanny's NOFRILLS Vancouver", address: "1030 Denman St #101", city: "Vancouver", postalCode: "V6G 1P5", lat: 49.2887289, lng: -123.1382003},
  {id: "nofrills-harry", chainSlug: "no-frills", name: "Harry's NOFRILLS Vancouver", address: "1688 W 4th Ave", city: "Vancouver", postalCode: "V6J 0B7", lat: 49.267808, lng: -123.14256},
  {id: "nofrills-arkee", chainSlug: "no-frills", name: "Arkee's NOFRILLS Vancouver", address: "1460 E Hastings St", city: "Vancouver", postalCode: "V5L 1S3", lat: 49.280998, lng: -123.07464},
  {id: "nofrills-dean", chainSlug: "no-frills", name: "Dean's NOFRILLS Vancouver", address: "4508 Fraser St", city: "Vancouver", postalCode: "V5V 4G8", lat: 49.244543, lng: -123.08977},
  {id: "nofrills-simon", chainSlug: "no-frills", name: "Simon's NOFRILLS Vancouver", address: "2083 Alma St #130", city: "Vancouver", postalCode: "V6R 4N6", lat: 49.267977, lng: -123.186452},
  {id: "nofrills-justin", chainSlug: "no-frills", name: "Justin's NOFRILLS Burnaby Hastings", address: "4780 Hastings St", city: "Burnaby", postalCode: "V5C 0P4", lat: 49.280721, lng: -122.995323},
  {id: "saveon-cambie", chainSlug: "save-on-foods", name: "Save-On-Foods Cambie", address: "2308 Cambie St", city: "Vancouver", postalCode: "V5Z 2T8", lat: 49.2647015, lng: -123.1141354},
  {id: "saveon-kingedward", chainSlug: "save-on-foods", name: "Save-On-Foods King Edward", address: "1403 E King Edward Ave", city: "Vancouver", postalCode: "V5N 5Z4", lat: 49.2488025, lng: -123.0756672},
  {id: "saveon-w41st", chainSlug: "save-on-foods", name: "Save-On-Foods W 41st", address: "3535 W 41st Ave", city: "Vancouver", postalCode: "V6N 3E7", lat: 49.235106, lng: -123.18384},
  {id: "saveon-main", chainSlug: "save-on-foods", name: "Save-On-Foods Main St", address: "2949 Main St", city: "Vancouver", postalCode: "V5T 3G4", lat: 49.2586823, lng: -123.101628},
  {id: "saveon-ubc", chainSlug: "save-on-foods", name: "Save-On-Foods UBC Berton Ave", address: "5945 Berton Ave", city: "Vancouver", postalCode: "V6S 0B3", lat: 49.2548182, lng: -123.2365944},
  {id: "saveon-westblvd", chainSlug: "save-on-foods", name: "Save-On-Foods West Blvd", address: "6455 West Blvd", city: "Vancouver", postalCode: "V6M 3W4", lat: 49.2275605, lng: -123.155753},
  {id: "saveon-kingsgate", chainSlug: "save-on-foods", name: "Save-On-Foods Kingsgate Mall", address: "370 E Broadway #200", city: "Vancouver", postalCode: "V5T 4G5", lat: 49.262388, lng: -123.0971534},
  {id: "saveon-bentall", chainSlug: "save-on-foods", name: "Save-On-Foods Bentall St", address: "2880 Bentall St", city: "Vancouver", postalCode: "V5M 4H4", lat: 49.2585003, lng: -123.0314829},
  {id: "saveon-riverdistrict", chainSlug: "save-on-foods", name: "Save-On-Foods River District", address: "8550 River District Crossing", city: "Vancouver", postalCode: "V5S 0E3", lat: 49.2063731, lng: -123.0309648},
  {id: "saveon-salt", chainSlug: "save-on-foods", name: "Save-On-Foods Salt St", address: "1688 Salt St", city: "Vancouver", postalCode: "V5Y 0E4", lat: 49.2706692, lng: -123.1059183},
  {id: "saveon-brentwood", chainSlug: "save-on-foods", name: "Save-On-Foods Brentwood (Lougheed Hwy)", address: "4399 Lougheed Hwy", city: "Burnaby", postalCode: "V5C 3Y7", lat: 49.2669426, lng: -123.0083629},
  {id: "saveon-metrotown", chainSlug: "save-on-foods", name: "Save-On-Foods Kingsway (Metrotown)", address: "4469 Kingsway", city: "Burnaby", postalCode: "V5H 2A1", lat: 49.23124, lng: -123.0045954},
  {id: "saveon-marketcrossing", chainSlug: "save-on-foods", name: "Save-On-Foods Market Crossing", address: "7501 Market Crossing", city: "Burnaby", postalCode: "V5J 0A3", lat: 49.1984725, lng: -122.9802355},
  {id: "saveon-edmonds", chainSlug: "save-on-foods", name: "Save-On-Foods Kingsway (Edmonds)", address: "7155 Kingsway #200", city: "Burnaby", postalCode: "V5E 2V1", lat: 49.2188483, lng: -122.9565355},
  {id: "saveon-northrd", chainSlug: "save-on-foods", name: "Save-On-Foods North Rd", address: "3433 North Rd Unit 102", city: "Burnaby", postalCode: "V3J 0A9", lat: 49.2524739, lng: -122.8935868},
  {id: "saveon-ironwood", chainSlug: "save-on-foods", name: "Save-On-Foods Ironwood", address: "11666 Steveston Hwy #3000", city: "Richmond", postalCode: "V7A 5J3", lat: 49.1322721, lng: -123.0960322},
  {id: "saveon-terranova", chainSlug: "save-on-foods", name: "Save-On-Foods Terra Nova", address: "3673 Westminster Hwy", city: "Richmond", postalCode: "V7C 5V2", lat: 49.1708885, lng: -123.1831626},
  {id: "saveon-gardencity", chainSlug: "save-on-foods", name: "Save-On-Foods Garden City (Blundell)", address: "9100 Blundell Rd", city: "Richmond", postalCode: "V6Y 2R1", lat: 49.1544605, lng: -123.1233193},
  {id: "saveon-thirdave", chainSlug: "save-on-foods", name: "Save-On-Foods Third Ave", address: "12088 Third Ave #105", city: "Richmond", postalCode: "V7E 0C3", lat: 49.1259342, lng: -123.1855253},
  {id: "walmart-grandview", chainSlug: "walmart", name: "Walmart Supercentre Grandview Hwy", address: "3585 Grandview Hwy", city: "Vancouver", postalCode: "V5M 2G7", lat: 49.2592375, lng: -123.0270661},
  {id: "walmart-metrotown", chainSlug: "walmart", name: "Walmart Supercentre Metrotown", address: "4545 Central Blvd", city: "Burnaby", postalCode: "V5H 4J5", lat: 49.2247893, lng: -122.9998034},
  {id: "walmart-austin", chainSlug: "walmart", name: "Walmart Austin Rd", address: "9855 Austin Rd #3008", city: "Burnaby", postalCode: "V3J 1N5", lat: 49.2519335, lng: -122.896087},
  {id: "walmart-alderbridge", chainSlug: "walmart", name: "Walmart Supercentre Alderbridge", address: "9251 Alderbridge Wy", city: "Richmond", postalCode: "V6X 0M6", lat: 49.1779587, lng: -123.1203521},
  {id: "superstore-grandview", chainSlug: "real-canadian-superstore", name: "Real Canadian Superstore Grandview Highway", address: "3185 Grandview Hwy", city: "Vancouver", postalCode: "V5M 2E9", lat: 49.2589696, lng: -123.0367347},
  {id: "superstore-marine", chainSlug: "real-canadian-superstore", name: "Real Canadian Superstore Marine Drive", address: "350 SE Marine Dr", city: "Vancouver", postalCode: "V5X 2S5", lat: 49.208521, lng: -123.099468},
  {id: "superstore-kingsway", chainSlug: "real-canadian-superstore", name: "Real Canadian Superstore Eaton Centre / Kingsway", address: "4700 Kingsway #1105", city: "Burnaby", postalCode: "V5H 4M1", lat: 49.2273657, lng: -123.0013046},
  {id: "superstore-no3rd", chainSlug: "real-canadian-superstore", name: "Real Canadian Superstore No 3 Road", address: "4651 Number 3 Rd", city: "Richmond", postalCode: "V6X 2C4", lat: 49.179361, lng: -123.138351},
  {id: "costco-expo", chainSlug: "costco", name: "Costco Wholesale Vancouver (Expo Blvd)", address: "605 Expo Blvd", city: "Vancouver", postalCode: "V6B 1V4", lat: 49.2786137, lng: -123.1093316},
  {id: "costco-stillcreek", chainSlug: "costco", name: "Costco Wholesale Burnaby (Still Creek)", address: "4500 Still Creek Dr", city: "Burnaby", postalCode: "V5C 0E5", lat: 49.2606833, lng: -123.0001328},
  {id: "costco-brighton", chainSlug: "costco", name: "Costco Wholesale Burnaby (Brighton)", address: "3550 Brighton Ave", city: "Burnaby", postalCode: "V5A 4W3", lat: 49.2512184, lng: -122.9170892},
  {id: "costco-bridgeport", chainSlug: "costco", name: "Costco Wholesale Richmond (Bridgeport)", address: "9151 Bridgeport Rd", city: "Richmond", postalCode: "V6X 3L9", lat: 49.1930382, lng: -123.1218312},
];

/** The stores of one chain. Returns copies so callers can't change the shared list. */
export function storeLocationsFor(chainSlug: string): StoreLocation[] {
  return STORE_LOCATIONS.filter((store) => store.chainSlug === chainSlug).map((store) => ({ ...store }));
}
