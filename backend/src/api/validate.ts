import { PRODUCT_CATEGORIES, isProductCategory } from '../categories';
import { MAX_LIMIT } from '../search/search';
import { MAX_LIST_ITEMS, MAX_MATCHES_PER_ITEM, MAX_QUANTITY } from '../search/shoppingList';
import type {
  MemberPricing,
  PriceFilters,
  PriceSort,
  ShoppingListEntry,
  ShoppingListRequest,
  SortOrder,
} from '../types';
import { MAX_LIST_NAME_LENGTH, type SavedListInput } from '../lists/lists';
import type { ApiErrorDetail } from './types';

/**
 * Checks what the website sends. Request bodies are untrusted JSON, so every
 * field is checked, every problem is reported at once, and unknown fields are
 * rejected so a typo like "chain" instead of "chainSlugs" is caught, not ignored.
 */

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: ApiErrorDetail[] };

export const MAX_QUERY_LENGTH = 100;
export const MAX_LIST_ENTRIES = 50;
export const MAX_LOOKUP_IDS = 100;
export const MAX_ID_LENGTH = 200;
/** The furthest a shopper can search for stores, in km. Matches the website's 1 to 10 km slider. */
export const MAX_RADIUS_KM = 10;

const SEARCH_FIELDS = [
  'query',
  'chainSlugs',
  'parentCompanies',
  'locationIds',
  'near',
  'onSaleOnly',
  'memberPricing',
  'categories',
  'sortBy',
  'sortOrder',
  'limit',
  'offset',
] as const;
const SORTS: readonly PriceSort[] = ['price', 'unitPrice', 'name', 'distance', 'discount'];
const SORT_ORDERS: readonly SortOrder[] = ['asc', 'desc'];
const MEMBER_PRICINGS: readonly MemberPricing[] = ['member', 'non-member'];

type Errors = ApiErrorDetail[];

function finish<T>(errors: Errors, value: T): ParseResult<T> {
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}

/** A missing body counts as an empty one. Anything else must be a plain JSON object. */
function asObject(body: unknown, errors: Errors): Record<string, unknown> | undefined {
  if (body === undefined || body === null) return {};
  if (typeof body !== 'object' || Array.isArray(body)) {
    errors.push({ field: '(body)', message: 'must be a JSON object' });
    return undefined;
  }
  return body as Record<string, unknown>;
}

function rejectUnknownFields(obj: Record<string, unknown>, allowed: readonly string[], errors: Errors, prefix = ''): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      errors.push({ field: `${prefix}${key}`, message: `is not a known field (known fields: ${allowed.join(', ')})` });
    }
  }
}

function readTextList(
  obj: Record<string, unknown>,
  key: string,
  errors: Errors,
  max: number,
  maxLength = MAX_ID_LENGTH,
  field = key,
): string[] | undefined {
  const value = obj[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.trim() === '')) {
    errors.push({ field, message: 'must be a list of non-empty text' });
    return undefined;
  }
  if (value.length > max) {
    errors.push({ field, message: `can have at most ${max} entries` });
    return undefined;
  }
  if (value.some((entry: string) => entry.length > maxLength)) {
    errors.push({ field, message: `entries can be at most ${maxLength} characters` });
    return undefined;
  }
  return (value as string[]).map((entry) => entry.trim());
}

function readNumber(
  obj: Record<string, unknown>,
  key: string,
  field: string,
  errors: Errors,
  rule: { min: number; max: number; integer?: boolean; minExclusive?: boolean },
): number | undefined {
  const value = obj[key];
  if (value === undefined) return undefined;
  const range = `${rule.minExclusive ? 'more than' : 'at least'} ${rule.min} and at most ${rule.max}`;
  if (typeof value !== 'number' || !Number.isFinite(value) || (rule.integer === true && !Number.isInteger(value))) {
    errors.push({ field, message: rule.integer === true ? 'must be a whole number' : 'must be a number' });
    return undefined;
  }
  if (value > rule.max || value < rule.min || (rule.minExclusive === true && value === rule.min)) {
    errors.push({ field, message: `must be ${range}` });
    return undefined;
  }
  return value;
}

