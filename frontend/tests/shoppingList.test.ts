import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  STORAGE_KEY,
  addToList,
  groupByStore,
  itemCount,
  listTotal,
  loadList,
  removeFromList,
  saveList,
  setQuantity,
} from '../src/lib/shoppingList.ts'
import type { NearbyOffer } from '../src/types.ts'

const offer = (id: string, price: number, storeId = 'walmart') =>
  ({
    id,
    name: id,
    pack: '1 L',
    price,
    storeId,
    store: { id: storeId, name: storeId, logo: '', website: '' },
  }) as unknown as NearbyOffer

test('earlier items stay when new ones are added, repeats add one more', () => {
  let list = addToList([], offer('milk', 4.99))
  list = addToList(list, offer('eggs', 3.5))
  list = addToList(list, offer('milk', 4.99))
  assert.deepEqual(
    list.map((i) => [i.offerId, i.quantity]),
    [
      ['milk', 2],
      ['eggs', 1],
    ],
  )
  assert.equal(itemCount(list), 3)
})

test('quantity changes, caps at 99, and zero removes the item', () => {
  let list = addToList([], offer('milk', 1))
  assert.equal(setQuantity(list, 'milk', 500)[0].quantity, 99)
  assert.equal(setQuantity(list, 'milk', 0).length, 0)
  assert.equal(removeFromList(list, 'milk').length, 0)
})

test('totals use whole cents and group by store', () => {
  let list = addToList([], offer('a', 0.1))
  list = setQuantity(addToList(list, offer('b', 0.2)), 'b', 3)
  assert.equal(listTotal(list), 0.7)
  list = addToList(list, offer('c', 2, 'costco'))
  const groups = groupByStore(list)
  assert.deepEqual(
    groups.map((g) => [g.storeId, g.total]),
    [
      ['costco', 2],
      ['walmart', 0.7],
    ],
  )
})

test('saved list survives a reload, and bad saved data is ignored', () => {
  const data: Record<string, string> = {}
  const storage = {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v
    },
  }
  const list = addToList([], offer('milk', 4.99))
  saveList(storage, list)
  assert.deepEqual(loadList(storage), list)
  data[STORAGE_KEY] = '[{"offerId":1},{"nonsense":true}]'
  assert.deepEqual(loadList(storage), [])
  data[STORAGE_KEY] = 'not json'
  assert.deepEqual(loadList(storage), [])
  assert.deepEqual(loadList(undefined), [])
})
