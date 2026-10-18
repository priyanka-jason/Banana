import type { ProductCategory } from '../categories';
import type { SavedListSummary } from '../lists/lists';
import type { Chain, NearbyStore, PriceRow, ShoppingListResult, StoreLocation } from '../types';

/**
 * Request and response shapes for the website's API (see backend/docs/api-contract.md).
 * A web server just turns each HTTP request into one of these calls and sends the result.
 */

/**
 * unauthorized: no valid login token (only the /api/lists endpoints need one).
 * unavailable: accounts aren't switched on for this server (no SUPABASE_URL).
 */
export type ApiErrorCode = 'invalid_request' | 'unauthorized' | 'not_found' | 'internal_error' | 'unavailable';

/** One thing wrong with a request, pointing at the field. */
export interface ApiErrorDetail {
  /** The field, like "near.lat". "(body)" means the whole request body. */
  field: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Present for invalid_request: every problem found, not just the first. */
    details?: ApiErrorDetail[];
  };
}

/** What a handler returns: an HTTP status and a JSON body. */
export type ApiResult<T> = { status: 200 | 201; body: T } | { status: 400 | 401 | 404 | 500 | 503; body: ApiErrorBody };

export interface SearchResponseBody {
  rows: PriceRow[];
  /** How many items match in all, before paging. */
  total: number;
  /** The page size that was used (the default if the request didn't say). */
  limit: number;
  offset: number;
}

export interface LookupResponseBody {
  /** In the order asked for. */
  rows: PriceRow[];
  /** Ids that were asked for but don't exist (for example an item a store stopped selling). */
  missingIds: string[];
}

/** POST /api/prices/list. Shaped like ShoppingListResult in types.ts. */
export type ShoppingListResponseBody = ShoppingListResult;

export interface ChainsResponseBody {
  /** Each chain, plus its public website when we know it. */
  chains: Array<Chain & { websiteUrl?: string }>;
}

export interface CategoriesResponseBody {
  categories: Array<{ slug: ProductCategory; label: string }>;
}

export interface StoresResponseBody {
  stores: StoreLocation[];
}

export interface NearbyStoresResponseBody {
  stores: NearbyStore[];
}

export interface HealthResponseBody {
  status: 'ok';
}

export interface ListsResponseBody {
  lists: SavedListSummary[];
}

export interface DeletedResponseBody {
  deleted: true;
}
