import type { StoreLocation } from '../../types';

/**
 * MADE-UP SAMPLE DATA for development. These are not real store addresses.
 * Coordinates are rough Metro Vancouver spots, just enough to try the
 * distance filter and map markers.
 */
export const sampleLocations: StoreLocation[] = [
  { id: 'save-on-foods-sample-1', chainSlug: 'save-on-foods', name: 'Save-On-Foods (sample, Vancouver)', city: 'Vancouver', lat: 49.2827, lng: -123.1207 },
  { id: 'save-on-foods-sample-2', chainSlug: 'save-on-foods', name: 'Save-On-Foods (sample, Burnaby)', city: 'Burnaby', lat: 49.2488, lng: -122.9805 },
  { id: 'walmart-sample-1', chainSlug: 'walmart', name: 'Walmart (sample, Burnaby)', city: 'Burnaby', lat: 49.2276, lng: -123.0076 },
  { id: 'walmart-sample-2', chainSlug: 'walmart', name: 'Walmart (sample, Richmond)', city: 'Richmond', lat: 49.1666, lng: -123.1336 },
  { id: 'costco-sample-1', chainSlug: 'costco', name: 'Costco (sample, Burnaby)', city: 'Burnaby', lat: 49.2610, lng: -123.0130 },
  { id: 'costco-sample-2', chainSlug: 'costco', name: 'Costco (sample, Richmond)', city: 'Richmond', lat: 49.1900, lng: -123.1000 },
];

/** The sample locations for one chain. Returns a copy so callers can't change the shared list. */
export function sampleLocationsFor(chainSlug: string): StoreLocation[] {
  return sampleLocations.filter((location) => location.chainSlug === chainSlug).map((location) => ({ ...location }));
}
