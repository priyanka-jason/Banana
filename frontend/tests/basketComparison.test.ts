import test from 'node:test'
import assert from 'node:assert/strict'
import { compareBasket } from '../src/lib/basketComparison.ts'
import { productRequest, samePackage } from '../src/lib/basketIdentity.ts'
import {
  addToList,
  reconcileList,
  type ListItem,
} from '../src/lib/shoppingList.ts'
import type { NearbyOffer, ProductSpec, Store } from '../src/types.ts'

const stores: Store[] = ['a', 'b', 'c'].map((id) => ({
  id,
  name: `Store ${id.toUpperCase()}`,
  logo: '',
  website: '',
}))
function milk(
  storeId: string,
  size: number,
  price: number,
  extra: Partial<ProductSpec> = {},
  id = `${storeId}:milk-${size}`,
): NearbyOffer {
  return {
    id,
    name: '2% Milk',
    pack: `${size / 1000} L`,
    price,
    category: 'dairy-eggs',
    image: '',
    unitPrice: '',
    storeId,
    store: stores.find((s) => s.id === storeId)!,
    distance: 1,
    distances: { 'mount-pleasant': 1, kitsilano: 1, downtown: 1 },
    spec: {
      sku: `milk-${size}`,
      comparisonGroupId: 'milk-2-percent-brand-a',
      packCount: 1,
      sizeKind: 'volume',
      totalBase: size,
      pricedByWeight: false,
      ...extra,
    },
  }
}
function requested(offer: NearbyOffer, quantity = 1): ListItem[] {
  return [{ ...addToList([], offer)[0], quantity }]
}
test('cross-chain identical packages combine quantities; unrelated real SKUs never match by name alone', () => {
  const a = milk('a', 2000, 4),
    b = milk('b', 2000, 3)
  const list = addToList(addToList([], a), b)
  assert.equal(list.length, 1)
  assert.equal(list[0].quantity, 2)
  const unknownA = { ...a, spec: { sku: 'local-a' } },
    unknownB = { ...b, spec: { sku: 'local-b' } }
  assert.equal(addToList(addToList([], unknownA), unknownB).length, 2)
})
test('exact baskets retain two 2 L packs while cheaper 4 L same-chain and cross-chain options stay separate', () => {
  const a2 = milk('a', 2000, 4),
    a4 = milk('a', 4000, 5),
    b2 = milk('b', 2000, 3.5),
    b4 = milk('b', 4000, 4)
  const comparison = compareBasket(requested(a2, 2), [a2, a4, b2, b4], stores)
  assert.deepEqual(
    comparison.exact.map((p) => [p.name, p.totalCents]),
    [
      ['Store B', 700],
      ['Store A', 800],
    ],
  )
  assert.deepEqual(
    comparison.alternatives.map((p) => [p.name, p.totalCents]),
    [
      ['Store B', 400],
      ['Store A', 500],
    ],
  )
  assert.ok(
    comparison.exact.every(
      (p) => p.picks[0].units === 2 && p.picks[0].change === 'exact',
    ),
  )
  assert.ok(
    comparison.alternatives.every(
      (p) => p.picks[0].units === 1 && p.picks[0].change === 'packaging',
    ),
  )
  assert.equal(comparison.requested.totalCents, 800)
})
test('whole packs and surplus quantity are explicit; alternatives never under-supply', () => {
  const a2 = milk('a', 2000, 4),
    b3 = milk('b', 3000, 2)
  const result = compareBasket(requested(a2, 2), [a2, b3], stores)
  const pick = result.alternatives[0].picks[0]
  assert.equal(pick.units, 2)
  assert.equal(pick.suppliedBase, 6000)
  assert.equal(pick.extraBase, 2000)
  assert.equal(pick.change, 'quantity')
  assert.equal(pick.lineCents, 400)
  assert.equal(result.exact.length, 1)
})
test('same total amount in different multipacks is not an exact package', () => {
  const two = milk('a', 4000, 6, { packCount: 2 }),
    one = milk('b', 4000, 4)
  assert.equal(samePackage(productRequest(two), productRequest(one)), false)
  const result = compareBasket(requested(two), [two, one], stores)
  assert.equal(result.exact.length, 1)
  assert.equal(result.alternatives.length, 1)
})
test('other variants and incompatible units do not become substitutions', () => {
  const wanted = milk('a', 2000, 4)
  const wrong = milk('b', 2000, 1, {
    comparisonGroupId: 'milk-1-percent-brand-a',
  })
  const count = milk('c', 2, 1, { sizeKind: 'count' })
  const result = compareBasket(
    requested(wanted),
    [wanted, wrong, count],
    stores,
  )
  assert.equal(result.exact.length, 1)
  assert.equal(result.alternatives.length, 0)
})
test('incomplete low subtotals never compete with complete baskets', () => {
  const aMilk = milk('a', 2000, 4),
    bMilk = milk('b', 2000, 1)
  const eggs = {
    ...milk('a', 12, 5, { comparisonGroupId: 'large-eggs', sizeKind: 'count' }),
    name: 'Large eggs',
    pack: '12 ct',
  }
  const list = [...requested(aMilk), ...requested(eggs)]
  const result = compareBasket(list, [aMilk, bMilk, eggs], stores)
  assert.equal(result.exact.length, 1)
  assert.equal(result.exact[0].totalCents, 900)
  const incomplete = result.incomplete.find((p) => p.name === 'Store B')!
  assert.equal(incomplete.totalCents, 100)
  assert.equal(incomplete.complete, false)
  assert.equal(incomplete.missing[0].name, 'Large eggs')
})
test('mixed-store additions consolidate exact packages at the preferred chain when possible', () => {
  const aMilk = milk('a', 2000, 4)
  const bEggs = {
    ...milk('b', 12, 5, { comparisonGroupId: 'eggs', sizeKind: 'count' }),
    name: 'Eggs',
    pack: '12 ct',
  }
  const aEggs = {
    ...bEggs,
    id: 'a:eggs',
    storeId: 'a',
    store: stores[0],
    price: 6,
  }
  const result = compareBasket(
    [...requested(aMilk), ...requested(bEggs)],
    [aMilk, bEggs, aEggs],
    stores,
  )
  assert.deepEqual(
    result.requested.picks.map((p) => p.store.id),
    ['a', 'a'],
  )
  assert.equal(result.requested.totalCents, 1000)
})
test('when a chain lacks an item, split-store exact basket names both stores', () => {
  const a = milk('a', 2000, 4)
  const b = {
    ...milk('b', 12, 5, { comparisonGroupId: 'eggs', sizeKind: 'count' }),
    name: 'Eggs',
  }
  const result = compareBasket(
    [...requested(a), ...requested(b)],
    [a, b],
    stores,
  )
  assert.equal(result.exact.length, 0)
  assert.equal(result.split?.totalCents, 900)
  assert.deepEqual(
    result.split?.picks.map((p) => p.store.id),
    ['a', 'b'],
  )
})
test('missing live prices do not fall back to historical saved prices', () => {
  const a = milk('a', 2000, 99)
  const result = compareBasket(requested(a), [], stores)
  assert.equal(result.requested.complete, false)
  assert.equal(result.requested.totalCents, 0)
  assert.equal(result.exact.length, 0)
  assert.equal(result.alternatives.length, 0)
})
test('demo SKU families preserve milk variants and distinguish size while real names alone stay unverified', () => {
  const a = milk('a', 4000, 8, {
    sku: 'sim-milk-2-4l',
    comparisonGroupId: undefined,
  })
  const b = milk('b', 2000, 2, {
    sku: 'sim-milk-2-2l',
    comparisonGroupId: undefined,
  })
  const wrong = {
    ...b,
    id: 'b:milk-1',
    name: '1% Milk',
    spec: { ...b.spec!, sku: 'sim-milk-1-2l' },
  }
  const result = compareBasket(requested(a), [a, b, wrong], stores)
  assert.equal(result.alternatives.length, 1)
  assert.equal(result.alternatives[0].picks[0].offer.id, b.id)
  assert.equal(result.alternatives[0].picks[0].units, 2)
})
test('alternative selection IDs change when the actual purchase changes', () => {
  const a = milk('a', 2000, 4),
    b = milk('b', 4000, 4),
    c = milk('b', 3000, 1)
  const first = compareBasket(requested(a, 2), [a, b], stores).alternatives[0]
  const next = compareBasket(requested(a, 2), [a, c], stores).alternatives[0]
  assert.notEqual(first.id, next.id)
})
test('reconciliation merges legacy cross-chain duplicates without losing requested quantities', () => {
  const a = milk('a', 2000, 4),
    b = milk('b', 2000, 3)
  const old = [
    { ...requested(a, 2)[0], spec: undefined },
    { ...requested(b, 3)[0], spec: undefined },
  ]
  const next = reconcileList(old, [a, b])
  assert.equal(next.length, 1)
  assert.equal(next[0].quantity, 5)
})
test('changed reference packaging does not silently alter a saved request', () => {
  const old = milk('a', 2000, 4),
    updated = { ...old, pack: '4 L', spec: { ...old.spec!, totalBase: 4000 } }
  const list = reconcileList(requested(old), [updated])
  assert.equal(list[0].spec?.totalBase, 2000)
  const result = compareBasket(list, [updated], stores)
  assert.equal(result.exact.length, 0)
  assert.equal(result.alternatives[0].picks[0].extraBase, 2000)
})
test('whole-basket arithmetic uses cents and deterministic ties', () => {
  const a = milk('a', 2000, 0.1),
    b = milk('b', 2000, 0.1)
  const result = compareBasket(requested(a, 3), [b, a], stores)
  assert.equal(result.exact[0].totalCents, 30)
  assert.equal(result.exact[1].totalCents, 30)
  assert.equal(result.exact[0].name, 'Store A')
})

