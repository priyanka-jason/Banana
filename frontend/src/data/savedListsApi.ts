import { supabase } from '../lib/supabaseClient'
import {
  fromSavedListRow,
  toSavedItems,
  type SavedList,
  type SavedListRow,
} from '../lib/savedLists'
import type { ListItem } from '../lib/shoppingList'

// Saved lists live in the "banana" schema. Row level security lets a signed-in
// person read and change only their own lists; signed-out visitors get nothing.
const db = () => supabase.schema('banana')

export async function fetchSavedLists(): Promise<SavedList[]> {
  const { data, error } = await db()
    .from('shopping_lists')
    .select(
      'id,name,updated_at,shopping_list_items(position,item_id,quantity,snapshot)',
    )
    .order('updated_at', { ascending: false })
  if (error) throw new Error('Your saved lists could not be loaded.')
  return (data as SavedListRow[]).map(fromSavedListRow)
}

/** Saves a new list (id null) or replaces an existing one. Returns its id. */
export async function saveList(
  id: string | null,
  name: string,
  items: ListItem[],
): Promise<string> {
  const { data, error } = await db().rpc('save_shopping_list', {
    p_list_id: id,
    p_name: name,
    p_items: toSavedItems(items),
  })
  if (error)
    throw new Error(
      error.message.includes('20 saved lists')
        ? 'You can keep up to 20 saved lists. Delete one to save another.'
        : 'This list could not be saved. Try again.',
    )
  return data as string
}

export async function renameList(id: string, name: string): Promise<void> {
  const { error } = await db()
    .from('shopping_lists')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error('This list could not be renamed. Try again.')
}

export async function deleteList(id: string): Promise<void> {
  const { error } = await db().from('shopping_lists').delete().eq('id', id)
  if (error) throw new Error('This list could not be deleted. Try again.')
}