function readMemberPricing(obj: Record<string, unknown>, key: string, errors: Errors): MemberPricing | undefined {
  const value = obj[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !MEMBER_PRICINGS.includes(value as MemberPricing)) {
    errors.push({ field: key, message: `must be one of: ${MEMBER_PRICINGS.join(', ')}` });
    return undefined;
  }
  return value as MemberPricing;
}

interface Point {
  lat: number;
  lng: number;
  radiusKm: number;
}

/** A point and a radius: { lat, lng, radiusKm }. `prefix` is "near." when it is nested inside a search. */
function readPoint(obj: Record<string, unknown>, errors: Errors, prefix = '', otherFields: readonly string[] = []): Point | undefined {
  rejectUnknownFields(obj, ['lat', 'lng', 'radiusKm', ...otherFields], errors, prefix);

  const before = errors.length;
  for (const key of ['lat', 'lng', 'radiusKm']) {
    if (obj[key] === undefined) errors.push({ field: `${prefix}${key}`, message: 'is required' });
  }
  const lat = readNumber(obj, 'lat', `${prefix}lat`, errors, { min: -90, max: 90 });
  const lng = readNumber(obj, 'lng', `${prefix}lng`, errors, { min: -180, max: 180 });
  const radiusKm = readNumber(obj, 'radiusKm', `${prefix}radiusKm`, errors, { min: 0, max: MAX_RADIUS_KM, minExclusive: true });

  if (errors.length > before || lat === undefined || lng === undefined || radiusKm === undefined) return undefined;
  return { lat, lng, radiusKm };
}

/** The body of POST /api/prices/search. Everything is optional; an empty body searches everything. */
export function parseSearchBody(body: unknown): ParseResult<PriceFilters> {
  const errors: Errors = [];
  const obj = asObject(body, errors);
  if (obj === undefined) return { ok: false, errors };
  rejectUnknownFields(obj, SEARCH_FIELDS, errors);

  const filters: PriceFilters = {};

  const query = obj['query'];
  if (query !== undefined) {
    if (typeof query !== 'string') {
      errors.push({ field: 'query', message: 'must be text' });
    } else if (query.trim().length > MAX_QUERY_LENGTH) {
      errors.push({ field: 'query', message: `can be at most ${MAX_QUERY_LENGTH} characters` });
    } else if (query.trim() !== '') {
      filters.query = query.trim();
    }
  }

  const chainSlugs = readTextList(obj, 'chainSlugs', errors, MAX_LIST_ENTRIES);
  if (chainSlugs !== undefined) filters.chainSlugs = chainSlugs;
  const parentCompanies = readTextList(obj, 'parentCompanies', errors, MAX_LIST_ENTRIES);
  if (parentCompanies !== undefined) filters.parentCompanies = parentCompanies;
  const locationIds = readTextList(obj, 'locationIds', errors, MAX_LIST_ENTRIES);
  if (locationIds !== undefined) filters.locationIds = locationIds;

  const categories = readCategories(obj, errors);
  if (categories !== undefined) filters.categories = categories;

  const near = obj['near'];
  if (near !== undefined) {
    if (typeof near !== 'object' || near === null || Array.isArray(near)) {
      errors.push({ field: 'near', message: 'must be an object like { "lat": 49.28, "lng": -123.12, "radiusKm": 5 }' });
    } else {
      const point = readPoint(near as Record<string, unknown>, errors, 'near.');
      if (point !== undefined) filters.near = point;
    }
  }

  const onSaleOnly = obj['onSaleOnly'];
  if (onSaleOnly !== undefined) {
    if (typeof onSaleOnly !== 'boolean') errors.push({ field: 'onSaleOnly', message: 'must be true or false' });
    else filters.onSaleOnly = onSaleOnly;
  }

  const memberPricing = readMemberPricing(obj, 'memberPricing', errors);
  if (memberPricing !== undefined) filters.memberPricing = memberPricing;

  const sortBy = obj['sortBy'];
  if (sortBy !== undefined) {
    if (typeof sortBy !== 'string' || !SORTS.includes(sortBy as PriceSort)) {
      errors.push({ field: 'sortBy', message: `must be one of: ${SORTS.join(', ')}` });
    } else if (sortBy === 'distance' && obj['near'] === undefined) {
      errors.push({ field: 'sortBy', message: 'can only be "distance" when "near" is given' });
    } else {
      filters.sortBy = sortBy as PriceSort;
    }
  }

  const sortOrder = obj['sortOrder'];
  if (sortOrder !== undefined) {
    if (typeof sortOrder !== 'string' || !SORT_ORDERS.includes(sortOrder as SortOrder)) {
      errors.push({ field: 'sortOrder', message: `must be one of: ${SORT_ORDERS.join(', ')}` });
    } else {
      filters.sortOrder = sortOrder as SortOrder;
    }
  }

  const limit = readNumber(obj, 'limit', 'limit', errors, { min: 1, max: MAX_LIMIT, integer: true });
  if (limit !== undefined) filters.limit = limit;
  const offset = readNumber(obj, 'offset', 'offset', errors, { min: 0, max: 1_000_000, integer: true });
  if (offset !== undefined) filters.offset = offset;

  return finish(errors, filters);
}

