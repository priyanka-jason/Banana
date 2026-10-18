import type pg from 'pg';
import type { ShoppingListEntry } from '../types';
import type { ListRepository, SavedList, SavedListInput, SavedListSummary } from './lists';

/**
 * Saved lists in Postgres: banana.shopping_lists and banana.shopping_list_items
 * (sql/accounts-setup.sql).
 *
 * The backend connects as the database owner, which row level security does not apply to.
 * So every query here filters by the signed-in person's id itself: a list only counts as
 * found when both its id and its owner match. The tests check that someone else's list
 * can't be read, changed or deleted.
 */

const ISO_TIME = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

interface ItemRow {
  query: string | null;
  item_id: string | null;
  categories: string[];
  quantity: number;
}

function toEntry(row: ItemRow): ShoppingListEntry {
  if (row.item_id !== null) return { itemId: row.item_id, quantity: row.quantity };
  return {
    query: row.query ?? '',
    ...(row.categories.length > 0 ? { categories: row.categories as NonNullable<Extract<ShoppingListEntry, { query: string }>['categories']> } : {}),
    quantity: row.quantity,
  };
}

function itemsJson(items: ShoppingListEntry[]): string {
  return JSON.stringify(
    items.map((entry, position) =>
      'itemId' in entry
        ? { position, query: null, item_id: entry.itemId, categories: [], quantity: entry.quantity ?? 1 }
        : { position, query: entry.query, item_id: null, categories: entry.categories ?? [], quantity: entry.quantity ?? 1 },
    ),
  );
}

const INSERT_ITEMS = `
  insert into banana.shopping_list_items (list_id, position, query, item_id, categories, quantity)
  select $1, position, query, item_id, array(select jsonb_array_elements_text(categories)), quantity
  from jsonb_to_recordset($2::jsonb) as x(position integer, query text, item_id text, categories jsonb, quantity integer)`;

export class PostgresListRepository implements ListRepository {
  constructor(private readonly pool: pg.Pool) {}

  async listLists(userId: string): Promise<SavedListSummary[]> {
    const result = await this.pool.query<{ id: string; name: string; item_count: string; updated_at: string }>(
      `select l.id, l.name, count(i.id) as item_count, ${ISO_TIME('l.updated_at')} as updated_at
       from banana.shopping_lists l
       left join banana.shopping_list_items i on i.list_id = l.id
       where l.user_id = $1
       group by l.id
       order by l.updated_at desc, l.id`,
      [userId],
    );
    return result.rows.map((row) => ({ id: row.id, name: row.name, itemCount: Number(row.item_count), updatedAt: row.updated_at }));
  }

  async getList(userId: string, listId: string): Promise<SavedList | undefined> {
    return this.read(this.pool, userId, listId);
  }

  private async read(client: pg.Pool | pg.PoolClient, userId: string, listId: string): Promise<SavedList | undefined> {
    const list = await client.query<{ id: string; name: string; created_at: string; updated_at: string }>(
      `select id, name, ${ISO_TIME('created_at')} as created_at, ${ISO_TIME('updated_at')} as updated_at
       from banana.shopping_lists where id = $1 and user_id = $2`,
      [listId, userId],
    );
    const row = list.rows[0];
    if (row === undefined) return undefined;
    const items = await client.query<ItemRow>(
      'select query, item_id, categories, quantity from banana.shopping_list_items where list_id = $1 order by position',
      [listId],
    );
    return { id: row.id, name: row.name, items: items.rows.map(toEntry), createdAt: row.created_at, updatedAt: row.updated_at };
  }

  private async inTransaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await work(client);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async createList(userId: string, input: SavedListInput): Promise<SavedList> {
    return this.inTransaction(async (client) => {
      const created = await client.query<{ id: string }>(
        'insert into banana.shopping_lists (user_id, name) values ($1, $2) returning id',
        [userId, input.name],
      );
      const id = created.rows[0]?.id;
      if (id === undefined) throw new Error('Creating the list returned no id');
      if (input.items.length > 0) await client.query(INSERT_ITEMS, [id, itemsJson(input.items)]);
      const list = await this.read(client, userId, id);
      if (list === undefined) throw new Error('The new list could not be read back');
      return list;
    });
  }

  async replaceList(userId: string, listId: string, input: SavedListInput): Promise<SavedList | undefined> {
    return this.inTransaction(async (client) => {
      const updated = await client.query(
        'update banana.shopping_lists set name = $3, updated_at = now() where id = $1 and user_id = $2',
        [listId, userId, input.name],
      );
      if (updated.rowCount === 0) return undefined;
      await client.query('delete from banana.shopping_list_items where list_id = $1', [listId]);
      if (input.items.length > 0) await client.query(INSERT_ITEMS, [listId, itemsJson(input.items)]);
      return this.read(client, userId, listId);
    });
  }

  async deleteList(userId: string, listId: string): Promise<boolean> {
    const deleted = await this.pool.query('delete from banana.shopping_lists where id = $1 and user_id = $2', [listId, userId]);
    return (deleted.rowCount ?? 0) > 0;
  }
}
