import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  filterOffers,
  getNearbyOffers,
  isDiscounted,
  readFilters,
} from '../src/lib/catalogue.ts'

function search(query = '') {
  const filters = readFilters(new URLSearchParams(query))
  return filterOffers(getNearbyOffers(filters), filters)
}

test('search compares the same grocery at multiple stores and keeps regular prices', () => {
  const results = search('q=milk')
  assert.equal(results.length, 3)
  assert.deepEqual(
    results.map((offer) => offer.storeId),
    ['superstore', 'costco', 'save-on-foods'],
  )
  assert.equal(results[0].price, 4.49)
  assert.equal(isDiscounted(results[2]), false)
  assert.equal(search('q=milk&sale=1').length, 2)
})

test('category, store, discount and distance filters combine', () => {
  const results = search('category=Produce&store=no-frills&sale=1&radius=3')
  assert.deepEqual(
    results.map((offer) => offer.id),
    ['avocados-nofrills'],
  )
  assert.equal(
    search('category=Produce&store=no-frills&sale=1&radius=1').length,
    0,
  )
})

test('neighbourhood selection changes which stores are within the radius', () => {
  assert.equal(search('radius=1').length, 3)
  assert.equal(search('area=downtown&radius=1').length, 0)
  const kitsilano = search('area=kitsilano&radius=1')
  assert.equal(kitsilano.length, 3)
  assert.ok(
    kitsilano.every(
      (offer) => offer.storeId === 'no-frills' && offer.distance === 0.6,
    ),
  )
})

test('sorting compares numeric prices, percentage discounts and distances', () => {
  assert.equal(search('sort=price-desc')[0].price, 6.99)
  assert.equal(search('sort=price')[0].price, 3.49)
  assert.equal(search('sort=discount')[0].id, 'avocados-nofrills')
  const nearest = search('sort=distance')
  assert.ok(
    nearest.every(
      (offer, index) =>
        index === 0 || nearest[index - 1].distance <= offer.distance,
    ),
  )
})

test('search handles case, spaces, unknown URL values and no matches', () => {
  assert.equal(search('q=%20APPLES%20').length, 2)
  assert.equal(search('q=not-a-grocery').length, 0)
  const filters = readFilters(
    new URLSearchParams(
      'radius=-10&area=unknown&sort=unknown&category=unknown&store=unknown',
    ),
  )
  assert.equal(filters.radius, 5)
  assert.equal(filters.area, 'mount-pleasant')
  assert.equal(filters.sort, 'recommended')
  assert.equal(filters.category, 'all')
  assert.equal(filters.store, 'all')
})
