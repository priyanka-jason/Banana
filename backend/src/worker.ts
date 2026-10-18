import { createSupabaseVerifier, type TokenVerifier } from './auth/tokens';
import type { FinalSource } from './db/memoryReader';
import { MemoryPriceRepository } from './db/memoryReader';
import { createPool, PostgresFinal } from './db/postgres';
import { PostgresListRepository } from './lists/postgresLists';
import type { FinalItem } from './pipeline/types';
import { consoleLogger, createApiHandler, handleWebRequest } from './server/handler';
import type { Chain, StoreLocation } from './types';

/**
 * The API as a Cloudflare Worker, so the live website can call it over HTTPS.
 * Same request handling as `npm run api` (server/handler.ts), reading the Supabase database.
 *
 * Settings (Cloudflare dashboard > the Worker > Settings > Variables and secrets, or wrangler.toml):
 *   DATABASE_URL  SECRET. The Supabase "Session pooler" connection string.
 *   SUPABASE_URL  The project URL, to check sign-in tokens for /api/lists. Not secret.
 *   CORS_ORIGINS  Websites allowed to call the API, comma separated, e.g. https://banana-8qk.pages.dev
 *
 * A Worker may not reuse a database connection across visitors' requests, so each request
 * opens at most one connection and closes it when done. Prices are kept for 60 seconds in
 * between, so most requests don't touch the database at all.
 */

export interface Env {
  DATABASE_URL?: string;
  SUPABASE_URL?: string;
  CORS_ORIGINS?: string;
}

interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

const CACHE_MS = 60_000;
let cached: { at: number; items: FinalItem[]; chains: Chain[]; locations: StoreLocation[] } | undefined;
let verifier: { url: string; tokens: TokenVerifier } | undefined;

/** The final layer, from the cache when it's fresh, otherwise loaded once for this request. */
function cachedSource(load: () => PostgresFinal): FinalSource {
  let pending: Promise<NonNullable<typeof cached>> | undefined;
  const get = () => {
    if (cached !== undefined && Date.now() - cached.at < CACHE_MS) return Promise.resolve(cached);
    pending ??= (async () => {
      const final = load();
      // One at a time: this request has a single database connection.
      const items = await final.listItems();
      const chains = await final.listChains();
      const locations = await final.listLocations();
      cached = { at: Date.now(), items, chains, locations };
      return cached;
    })();
    return pending;
  };
  return {
    listItems: async () => (await get()).items,
    listChains: async () => (await get()).chains,
    listLocations: async () => (await get()).locations,
  };
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: WorkerContext): Promise<Response> {
    const databaseUrl = env.DATABASE_URL?.trim();
    if (!databaseUrl) return jsonError(503, 'unavailable', 'The API is not connected to its database yet.');

    const supabaseUrl = env.SUPABASE_URL?.trim();
    if (supabaseUrl && verifier?.url !== supabaseUrl) verifier = { url: supabaseUrl, tokens: createSupabaseVerifier(supabaseUrl) };

    // Opened only if this request actually needs the database.
    let pool: ReturnType<typeof createPool> | undefined;
    const openPool = () => (pool ??= createPool({ connectionString: databaseUrl, max: 1 }));

    const handle = createApiHandler({
      prices: new MemoryPriceRepository(cachedSource(() => new PostgresFinal(openPool()))),
      // Saved lists only use query() and connect(); the connection opens on first use.
      lists: new PostgresListRepository({
        query: (...args: Parameters<ReturnType<typeof createPool>['query']>) => openPool().query(...args),
        connect: () => openPool().connect(),
      } as unknown as ReturnType<typeof createPool>),
      tokens: supabaseUrl ? verifier?.tokens : undefined,
      corsOrigins: (env.CORS_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean),
      logger: consoleLogger,
    });

    try {
      return await handleWebRequest(handle, request);
    } finally {
      if (pool !== undefined) ctx.waitUntil(pool.end().catch(() => undefined));
    }
  },
};
