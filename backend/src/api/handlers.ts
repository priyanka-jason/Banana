import { CATEGORY_LABELS, PRODUCT_CATEGORIES } from '../categories';
import { chainWebsite } from '../chainSites';
import type { PriceRepository } from '../db/repository';
import { DEFAULT_LIMIT } from '../search/search';
import type {
  ApiErrorBody,
  ApiErrorDetail,
  ApiResult,
  CategoriesResponseBody,
  ChainsResponseBody,
  HealthResponseBody,
  LookupResponseBody,
  NearbyStoresResponseBody,
  SearchResponseBody,
  ShoppingListResponseBody,
  StoresResponseBody,
} from './types';
import {
  MAX_ID_LENGTH,
  parseChainParams,
  parseLookupBody,
  parseMemberPricingParam,
  parseNearbyBody,
  parseSearchBody,
  parseShoppingListBody,
} from './validate';

/**
 * One function per endpoint in backend/docs/api-contract.md. Each takes what the
 * web server pulled out of the HTTP request (already JSON-decoded) and returns a
 * status and a JSON body. They know nothing about HTTP, so a server (Express,
 * Hono, a serverless function...) only needs to wire routes to them.
 */

export interface HandlerOptions {
  /**
   * Called when something unexpected goes wrong, so the server can log it. It is given the
   * error only, never the request, because requests can contain a visitor's location.
   */
  onError?: (error: unknown) => void;
}

export function invalid(errors: ApiErrorDetail[]): ApiResult<never> {
  return {
    status: 400,
    body: {
      error: {
        code: 'invalid_request',
        message: errors.length === 1 ? 'The request has 1 problem.' : `The request has ${errors.length} problems.`,
        details: errors,
      },
    },
  };
}

const INTERNAL_ERROR: ApiErrorBody = {
  error: { code: 'internal_error', message: 'Something went wrong on our side. Please try again.' },
};

/** Turns any unexpected failure into a plain 500 that doesn't leak details to the website. */
export async function guarded<T>(options: HandlerOptions, work: () => Promise<ApiResult<T>>): Promise<ApiResult<T>> {
  try {
    return await work();
  } catch (error) {
    options.onError?.(error);
    return { status: 500, body: INTERNAL_ERROR };
  }
}

/** POST /api/prices/search */
export async function handleSearch(
  repo: PriceRepository,
  body: unknown,
  options: HandlerOptions = {},
): Promise<ApiResult<SearchResponseBody>> {
  const parsed = parseSearchBody(body);
  if (!parsed.ok) return invalid(parsed.errors);

  return guarded(options, async () => {
    const result = await repo.searchPrices(parsed.value);
    return {
      status: 200,
      body: {
        rows: result.rows,
        total: result.total,
        limit: parsed.value.limit ?? DEFAULT_LIMIT,
        offset: parsed.value.offset ?? 0,
      },
    };
  });
}

/** GET /api/prices/{id}?memberPricing=member. `id` is already URL-decoded. */
export async function handleGetItem(
  repo: PriceRepository,
  id: string,
  query: { memberPricing?: unknown },
  options: HandlerOptions = {},
): Promise<ApiResult<LookupResponseBody['rows'][number]>> {
  const errors: ApiErrorDetail[] = [];
  if (typeof id !== 'string' || id.trim() === '' || id.length > MAX_ID_LENGTH) {
    errors.push({ field: 'id', message: `must be an item id up to ${MAX_ID_LENGTH} characters` });
  }
  const memberPricing = parseMemberPricingParam(query.memberPricing);
  if (!memberPricing.ok) errors.push(...memberPricing.errors);
  if (errors.length > 0 || !memberPricing.ok) return invalid(errors);

  return guarded<LookupResponseBody['rows'][number]>(options, async () => {
    const [row] = await repo.getItems([id], { memberPricing: memberPricing.value });
    if (row === undefined) {
      return { status: 404, body: { error: { code: 'not_found', message: `There is no item with id "${id}".` } } };
    }
    return { status: 200, body: row };
  });
}

/** POST /api/prices/lookup, for a saved shopping list. */
export async function handleLookup(
  repo: PriceRepository,
  body: unknown,
  options: HandlerOptions = {},
): Promise<ApiResult<LookupResponseBody>> {
  const parsed = parseLookupBody(body);
  if (!parsed.ok) return invalid(parsed.errors);

  return guarded(options, async () => {
    const rows = await repo.getItems(parsed.value.ids, { memberPricing: parsed.value.memberPricing });
    const found = new Set(rows.map((row) => row.id));
    const missingIds = [...new Set(parsed.value.ids)].filter((id) => !found.has(id));
    return { status: 200, body: { rows, missingIds } };
  });
}

/**
 * POST /api/prices/list: price a whole shopping list in the chosen stores. A POST because
 * the store choice can include the shopper's location.
 */
export async function handleShoppingList(
  repo: PriceRepository,
  body: unknown,
  options: HandlerOptions = {},
): Promise<ApiResult<ShoppingListResponseBody>> {
  const parsed = parseShoppingListBody(body);
  if (!parsed.ok) return invalid(parsed.errors);

  return guarded(options, async () => ({ status: 200, body: await repo.priceShoppingList(parsed.value) }));
}

/** GET /api/chains */
export async function handleChains(
  repo: PriceRepository,
  options: HandlerOptions = {},
): Promise<ApiResult<ChainsResponseBody>> {
  return guarded(options, async () => {
    const chains = (await repo.listChains()).map((chain) => {
      const websiteUrl = chainWebsite(chain.slug);
      return websiteUrl === undefined ? chain : { ...chain, websiteUrl };
    });
    return { status: 200, body: { chains } };
  });
}

/** GET /api/categories. The list is fixed, so it doesn't need the database. */
export async function handleCategories(): Promise<ApiResult<CategoriesResponseBody>> {
  return {
    status: 200,
    body: { categories: PRODUCT_CATEGORIES.map((slug) => ({ slug, label: CATEGORY_LABELS[slug] })) },
  };
}

/** GET /api/stores?chain=walmart&chain=costco. No visitor location involved. */
export async function handleStores(
  repo: PriceRepository,
  query: { chain?: unknown },
  options: HandlerOptions = {},
): Promise<ApiResult<StoresResponseBody>> {
  const chains = parseChainParams(query.chain);
  if (!chains.ok) return invalid(chains.errors);

  return guarded(options, async () => ({
    status: 200,
    body: { stores: await repo.listStoreLocations({ chainSlugs: chains.value }) },
  }));
}

/** POST /api/stores/nearby. The location is in the body so it never lands in a URL or a log. */
export async function handleNearbyStores(
  repo: PriceRepository,
  body: unknown,
  options: HandlerOptions = {},
): Promise<ApiResult<NearbyStoresResponseBody>> {
  const parsed = parseNearbyBody(body);
  if (!parsed.ok) return invalid(parsed.errors);

  return guarded(options, async () => ({
    status: 200,
    body: {
      stores: await repo.storesWithinRadius(parsed.value.lat, parsed.value.lng, parsed.value.radiusKm, {
        chainSlugs: parsed.value.chainSlugs,
      }),
    },
  }));
}

/** GET /api/health */
export async function handleHealth(): Promise<ApiResult<HealthResponseBody>> {
  return { status: 200, body: { status: 'ok' } };
}