/** The body of POST /api/prices/lookup: { ids: [...], memberPricing? }. */
export function parseLookupBody(body: unknown): ParseResult<{ ids: string[]; memberPricing: MemberPricing }> {
  const errors: Errors = [];
  const obj = asObject(body, errors);
  if (obj === undefined) return { ok: false, errors };
  rejectUnknownFields(obj, ['ids', 'memberPricing'], errors);

  const ids = readTextList(obj, 'ids', errors, MAX_LOOKUP_IDS);
  if (obj['ids'] === undefined) errors.push({ field: 'ids', message: 'is required' });
  else if (ids !== undefined && ids.length === 0) errors.push({ field: 'ids', message: 'must have at least one id' });

  const memberPricing = readMemberPricing(obj, 'memberPricing', errors) ?? 'non-member';
  return finish(errors, { ids: ids ?? [], memberPricing });
}

/** Shared categories, with unknown slugs reported by name. */
function readCategories(obj: Record<string, unknown>, errors: Errors, field = 'categories'): PriceFilters['categories'] {
  const categories = readTextList(obj, 'categories', errors, MAX_LIST_ENTRIES, MAX_ID_LENGTH, field);
  if (categories === undefined) return undefined;
  const unknown = categories.filter((entry) => !isProductCategory(entry));
  if (unknown.length > 0) {
    errors.push({ field, message: `has unknown categories (${unknown.join(', ')}). Known: ${PRODUCT_CATEGORIES.join(', ')}` });
    return undefined;
  }
  return categories as PriceFilters['categories'];
}

