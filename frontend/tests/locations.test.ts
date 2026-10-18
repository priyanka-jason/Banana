import { test } from 'node:test'
import assert from 'node:assert/strict'
import { branches, neighbourhoodOrigins } from '../src/data/storeLocations.ts'
import {
  branchOffers,
  distanceKm,
  loadSavedOrigin,
  nearbyBranches,
  radiusRing,
  saveOrigin,
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

class MockStorage implements Storage {
  private store = new Map<string, string>()
  get length() {
    return this.store.size
  }
  clear() {
    this.store.clear()
  }
  getItem(key: string) {
    return this.store.get(key) ?? null
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null
  }
  removeItem(key: string) {
    this.store.delete(key)
  }
  setItem(key: string, value: string) {
    this.store.set(key, value)
  }
}

test('origin persistence loads, saves, and clears search origin', () => {
  const mockStorage = new MockStorage()
  assert.equal(loadSavedOrigin(mockStorage), null)

  const customOrigin = {
    label: '123 Grandview Hwy, Vancouver, BC',
    latitude: 49.258,
    longitude: -123.056,
  }
  saveOrigin(customOrigin, mockStorage)
  assert.deepEqual(loadSavedOrigin(mockStorage), customOrigin)

  saveOrigin(null, mockStorage)
  assert.equal(loadSavedOrigin(mockStorage), null)
})

test('loadSavedOrigin handles invalid JSON or corrupted data gracefully', () => {
  const mockStorage = new MockStorage()
  mockStorage.setItem('banana_search_origin', 'invalid json')
  assert.equal(loadSavedOrigin(mockStorage), null)

  mockStorage.setItem('banana_search_origin', JSON.stringify({ label: 123 }))
  assert.equal(loadSavedOrigin(mockStorage), null)
})
