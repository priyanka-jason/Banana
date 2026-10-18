import type { SearchOrigin } from '../data/storeLocations.ts'

// Public BC geocoder; no API key, paid fallback, or address persistence.
// Search only on explicit submit. Keep this boundary replaceable by a future API.

/** Metro Vancouver, west to east and south to north: Bowen Island and Tsawwassen
 * to Maple Ridge and Langley, the US border to Lions Bay. */
export const metroVancouver = {
  west: -123.45,
  south: 49.0,
  east: -122.28,
  north: 49.5,
}

export function inMetroVancouver(longitude: number, latitude: number) {
  return (
    longitude >= metroVancouver.west &&
    longitude <= metroVancouver.east &&
    latitude >= metroVancouver.south &&
    latitude <= metroVancouver.north
  )
}

/** Neighbours just east of Metro Vancouver that the box clips. */
const outsideMetro = new Set(['Abbotsford', 'Mission'])

/** partial: the visitor is still typing, so let the geocoder complete the last word. */
export function addressSearchUrl(query: string, partial = false): URL {
  const url = new URL('https://geocoder.api.gov.bc.ca/addresses.geojson')
  url.search = new URLSearchParams({
    addressString: /\bB\.?C\.?\b|british columbia/i.test(query)
      ? query
      : `${query}, BC`,
    maxResults: '5',
    outputSRS: '4326',
    minScore: '70',
    autoComplete: partial ? 'true' : 'false',
    bbox: [
      metroVancouver.west,
      metroVancouver.south,
      metroVancouver.east,
      metroVancouver.north,
    ].join(','),
  }).toString()
  return url
}

interface GeocoderResponse {
  features?: {
    geometry?: { coordinates?: number[] }
    properties?: { fullAddress?: string; localityName?: string }
  }[]
}

export function metroAddresses(data: GeocoderResponse): SearchOrigin[] {
  return (data.features ?? []).flatMap((feature) => {
    const [longitude, latitude] = feature.geometry?.coordinates ?? []
    const label = feature.properties?.fullAddress
    if (
      !label ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      !inMetroVancouver(longitude, latitude) ||
      outsideMetro.has(feature.properties?.localityName ?? '')
    )
      return []
    return [{ label, longitude, latitude }]
  })
}

export async function searchAddresses(
  query: string,
  signal: AbortSignal,
  partial = false,
): Promise<SearchOrigin[]> {
  const response = await fetch(addressSearchUrl(query, partial), {
    signal,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  })
  if (!response.ok)
    throw new Error(
      'Address search is unavailable. Try again or use your location.',
    )
  return metroAddresses((await response.json()) as GeocoderResponse)
}