test('ranks the entire multi-item basket, not the store with one cheap item', () => {
  const a = milk('a', 2000, 1),
    b = milk('b', 2000, 4)
  const eggsA = {
    ...milk('a', 12, 10, { comparisonGroupId: 'eggs', sizeKind: 'count' }),
    id: 'a:eggs',
    name: 'Eggs',
  }
  const eggsB = {
    ...eggsA,
    id: 'b:eggs',
    storeId: 'b',
    store: stores[1],
    price: 2,
  }
  const result = compareBasket(
    [...requested(a), ...requested(eggsA)],
    [a, b, eggsA, eggsB],
    stores,
  )
  assert.deepEqual(
    result.exact.map((plan) => [plan.name, plan.totalCents]),
    [
      ['Store B', 600],
      ['Store A', 1100],
    ],
  )
})
test('weighted alternatives preserve the physical amount without buying fractional fixed packs', () => {
  const pound = milk('a', 453.59237, 1.99, {
    comparisonGroupId: 'bananas',
    sizeKind: 'weight',
    pricedByWeight: true,
  })
  const kilo = milk('b', 1000, 3.49, {
    comparisonGroupId: 'bananas',
    sizeKind: 'weight',
    pricedByWeight: true,
  })
  const result = compareBasket(requested(pound, 2), [pound, kilo], stores)
  const pick = result.alternatives[0].picks[0]
  assert.equal(pick.lineCents, 317)
  assert.ok(Math.abs(pick.suppliedBase! - 907.18474) < 0.000001)
  assert.equal(pick.extraBase, 0)
})
test('new canonical identities enrich old demo baskets without changing their requested package', () => {
  const old = milk('a', 2000, 4, {
    comparisonGroupId: undefined,
    sku: 'sim-milk-2-2l',
  })
  const fresh = {
    ...old,
    spec: { ...old.spec!, comparisonGroupId: 'canonical-milk' },
  }
  const other = milk('b', 2000, 3, { comparisonGroupId: 'canonical-milk' })
  const migrated = reconcileList(requested(old), [fresh, other])
  assert.equal(migrated[0].spec?.comparisonGroupId, 'canonical-milk')
  assert.equal(compareBasket(migrated, [fresh, other], stores).exact.length, 2)
})