/** One line of a shopping list: { query, categories?, quantity? } or { itemId, quantity? }. */
function readListEntry(value: unknown, index: number, errors: Errors): ShoppingListEntry | undefined {
  const prefix = `items[${index}].`;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    errors.push({ field: `items[${index}]`, message: 'must be an object like { "query": "milk", "quantity": 2 }' });
    return undefined;
  }
  const obj = value as Record<string, unknown>;
  const before = errors.length;
  rejectUnknownFields(obj, ['query', 'itemId', 'categories', 'quantity'], errors, prefix);

  const quantity = readNumber(obj, 'quantity', `${prefix}quantity`, errors, { min: 1, max: MAX_QUANTITY, integer: true });
  const { query, itemId } = obj;
  if (query !== undefined && itemId !== undefined) {
    errors.push({ field: `items[${index}]`, message: 'must have "query" or "itemId", not both' });
  } else if (itemId !== undefined) {
    if (typeof itemId !== 'string' || itemId.trim() === '' || itemId.length > MAX_ID_LENGTH) {
      errors.push({ field: `${prefix}itemId`, message: `must be an item id up to ${MAX_ID_LENGTH} characters` });
    }
    if (obj['categories'] !== undefined) {
      errors.push({ field: `${prefix}categories`, message: 'can only be used with "query"' });
    }
  } else if (query === undefined) {
    errors.push({ field: `items[${index}]`, message: 'must have "query" (like "milk") or "itemId"' });
  } else if (typeof query !== 'string' || query.trim() === '' || query.trim().length > MAX_QUERY_LENGTH) {
    errors.push({ field: `${prefix}query`, message: `must be text, 1 to ${MAX_QUERY_LENGTH} characters` });
  }
  const categories = itemId === undefined ? readCategories(obj, errors, `${prefix}categories`) : undefined;

  if (errors.length > before) return undefined;
  const extra = quantity === undefined ? {} : { quantity };
  if (typeof itemId === 'string') return { itemId: itemId.trim(), ...extra };
  return { query: (query as string).trim(), ...(categories === undefined ? {} : { categories }), ...extra };
}

/** The body of POST /api/prices/list: a shopping list and, optionally, where the shopper will buy. */
export function parseShoppingListBody(body: unknown): ParseResult<ShoppingListRequest> {
  const errors: Errors = [];
  const obj = asObject(body, errors);
  if (obj === undefined) return { ok: false, errors };
  rejectUnknownFields(
    obj,
    ['items', 'chainSlugs', 'parentCompanies', 'locationIds', 'near', 'memberPricing', 'matchesPerItem'],
    errors,
  );

  const request: ShoppingListRequest = { items: [] };
  const items = obj['items'];
  if (items === undefined) {
    errors.push({ field: 'items', message: 'is required' });
  } else if (!Array.isArray(items) || items.length === 0) {
    errors.push({ field: 'items', message: 'must be a list with at least one entry' });
  } else if (items.length > MAX_LIST_ITEMS) {
    errors.push({ field: 'items', message: `can have at most ${MAX_LIST_ITEMS} entries` });
  } else {
    items.forEach((value, index) => {
      const entry = readListEntry(value, index, errors);
      if (entry !== undefined) request.items.push(entry);
    });
  }

  const chainSlugs = readTextList(obj, 'chainSlugs', errors, MAX_LIST_ENTRIES);
  if (chainSlugs !== undefined) request.chainSlugs = chainSlugs;
  const parentCompanies = readTextList(obj, 'parentCompanies', errors, MAX_LIST_ENTRIES);
  if (parentCompanies !== undefined) request.parentCompanies = parentCompanies;
  const locationIds = readTextList(obj, 'locationIds', errors, MAX_LIST_ENTRIES);
  if (locationIds !== undefined) request.locationIds = locationIds;

  const near = obj['near'];
  if (near !== undefined) {
    if (typeof near !== 'object' || near === null || Array.isArray(near)) {
      errors.push({ field: 'near', message: 'must be an object like { "lat": 49.28, "lng": -123.12, "radiusKm": 5 }' });
    } else {
      const point = readPoint(near as Record<string, unknown>, errors, 'near.');
      if (point !== undefined) request.near = point;
    }
  }

  const memberPricing = readMemberPricing(obj, 'memberPricing', errors);
  if (memberPricing !== undefined) request.memberPricing = memberPricing;
  const matchesPerItem = readNumber(obj, 'matchesPerItem', 'matchesPerItem', errors, {
    min: 1,
    max: MAX_MATCHES_PER_ITEM,
    integer: true,
  });
  if (matchesPerItem !== undefined) request.matchesPerItem = matchesPerItem;

  return finish(errors, request);
}

