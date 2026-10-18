import { test } from 'node:test'
import assert from 'node:assert/strict'
import { branches, neighbourhoodOrigins } from '../src/data/storeLocations.ts'
import {
  branchOffers,
  distanceKm,
  nearbyBranches,
  radiusRing,
} from '../src/lib/locations.ts'
import { getNearbyOffers, readFilters } from '../src/lib/catalogue.ts'

const origin = neighbourhoodOrigins['mount-pleasant']
test('radius uses geographic distance and excludes brands without item data', () => {
  assert.equal(distanceKm(origin, origin), 0)
  assert.ok(
    Math.abs(
      distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }) -
        111.195,
    ) < 0.01,
  )
  assert.equal(nearbyBranches(origin, 5).length, 12)
  assert.equal(nearbyBranches(origin, 1).length, 5)
  assert.equal(
    nearbyBranches(origin, 5, [
      ...branches,
      { ...branches[0], id: 'unsupported', brandId: 'unknown' },
    ]).length,
    12,
  )
  assert.equal(
    nearbyBranches({ label: 'far away', latitude: 48, longitude: -123 }, 10)
      .length,
    0,
  )
})
test('separate branches of a chain share the same offers', () => {
  const nearby = nearbyBranches(origin, 5)
  const sameBrand = nearby.filter((branch) => branch.brandId === 'no-frills')
  assert.equal(sameBrand.length, 5)
  assert.deepEqual(
    branchOffers(sameBrand[0]).map((offer) => [offer.id, offer.price]),
    branchOffers(sameBrand[1]).map((offer) => [offer.id, offer.price]),
  )
  assert.notEqual(sameBrand[0].distance, sameBrand[1].distance)
})
test('radius ring closes and each point follows the requested radius', () => {
  const ring = radiusRing(origin, 5)
  assert.deepEqual(ring[0], ring.at(-1))
  for (const [longitude, latitude] of ring)
    assert.ok(Math.abs(distanceKm(origin, { latitude, longitude }) - 5) < 0.001)
})
test('catalogue follows the selected branch distance and hides brands without supported branches', () => {
  const filters = readFilters(new URLSearchParams())
  const results = getNearbyOffers(filters, origin, 'nofrills-joti')
  const branch = branches.find((branch) => branch.id === 'nofrills-joti')!
  assert.ok(
    results
      .filter((offer) => offer.storeId === branch.brandId)
      .every((offer) => offer.distance === distanceKm(origin, branch)),
  )
  assert.ok(
    results
      .filter((offer) => offer.storeId === 'unknown-brand')
      .every((offer) => offer.distance === Infinity),
  )
})
