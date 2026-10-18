import type { SignedInUser } from '../auth/tokens';
import type { PriceRepository } from '../db/repository';
import { MAX_SAVED_LISTS, type ListRepository, type SavedList } from '../lists/lists';
import { guarded, invalid, type HandlerOptions } from './handlers';
import type { ApiResult, DeletedResponseBody, ListsResponseBody, ShoppingListResponseBody } from './types';
import { parseSavedListBody, parseSavedListPriceBody } from './validate';

/**
 * The saved-list endpoints. Like handlers.ts they know nothing about HTTP. Every one takes
 * the signed-in user, which the server only passes after checking the login token, and only
 * ever touches that user's lists. Someone else's list gets the same 404 as a list that
 * doesn't exist, so ids can't be probed.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound(): ApiResult<never> {
  return { status: 404, body: { error: { code: 'not_found', message: 'There is no such list.' } } };
}

/** GET /api/lists */
export async function handleListLists(
  lists: ListRepository,
  user: SignedInUser,
  options: HandlerOptions = {},
): Promise<ApiResult<ListsResponseBody>> {
  return guarded(options, async () => ({ status: 200, body: { lists: await lists.listLists(user.id) } }));
}

/** GET /api/lists/{id} */
export async function handleGetList(
  lists: ListRepository,
  user: SignedInUser,
  listId: string,
  options: HandlerOptions = {},
): Promise<ApiResult<SavedList>> {
  if (!UUID.test(listId)) return notFound();
  return guarded<SavedList>(options, async () => {
    const list = await lists.getList(user.id, listId.toLowerCase());
    return list === undefined ? notFound() : { status: 200, body: list };
  });
}

/** POST /api/lists */
export async function handleCreateList(
  lists: ListRepository,
  user: SignedInUser,
  body: unknown,
  options: HandlerOptions = {},
): Promise<ApiResult<SavedList>> {
  const parsed = parseSavedListBody(body);
  if (!parsed.ok) return invalid(parsed.errors);
  return guarded<SavedList>(options, async () => {
    if ((await lists.listLists(user.id)).length >= MAX_SAVED_LISTS) {
      return invalid([{ field: '(body)', message: `you can have at most ${MAX_SAVED_LISTS} lists; delete one first` }]);
    }
    return { status: 201, body: await lists.createList(user.id, parsed.value) };
  });
}

/** PUT /api/lists/{id}: replaces the name and every entry. */
export async function handleReplaceList(
  lists: ListRepository,
  user: SignedInUser,
  listId: string,
  body: unknown,
  options: HandlerOptions = {},
): Promise<ApiResult<SavedList>> {
  const parsed = parseSavedListBody(body);
  if (!parsed.ok) return invalid(parsed.errors);
  if (!UUID.test(listId)) return notFound();
  return guarded<SavedList>(options, async () => {
    const list = await lists.replaceList(user.id, listId.toLowerCase(), parsed.value);
    return list === undefined ? notFound() : { status: 200, body: list };
  });
}

/** DELETE /api/lists/{id} */
export async function handleDeleteList(
  lists: ListRepository,
  user: SignedInUser,
  listId: string,
  options: HandlerOptions = {},
): Promise<ApiResult<DeletedResponseBody>> {
  if (!UUID.test(listId)) return notFound();
  return guarded<DeletedResponseBody>(options, async () =>
    (await lists.deleteList(user.id, listId.toLowerCase())) ? { status: 200, body: { deleted: true } } : notFound(),
  );
}

/**
 * POST /api/lists/{id}/prices: what the saved list costs, the same answer as POST /api/prices/list.
 * The body says where to shop (chains, picked stores or a radius). A location in it is used for
 * this answer only and is never saved with the list.
 */
export async function handlePriceSavedList(
  prices: PriceRepository,
  lists: ListRepository,
  user: SignedInUser,
  listId: string,
  body: unknown,
  options: HandlerOptions = {},
): Promise<ApiResult<ShoppingListResponseBody>> {
  if (!UUID.test(listId)) return notFound();
  return guarded<ShoppingListResponseBody>(options, async () => {
    const list = await lists.getList(user.id, listId.toLowerCase());
    if (list === undefined) return notFound();
    if (list.items.length === 0) {
      return invalid([{ field: '(list)', message: 'the list has no entries yet; add some before pricing it' }]);
    }
    const parsed = parseSavedListPriceBody(body, list.items);
    if (!parsed.ok) return invalid(parsed.errors);
    return { status: 200, body: await prices.priceShoppingList(parsed.value) };
  });
}
