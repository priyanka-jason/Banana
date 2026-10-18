import type { NearbyOffer } from '../types.ts'

export interface ListItem {
  offerId: string
  name: string
  pack: string
  storeId: string
  storeName: string
  price: number
  quantity: number
}

export const MAX_QUANTITY = 99
export const STORAGE_KEY = 'banana.shoppingList.v1'

export function addToList(list: ListItem[], offer: NearbyOffer): ListItem[] {
  const existing = list.find((item) => item.offerId === offer.id)
  if (existing) return setQuantity(list, offer.id, existing.quantity + 1)
  return [
    ...list,
    {
      offerId: offer.id,
      name: offer.name,
      pack: offer.pack,
      storeId: offer.storeId,
      storeName: offer.store.name,
      price: offer.price,
      quantity: 1,
    },
  ]
}

export function setQuantity(
  list: ListItem[],
  offerId: string,
  quantity: number,
): ListItem[] {
  if (!Number.isFinite(quantity) || quantity < 1)
    return removeFromList(list, offerId)
  const next = Math.min(MAX_QUANTITY, Math.floor(quantity))
  return list.map((item) =>
    item.offerId === offerId ? { ...item, quantity: next } : item,
  )
}

export function removeFromList(list: ListItem[], offerId: string): ListItem[] {
  return list.filter((item) => item.offerId !== offerId)
}

export function itemCount(list: ListItem[]): number {
  return list.reduce((sum, item) => sum + item.quantity, 0)
}

// Prices are dollars with cents, so total in whole cents to avoid float drift.
export function listTotal(list: ListItem[]): number {
  return (
    list.reduce(
      (sum, item) => sum + Math.round(item.price * 100) * item.quantity,
      0,
    ) / 100
  )
}

export interface StoreGroup {
  storeId: string
  storeName: string
  items: ListItem[]
  total: number
}

export function groupByStore(list: ListItem[]): StoreGroup[] {
  const groups = new Map<string, StoreGroup>()
  for (const item of list) {
    const group = groups.get(item.storeId) ?? {
      storeId: item.storeId,
      storeName: item.storeName,
      items: [],
      total: 0,
    }
    group.items.push(item)
    groups.set(item.storeId, group)
  }
  return [...groups.values()]
    .map((group) => ({ ...group, total: listTotal(group.items) }))
    .sort((a, b) => a.storeName.localeCompare(b.storeName))
}

function isListItem(value: unknown): value is ListItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (
    typeof item.offerId === 'string' &&
    typeof item.name === 'string' &&
    typeof item.pack === 'string' &&
    typeof item.storeId === 'string' &&
    typeof item.storeName === 'string' &&
    typeof item.price === 'number' &&
    Number.isFinite(item.price) &&
    typeof item.quantity === 'number' &&
    Number.isInteger(item.quantity) &&
    item.quantity >= 1 &&
    item.quantity <= MAX_QUANTITY
  )
}

export function loadList(
  storage: Pick<Storage, 'getItem'> | undefined,
): ListItem[] {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isListItem) : []
  } catch {
    return []
  }
}

export function saveList(
  storage: Pick<Storage, 'setItem'> | undefined,
  list: ListItem[],
) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // Private mode or a full disk: the list still works for this visit.
  }
}
