import type { SearchOrigin } from '../data/mockLocations'

// Public BC geocoder; no API key, paid fallback, or address persistence.
// Search only on explicit submit. Keep this boundary replaceable by a future API.
export async function searchAddresses(
  query: string,
  signal: AbortSignal,
): Promise<SearchOrigin[]> {
  const url = new URL('https://geocoder.api.gov.bc.ca/addresses.geojson')
  url.search = new URLSearchParams({
    addressString: /vancouver/i.test(query) ? query : `${query}, Vancouver, BC`,
    maxResults: '5',
    outputSRS: '4326',
    minScore: '70',
    autoComplete: 'false',
  }).toString()
  const response = await fetch(url, {
    signal,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  })
  if (!response.ok)
    throw new Error(
      'Address search is unavailable. Try again or use your location.',
    )
  const data = await response.json()
  return (data.features ?? []).flatMap(
    (feature: {
      geometry?: { coordinates?: number[] }
      properties?: { fullAddress?: string; localityName?: string }
    }) => {
      const coordinates = feature.geometry?.coordinates
      const label = feature.properties?.fullAddress
      if (
        !label ||
        feature.properties?.localityName !== 'Vancouver' ||
        !coordinates ||
        !Number.isFinite(coordinates[0]) ||
        !Number.isFinite(coordinates[1])
      )
        return []
      return [{ label, longitude: coordinates[0], latitude: coordinates[1] }]
    },
  )
}