/** The body of POST /api/stores/nearby: { lat, lng, radiusKm, chainSlugs? }. */
export function parseNearbyBody(body: unknown): ParseResult<Point & { chainSlugs?: string[] }> {
  const errors: Errors = [];
  const obj = asObject(body, errors);
  if (obj === undefined) return { ok: false, errors };
  const point = readPoint(obj, errors, '', ['chainSlugs']);
  const chainSlugs = readTextList(obj, 'chainSlugs', errors, MAX_LIST_ENTRIES);
  const value = point ?? { lat: 0, lng: 0, radiusKm: 0 };
  return finish(errors, chainSlugs === undefined ? value : { ...value, chainSlugs });
}

/** The ?memberPricing= part of GET /api/prices/{id}. Missing means a non-member. */
export function parseMemberPricingParam(value: unknown): ParseResult<MemberPricing> {
  if (value === undefined) return { ok: true, value: 'non-member' };
  if (typeof value === 'string' && MEMBER_PRICINGS.includes(value as MemberPricing)) {
    return { ok: true, value: value as MemberPricing };
  }
  return { ok: false, errors: [{ field: 'memberPricing', message: `must be one of: ${MEMBER_PRICINGS.join(', ')}` }] };
}

/** The ?chain= part of GET /api/stores. It can be given once or several times. */
export function parseChainParams(value: unknown): ParseResult<string[]> {
  if (value === undefined) return { ok: true, value: [] };
  const list = Array.isArray(value) ? value : [value];
  if (list.some((entry) => typeof entry !== 'string' || entry.trim() === '')) {
    return { ok: false, errors: [{ field: 'chain', message: 'must be a chain slug, like chain=walmart' }] };
  }
  return { ok: true, value: (list as string[]).map((entry) => entry.trim()) };
}

/** The body of POST /api/lists and PUT /api/lists/{id}: { name, items }. */
export function parseSavedListBody(body: unknown): ParseResult<SavedListInput> {
  const errors: Errors = [];
  const obj = asObject(body, errors);
  if (obj === undefined) return { ok: false, errors };
  rejectUnknownFields(obj, ['name', 'items'], errors);

  const name = obj['name'];
  let cleanName = '';
  if (name === undefined) {
    errors.push({ field: 'name', message: 'is required' });
  } else if (typeof name !== 'string' || name.trim() === '' || name.trim().length > MAX_LIST_NAME_LENGTH) {
    errors.push({ field: 'name', message: `must be text, 1 to ${MAX_LIST_NAME_LENGTH} characters` });
  } else {
    cleanName = name.trim();
  }

  const entries: SavedListInput['items'] = [];
  const items = obj['items'];
  if (items !== undefined) {
    if (!Array.isArray(items)) {
      errors.push({ field: 'items', message: 'must be a list (it can be empty)' });
    } else if (items.length > MAX_LIST_ITEMS) {
      errors.push({ field: 'items', message: `can have at most ${MAX_LIST_ITEMS} entries` });
    } else {
      items.forEach((value, index) => {
        const entry = readListEntry(value, index, errors);
        if (entry !== undefined) entries.push(entry);
      });
    }
  }

  return finish(errors, { name: cleanName, items: entries });
}

/**
 * The body of POST /api/lists/{id}/prices: where to shop (chains, picked stores or a radius,
 * member pricing, matches per item). The entries come from the saved list, so "items" is not allowed.
 */
export function parseSavedListPriceBody(body: unknown, items: ShoppingListEntry[]): ParseResult<ShoppingListRequest> {
  const errors: Errors = [];
  const obj = asObject(body, errors);
  if (obj === undefined) return { ok: false, errors };
  if (obj['items'] !== undefined) {
    return { ok: false, errors: [{ field: 'items', message: 'comes from the saved list, so leave it out' }] };
  }
  return parseShoppingListBody({ ...obj, items });
}
