import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addressSearchUrl,
  inMetroVancouver,
  metroAddresses,
} from '../src/api/addressSearch.ts'

const feature = (fullAddress: string, longitude: number, latitude: number) => ({
  geometry: { coordinates: [longitude, latitude] },
  properties: { fullAddress },
})

test('searches all of BC within the Metro Vancouver box, not just the City of Vancouver', () => {
  const url = addressSearchUrl('3511 granville ave')
  assert.equal(url.searchParams.get('addressString'), '3511 granville ave, BC')
  assert.equal(url.searchParams.get('bbox'), '-123.45,49,-122.28,49.5')
  assert.equal(
    addressSearchUrl('4700 Kingsway, Burnaby, BC').searchParams.get(
      'addressString',
    ),
    '4700 Kingsway, Burnaby, BC',
  )
})

test('keeps Metro Vancouver cities and drops the rest of BC', () => {
  const results = metroAddresses({
    features: [
      feature('3511 Granville Ave, Richmond, BC', -123.1888, 49.1631),
      feature('3511 Granville St, Vancouver, BC', -123.139, 49.2544),
      feature('1200 Lonsdale Ave, North Vancouver, BC', -123.0726, 49.3196),
      feature('20202 66 Ave, Township of Langley, BC', -122.6626, 49.1191),
      feature('3511 Tranquille Rd, Kamloops, BC', -120.4012, 50.6974),
      feature('1 Main St, Salmo, BC', -117.278, 49.1934),
    ],
  })
  assert.deepEqual(
    results.map((result) => result.label),
    [
      '3511 Granville Ave, Richmond, BC',
      '3511 Granville St, Vancouver, BC',
      '1200 Lonsdale Ave, North Vancouver, BC',
      '20202 66 Ave, Township of Langley, BC',
    ],
  )
  assert.deepEqual(results[0], {
    label: '3511 Granville Ave, Richmond, BC',
    longitude: -123.1888,
    latitude: 49.1631,
  })
})

test('ignores results without a label or coordinates', () => {
  assert.deepEqual(
    metroAddresses({
      features: [
        { properties: { fullAddress: 'No point, Vancouver, BC' } },
        { geometry: { coordinates: [-123.1, 49.2] }, properties: {} },
      ],
    }),
    [],
  )
  assert.deepEqual(metroAddresses({}), [])
  assert.equal(inMetroVancouver(-123.1, 49.25), true)
  assert.equal(inMetroVancouver(-121.3, 49.38), false)
})
