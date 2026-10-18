import { isListItem, MAX_QUANTITY, type ListItem } from './shoppingList.ts'
import type { Offer } from '../types.ts'

// Matches backend/sql/migrations/005_saved_lists.sql and accounts-setup.sql.
export const MAX_SAVED_LISTS = 20
export const MAX_SAVED_ITEMS = 50
export const MAX_LIST_NAME = 100

export interface SavedItemRow {
  position: number
  item_id: string | null
  quantity: number
  snapshot: unknown
}

export interface SavedListRow {
  id: string
  name: string
  updated_at: string
  shopping_list_items?: SavedItemRow[]
}

export interface SavedList {
  id: string
  name: string
  updatedAt: string
  items: ListItem[]
}

/** A list name as it will be saved, or '' when it can't be. */
export function cleanListName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  return trimmed.length <= MAX_LIST_NAME ? trimmed : ''
}

/** What gets saved for each item: the product as the shopper chose it, and how many. */
export function toSavedItems(list: ListItem[]) {
  return list.slice(0, MAX_SAVED_ITEMS).map((item) => ({
    offerId: item.offerId,
    quantity: item.quantity,
    name: item.name,
    pack: item.pack,
    storeId: item.storeId,
    storeName: item.storeName,
    price: item.price,
    ...(item.spec ? { spec: item.spec } : {}),
  }))
}

/** Saved rows back into My list items, in their saved order. Anything malformed is skipped. */
export function fromSavedRows(rows: SavedItemRow[] = []): ListItem[] {
  return [...rows]
    .sort((a, b) => a.position - b.position)
    .flatMap((row) => {
      const snapshot =
        row.snapshot && typeof row.snapshot === 'object' ? row.snapshot : {}
      const item = {
        ...snapshot,
        offerId: row.item_id ?? '',
        quantity: Math.min(MAX_QUANTITY, row.quantity),
      }
      return isListItem(item) ? [item] : []
    })
}

export function fromSavedListRow(row: SavedListRow): SavedList {
  return {
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
    items: fromSavedRows(row.shopping_list_items),
  }
}

/**
 * When the prices a loaded list shows were last refreshed: the oldest update time
 * in the catalogue (the same one the "Updated" note at the bottom of each page shows).
 * Free plans refresh every 3-4 days and Premium every day; until Premium status is
 * recorded, everyone sees the same latest prices.
 */
export function pricesAsOf(offers: Offer[]): string | undefined {
  return offers
    .map((offer) => offer.updatedAt)
    .filter(
      (date): date is string =>
        Boolean(date) && Number.isFinite(Date.parse(date!)),
    )
    .sort()[0]
}

export function formatPricesDate(date: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Vancouver',
  }).format(new Date(date))
}
