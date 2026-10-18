import { useSyncExternalStore } from 'react'
import {
  addToList,
  loadList,
  removeFromList,
  reconcileList,
  saveList,
  setQuantity,
  type ListItem,
} from '../lib/shoppingList.ts'
import type { NearbyOffer, Offer } from '../types.ts'

// One list shared by every page, kept in this browser so it survives new
// searches, page changes and reloads.
const storage = typeof localStorage === 'undefined' ? undefined : localStorage
let list: ListItem[] = loadList(storage)
const listeners = new Set<() => void>()
const CHOICE_KEY = 'banana.basketChoice.v1'
let choice: string | null = null
try {
  choice = storage?.getItem(CHOICE_KEY) ?? null
} catch {
  /* Storage is optional. */
}
function choose(id: string | null) {
  choice = id
  try {
    if (id) storage?.setItem(CHOICE_KEY, id)
    else storage?.removeItem(CHOICE_KEY)
  } catch {
    /* Keep selection for this visit. */
  }
  listeners.forEach((listener) => listener())
}

function update(next: ListItem[]) {
  list = next
  if (!next.length) choose(null)
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
  add: (offer: NearbyOffer, offers: Offer[] = []) =>
    update(addToList(reconcileList(list, offers), offer)),
  reconcile: (offers: Offer[]) => {
    const next = reconcileList(list, offers)
    if (JSON.stringify(next) !== JSON.stringify(list)) update(next)
  },
  choose,
  setQuantity: (offerId: string, quantity: number) =>
    update(setQuantity(list, offerId, quantity)),
  remove: (offerId: string) => update(removeFromList(list, offerId)),
  clear: () => update([]),
}

export function useShoppingList(): ListItem[] {
  return useSyncExternalStore(subscribe, () => list)
}

export function useBasketChoice(): string | null {
  return useSyncExternalStore(subscribe, () => choice)
}
