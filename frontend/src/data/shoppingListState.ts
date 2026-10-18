import { useSyncExternalStore } from 'react'
import {
  addToList,
  loadList,
  removeFromList,
  saveList,
  setQuantity,
  type ListItem,
} from '../lib/shoppingList.ts'
import type { NearbyOffer } from '../types.ts'

// One list shared by every page, kept in this browser so it survives new
// searches, page changes and reloads.
const storage = typeof localStorage === 'undefined' ? undefined : localStorage
let list: ListItem[] = loadList(storage)
const listeners = new Set<() => void>()

function update(next: ListItem[]) {
  list = next
  saveList(storage, list)
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const shoppingList = {
  add: (offer: NearbyOffer) => update(addToList(list, offer)),
  setQuantity: (offerId: string, quantity: number) =>
    update(setQuantity(list, offerId, quantity)),
  remove: (offerId: string) => update(removeFromList(list, offerId)),
  clear: () => update([]),
}

export function useShoppingList(): ListItem[] {
  return useSyncExternalStore(subscribe, () => list)
}
