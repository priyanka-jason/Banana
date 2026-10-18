/**
 * "Where is this item cheapest near me?", reading Supabase directly with the publishable key.
 *
 * A drop-in replacement for the earlier itemSearch.ts that used the service-role key: same
 * function name and the same result fields, plus distance and the branch. It calls the
 * banana.search_offers database function, so the filtering, sale rules and distances are the
 * same as everywhere else on the site. Self-contained: copy it into the frontend as it is.
 *
 *   import { createItemSearch } from './itemSearch'
 *   export const { searchItemPricesWithinProximityTS } = createItemSearch({
 *     supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
 *     publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
 *   })
 *
 * Only ever give it the publishable key (sb_publishable_...). It refuses secret keys.
 */

export interface ChainItemPriceResult {
  chainSlug: string;
  /** The chain's name, e.g. "Save-On-Foods". */
  chainName: string;
  productName: string;
  sku: string;
  /** The regular price. */
  basePriceCents: number;
  /** The sale price, only while a sale is active; otherwise null. */
  discountedPriceCents: number | null;
  /** How much the sale saves; 0 when there's no active sale. */
  discountAmountCents: number;

  // Added on top of the earlier result:
  /** Stable offer id, "chain:sku". */
  id: string;
  size: string | null;
  /** Straight-line km to the nearest branch of this chain in range. */
  distanceKm: number | null;
  /** That nearest branch. */
  storeId: string | null;
  storeName: string | null;
  /** Last day of the sale ("2026-10-22"), only while a sale is active. */
  saleEnd: string | null;
}

export interface ItemSearchConfig {
  /** https://<project>.supabase.co */
  supabaseUrl: string;
  /** The publishable key. Never a secret or service-role key. */
  publishableKey: string;
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
}

interface SearchOfferRow {
  id: string;
  chain_slug: string;
  chain_name: string;
  sku: string;
  name: string;
  size: string | null;
  regular_price_cents: number;
  sale_price_cents: number | null;
  discount_cents: number | null;
  sale_end: string | null;
  distance_km: number | null;
  nearest_store_id: string | null;
  nearest_store_name: string | null;
  total_count: number;
}

const PAGE = 100;
/** Enough for any one item across five chains; stops runaway paging. */
const MAX_RESULTS = 500;
const MAX_RADIUS_KM = 10;

/** 2 decimals is about 1 km: enough for a radius, without sending an exact address. */
const round2 = (value: number): number => Math.round(value * 100) / 100;

function looksSecret(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  // Older JWT-style keys: refuse anything that says it is the service role.
  const [, payload] = key.split('.');
  if (payload === undefined) return false;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string };
    return json.role === 'service_role';
  } catch {
    return false;
  }
}

export function createItemSearch(config: ItemSearchConfig) {
  if (!config.supabaseUrl || !config.publishableKey) {
    // Never print the key itself.
    throw new Error('Item search needs the Supabase URL and the publishable key.');
  }
  if (looksSecret(config.publishableKey)) {
    throw new Error('That is a secret key. Use the publishable key (sb_publishable_...) in the website.');
  }
  const base = config.supabaseUrl.replace(/\/+$/, '');
  const doFetch = config.fetch ?? ((input: string, init?: RequestInit) => fetch(input, init));

  async function page(body: Record<string, unknown>): Promise<SearchOfferRow[]> {
    const response = await doFetch(`${base}/rest/v1/rpc/search_offers`, {
      method: 'POST',
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${config.publishableKey}`,
        'Content-Type': 'application/json',
        'Content-Profile': 'banana',
      },
      body: JSON.stringify(body),
      credentials: 'omit',
    });
    const data: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const message = (data as { message?: string } | undefined)?.message;
      throw new Error(message ?? 'The price search is unavailable. Try again.');
    }
    return Array.isArray(data) ? (data as SearchOfferRow[]) : [];
  }

  /**
   * Every offer for an item at chains with a branch within `maxDistanceKm`, cheapest first
   * (the price a shopper pays today). Same name and arguments as before.
   */
  async function searchItemPricesWithinProximityTS(
    searchTerm: string,
    userLat: number,
    userLng: number,
    maxDistanceKm: number = 10,
  ): Promise<ChainItemPriceResult[]> {
    const query = searchTerm.trim();
    if (query === '') return [];
    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) throw new Error('A location is needed to search nearby.');
    if (!(maxDistanceKm > 0 && maxDistanceKm <= MAX_RADIUS_KM)) {
      throw new Error(`The distance must be more than 0 and at most ${MAX_RADIUS_KM} km.`);
    }

    const rows: SearchOfferRow[] = [];
    for (let offset = 0; offset < MAX_RESULTS; offset += PAGE) {
      const batch = await page({
        p_query: query,
        p_near_lat: round2(userLat),
        p_near_lng: round2(userLng),
        p_radius_km: maxDistanceKm,
        p_sort_by: 'price',
        p_limit: PAGE,
        p_offset: offset,
      });
      rows.push(...batch);
      if (batch.length < PAGE || rows.length >= (batch[0]?.total_count ?? 0)) break;
    }

    return rows.map((row) => ({
      chainSlug: row.chain_slug,
      chainName: row.chain_name,
      productName: row.name,
      sku: row.sku,
      basePriceCents: row.regular_price_cents,
      discountedPriceCents: row.sale_price_cents,
      discountAmountCents: row.discount_cents ?? 0,
      id: row.id,
      size: row.size,
      distanceKm: row.distance_km === null ? null : Number(row.distance_km),
      storeId: row.nearest_store_id,
      storeName: row.nearest_store_name,
      saleEnd: row.sale_end,
    }));
  }

  return { searchItemPricesWithinProximityTS };
}
