import type { ProductCategory } from '../categories';
import type { Chain, NearbyStore, PriceRow, ShoppingListResult, StoreLocation } from '../types';

/**
 * Request and response shapes for the website's API (see backend/docs/api-contract.md).
 * A web server just turns each HTTP request into one of these calls and sends the result.
 */

export type ApiErrorCode = 'invalid_request' | 'not_found' | 'internal_error';

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
export type ApiResult<T> = { status: 200; body: T } | { status: 400 | 404 | 500; body: ApiErrorBody };

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
  chains: Chain[];
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
