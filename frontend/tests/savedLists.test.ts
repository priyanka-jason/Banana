import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_SAVED_ITEMS,
  cleanListName,
  fromSavedListRow,
  fromSavedRows,
  pricesAsOf,
  toSavedItems,
} from '../src/lib/savedLists.ts'
import type { ListItem } from '../src/lib/shoppingList.ts'
import type { Offer } from '../src/types.ts'

const milk: ListItem = {
  offerId: 'costco:sim-milk-2-4l',
  name: '2% Milk',
  pack: '2 x 4 L',
  storeId: 'costco',
  storeName: 'Costco',
  price: 7.49,
  quantity: 2,
  spec: { sku: 'sim-milk-2-4l', totalBase: 8000, sizeKind: 'volume' },
}
const eggs: ListItem = {
  offerId: 'walmart:sim-eggs',
  name: 'Large Eggs',
  pack: '12 ct',
  storeId: 'walmart',
  storeName: 'Walmart',
  price: 3.99,
  quantity: 1,
}

test('a list round-trips through what gets saved, in order', () => {
  const saved = toSavedItems([milk, eggs])
  assert.equal(saved[0].offerId, 'costco:sim-milk-2-4l')
  assert.equal(saved[0].quantity, 2)
  const rows = saved.map((item, position) => {
    const { offerId, quantity, ...snapshot } = item
    return { position, item_id: offerId, quantity, snapshot }
  })
  assert.deepEqual(fromSavedRows([rows[1], rows[0]]), [milk, eggs])
})

test('saves at most 50 items', () => {
  const many = Array.from({ length: 60 }, (_, index) => ({
    ...eggs,
    offerId: `walmart:item-${index}`,
  }))
  assert.equal(toSavedItems(many).length, MAX_SAVED_ITEMS)
})

test('broken saved rows are skipped instead of breaking My list', () => {
  const items = fromSavedRows([
    { position: 0, item_id: 'x', quantity: 1, snapshot: null },
    { position: 1, item_id: null, quantity: 1, snapshot: { name: 'No id' } },
    {
      position: 2,
      item_id: eggs.offerId,
      quantity: 1,
      snapshot: { ...eggs, price: 'free' },
    },
    {
      position: 3,
      item_id: eggs.offerId,
      quantity: 1,
      snapshot: {
        name: eggs.name,
        pack: eggs.pack,
        storeId: eggs.storeId,
        storeName: eggs.storeName,
        price: eggs.price,
      },
    },
  ])
  assert.deepEqual(items, [eggs])
})

test('a saved list row becomes a named list', () => {
  const list = fromSavedListRow({
    id: 'list-1',
    name: 'Weekly groceries',
    updated_at: '2026-10-17T20:00:00Z',
  })
  assert.deepEqual(list, {
    id: 'list-1',
    name: 'Weekly groceries',
    updatedAt: '2026-10-17T20:00:00Z',
    items: [],
  })
})

test('list names are trimmed and must be 1-100 characters', () => {
  assert.equal(cleanListName('  Weekly   groceries '), 'Weekly groceries')
  assert.equal(cleanListName('   '), '')
  assert.equal(cleanListName('x'.repeat(101)), '')
})

test('prices are as of the oldest catalogue update', () => {
  const offers = [
    { updatedAt: '2026-10-17T20:20:00Z' },
    { updatedAt: '2026-10-15T08:00:00Z' },
    { updatedAt: 'not a date' },
    {},
  ] as Offer[]
  assert.equal(pricesAsOf(offers), '2026-10-15T08:00:00Z')
  assert.equal(pricesAsOf([]), undefined)
})
