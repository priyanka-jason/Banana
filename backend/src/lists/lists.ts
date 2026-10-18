import { randomUUID } from 'node:crypto';
import type { ShoppingListEntry } from '../types';

/**
 * Saved shopping lists for signed-in shoppers.
 *
 * A saved list holds the same entries POST /api/prices/list takes (a search like
 * "milk" or one exact item id, plus a quantity), so pricing a saved list is just
 * that endpoint with the saved entries. A list belongs to one person: every
 * method takes the owner's id, and someone else's list behaves as if it didn't exist.
 *
 * In the database these are banana.shopping_lists and banana.shopping_list_items
 * (backend/sql/accounts-setup.sql).
 */

/** At most this many lists per person. */
export const MAX_SAVED_LISTS = 50;
export const MAX_LIST_NAME_LENGTH = 100;

/** What the website sends to create or replace a list. */
export interface SavedListInput {
  name: string;
  /** In order. Can be empty (a new list with nothing on it yet). */
  items: ShoppingListEntry[];
}

export interface SavedList extends SavedListInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/** A list without its entries, for "My lists". */
export interface SavedListSummary {
  id: string;
  name: string;
  itemCount: number;
  updatedAt: string;
}

export interface ListRepository {
  /** The person's lists, most recently changed first. */
  listLists(userId: string): Promise<SavedListSummary[]>;
  getList(userId: string, listId: string): Promise<SavedList | undefined>;
  createList(userId: string, input: SavedListInput): Promise<SavedList>;
  /** Replaces the name and every entry. Undefined if the person has no such list. */
  replaceList(userId: string, listId: string, input: SavedListInput): Promise<SavedList | undefined>;
  /** False if the person has no such list. */
  deleteList(userId: string, listId: string): Promise<boolean>;
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Lists kept in memory, until the Supabase version exists. Everything is lost when the
 * server stops, so it is only for local work and tests.
 */
export class MemoryListRepository implements ListRepository {
  private readonly lists = new Map<string, { userId: string; list: SavedList }>();
  private readonly now: () => Date;

  constructor(options: { now?: () => Date } = {}) {
    this.now = options.now ?? (() => new Date());
  }

  private owned(userId: string, listId: string): SavedList | undefined {
    const entry = this.lists.get(listId);
    return entry !== undefined && entry.userId === userId ? entry.list : undefined;
  }

  async listLists(userId: string): Promise<SavedListSummary[]> {
    return [...this.lists.values()]
      .filter((entry) => entry.userId === userId)
      .map(({ list }) => ({ id: list.id, name: list.name, itemCount: list.items.length, updatedAt: list.updatedAt }))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.id.localeCompare(b.id)));
  }

  async getList(userId: string, listId: string): Promise<SavedList | undefined> {
    const list = this.owned(userId, listId);
    return list === undefined ? undefined : copy(list);
  }

  async createList(userId: string, input: SavedListInput): Promise<SavedList> {
    const time = this.now().toISOString();
    const list: SavedList = { id: randomUUID(), name: input.name, items: copy(input.items), createdAt: time, updatedAt: time };
    this.lists.set(list.id, { userId, list });
    return copy(list);
  }

  async replaceList(userId: string, listId: string, input: SavedListInput): Promise<SavedList | undefined> {
    const existing = this.owned(userId, listId);
    if (existing === undefined) return undefined;
    const list: SavedList = { ...existing, name: input.name, items: copy(input.items), updatedAt: this.now().toISOString() };
    this.lists.set(listId, { userId, list });
    return copy(list);
  }

  async deleteList(userId: string, listId: string): Promise<boolean> {
    if (this.owned(userId, listId) === undefined) return false;
    return this.lists.delete(listId);
  }
}
