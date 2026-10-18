import {
  handleCategories,
  handleChains,
  handleGetItem,
  handleHealth,
  handleLookup,
  handleNearbyStores,
  handleSearch,
  handleShoppingList,
  handleStores,
  type HandlerOptions,
} from '../api/handlers';
import {
  handleCreateList,
  handleDeleteList,
  handleGetList,
  handleListLists,
  handlePriceSavedList,
  handleReplaceList,
} from '../api/lists';
import type { ApiErrorBody, ApiErrorDetail } from '../api/types';
import { bearerToken, type SignedInUser, type TokenVerifier } from '../auth/tokens';
import type { PriceRepository } from '../db/repository';
import type { ListRepository } from '../lists/lists';

/**
 * The API's request handling, with no tie to a particular server. The local Node server
 * (server.ts) and the Cloudflare Worker (worker.ts) both hand every request to this, so they
 * answer exactly the same way. It turns each request into a call to the plain handlers in
 * api/handlers.ts and api/lists.ts.
 *
 * Privacy: a visitor's location only ever arrives in a POST body. This file never logs a
 * body, a query string, a header or anything parsed from them (so never a login token).
 * A log line is method, path, status, time.
 *
 * Accounts: /api/lists needs "Authorization: Bearer <login token>" from Supabase Auth.
 * Without `tokens` and `lists` those routes answer 503, and everything else still works.
 *
 * Cross-site use (CORS): a website on another address (like https://banana-8qk.pages.dev
 * calling an API on workers.dev) is only allowed if its exact origin is in `corsOrigins`.
 */

/** Requests with a bigger body than this get a 413. 64 KB is far more than any real request needs. */
export const MAX_BODY_BYTES = 64 * 1024;

export interface RequestLogEntry {
  method: string;
  /** The path without the query string. */
  path: string;
  status: number;
  durationMs: number;
}

export interface ServerLogger {
  /** One line per finished request. */
  request(entry: RequestLogEntry): void;
  /** Something broke. Given the error only, never the request. */
  error(error: unknown): void;
}

export const consoleLogger: ServerLogger = {
  request: ({ method, path, status, durationMs }) => console.log(`${method} ${path} ${status} ${durationMs.toFixed(1)}ms`),
  error: (error) => console.error(error instanceof Error ? (error.stack ?? error.message) : String(error)),
};

export interface ApiHandlerOptions {
  prices: PriceRepository;
  /** Saved lists. Leave out (with `tokens`) to run without accounts. */
  lists?: ListRepository;
  /** Checks login tokens. Leave out to run without accounts. */
  tokens?: TokenVerifier;
  logger?: ServerLogger;
  maxBodyBytes?: number;
  /** Websites allowed to call this API from a browser on another address, e.g. ["https://banana-8qk.pages.dev"]. */
  corsOrigins?: readonly string[];
}

/** What the handler needs from an incoming request, whatever server it came from. */
export interface ApiRequest {
  method: string;
  url: URL;
  /** A header value, by lowercase name. */
  header(name: string): string | undefined;
  /** The body as text, up to `limit` bytes; past that, `tooLarge`. */
  readBody(limit: number): Promise<{ ok: true; text: string } | { ok: false; tooLarge: true }>;
}

export interface ApiResponse {
  status: number;
  headers: Record<string, string>;
  /** JSON text, or empty for 204. */
  body: string;
}

interface JsonReply {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

/** Everything a route needs from the request, already pulled apart. */
interface RouteContext {
  params: URLSearchParams;
  /** The id from /api/prices/{id} or /api/lists/{id}, URL-decoded. */
  id: string;
  /** The Authorization header, only ever handed to the token check. */
  authorization: string | undefined;
  readJson: () => Promise<{ ok: true; value: unknown } | { ok: false; reply: JsonReply }>;
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';
type Route = Partial<Record<Method, (ctx: RouteContext) => Promise<JsonReply>>>;

function errorReply(status: number, code: ApiErrorBody['error']['code'], message: string, details?: ApiErrorDetail[]): JsonReply {
  const body: ApiErrorBody = { error: { code, message, ...(details === undefined ? {} : { details }) } };
  return { status, body };
}

const bodyProblem = (status: number, message: string): JsonReply =>
  errorReply(status, 'invalid_request', 'The request has 1 problem.', [{ field: '(body)', message }]);

/** ?chain=a&chain=b as the handlers expect it: missing, one string, or a list. */
function paramValue(params: URLSearchParams, name: string): string | string[] | undefined {
  const values = params.getAll(name);
  if (values.length === 0) return undefined;
  return values.length === 1 ? values[0] : values;
}

function isJsonContentType(header: string | undefined): boolean {
  const mediaType = header?.split(';')[0]?.trim().toLowerCase();
  return mediaType === 'application/json';
}

function routesFor(
  prices: PriceRepository,
  accounts: { lists: ListRepository; tokens: TokenVerifier } | undefined,
  handlerOptions: HandlerOptions,
): Record<string, Route> {
  /** POST routes: check the body, then pass the parsed JSON to the handler. */
  const withBody =
    (handler: (body: unknown) => Promise<JsonReply>) =>
    async (ctx: RouteContext): Promise<JsonReply> => {
      const body = await ctx.readJson();
      return body.ok ? handler(body.value) : body.reply;
    };

  /** List routes: only for a signed-in user, checked from the login token before anything else. */
  const signedIn =
    (handler: (user: SignedInUser, lists: ListRepository, ctx: RouteContext) => Promise<JsonReply>) =>
    async (ctx: RouteContext): Promise<JsonReply> => {
      if (accounts === undefined) {
        return errorReply(503, 'unavailable', 'Accounts are not switched on for this server yet.');
      }
      const token = bearerToken(ctx.authorization);
      const user = token === undefined ? undefined : await accounts.tokens.verify(token);
      if (user === undefined) {
        return {
          ...errorReply(401, 'unauthorized', 'Please sign in again. The login token is missing, expired or not valid.'),
          headers: { 'WWW-Authenticate': 'Bearer' },
        };
      }
      return handler(user, accounts.lists, ctx);
    };

  /** A signed-in route that also reads a JSON body. */
  const signedInWithBody = (handler: (user: SignedInUser, lists: ListRepository, ctx: RouteContext, body: unknown) => Promise<JsonReply>) =>
    signedIn(async (user, lists, ctx) => {
      const body = await ctx.readJson();
      return body.ok ? handler(user, lists, ctx, body.value) : body.reply;
    });

  return {
    '/api/prices/search': { POST: withBody((body) => handleSearch(prices, body, handlerOptions)) },
    '/api/prices/lookup': { POST: withBody((body) => handleLookup(prices, body, handlerOptions)) },
    '/api/prices/list': { POST: withBody((body) => handleShoppingList(prices, body, handlerOptions)) },
    '/api/prices/{id}': {
      GET: (ctx) => handleGetItem(prices, ctx.id, { memberPricing: ctx.params.get('memberPricing') ?? undefined }, handlerOptions),
    },
    '/api/chains': { GET: () => handleChains(prices, handlerOptions) },
    '/api/categories': { GET: () => handleCategories() },
    '/api/stores': { GET: (ctx) => handleStores(prices, { chain: paramValue(ctx.params, 'chain') }, handlerOptions) },
    '/api/stores/nearby': { POST: withBody((body) => handleNearbyStores(prices, body, handlerOptions)) },
    '/api/health': { GET: () => handleHealth() },
    '/api/lists': {
      GET: signedIn((user, lists) => handleListLists(lists, user, handlerOptions)),
      POST: signedInWithBody((user, lists, _ctx, body) => handleCreateList(lists, user, body, handlerOptions)),
    },
    '/api/lists/{id}': {
      GET: signedIn((user, lists, ctx) => handleGetList(lists, user, ctx.id, handlerOptions)),
      PUT: signedInWithBody((user, lists, ctx, body) => handleReplaceList(lists, user, ctx.id, body, handlerOptions)),
      DELETE: signedIn((user, lists, ctx) => handleDeleteList(lists, user, ctx.id, handlerOptions)),
    },
    '/api/lists/{id}/prices': {
      POST: signedInWithBody((user, lists, ctx, body) => handlePriceSavedList(prices, lists, user, ctx.id, body, handlerOptions)),
    },
  };
}

const ITEM_PREFIX = '/api/prices/';
const LIST_PREFIX = '/api/lists/';

/**
 * Which route a path belongs to. Fixed paths win, so /api/prices/search is never read as an
 * item id. An item id must be one path segment; a "/" inside an id is sent as %2F.
 */
function matchRoute(routes: Record<string, Route>, pathname: string): { key: string; rawId: string } | undefined {
  if (routes[pathname] !== undefined && !pathname.includes('{')) return { key: pathname, rawId: '' };
  if (pathname.startsWith(LIST_PREFIX)) {
    const [rawId = '', action, ...rest] = pathname.slice(LIST_PREFIX.length).split('/');
    if (rawId === '' || rest.length > 0) return undefined;
    if (action === undefined) return { key: '/api/lists/{id}', rawId };
    if (action === 'prices') return { key: '/api/lists/{id}/prices', rawId };
    return undefined;
  }
  if (pathname.startsWith(ITEM_PREFIX)) {
    const rawId = pathname.slice(ITEM_PREFIX.length);
    if (rawId !== '' && !rawId.includes('/')) return { key: '/api/prices/{id}', rawId };
  }
  return undefined;
}

const CORS_METHODS = 'GET, POST, PUT, DELETE';
const CORS_HEADERS = 'Content-Type, Authorization';

function now(): number {
  return globalThis.performance?.now() ?? Date.now();
}

/** Builds the request handler. Every request, from any server, goes through the function it returns. */
export function createApiHandler(options: ApiHandlerOptions): (request: ApiRequest) => Promise<ApiResponse> {
  const logger = options.logger ?? consoleLogger;
  const maxBodyBytes = options.maxBodyBytes ?? MAX_BODY_BYTES;
  const corsOrigins = new Set(options.corsOrigins ?? []);
  const accounts =
    options.lists !== undefined && options.tokens !== undefined ? { lists: options.lists, tokens: options.tokens } : undefined;
  const routes = routesFor(options.prices, accounts, { onError: (error) => logger.error(error) });

  async function respond(req: ApiRequest): Promise<JsonReply> {
    const match = matchRoute(routes, req.url.pathname);
    if (match === undefined) return errorReply(404, 'not_found', `There is no endpoint at ${req.url.pathname}.`);

    const route = routes[match.key] ?? {};
    const allowed = Object.keys(route).join(', ');
    const handler = route[req.method as Method];
    if (handler === undefined) {
      return { ...errorReply(405, 'invalid_request', `${req.url.pathname} only accepts ${allowed}.`), headers: { Allow: allowed } };
    }

    let id = '';
    try {
      id = decodeURIComponent(match.rawId);
    } catch {
      return errorReply(400, 'invalid_request', 'The request has 1 problem.', [{ field: 'id', message: 'is not URL-encoded correctly' }]);
    }

    return handler({
      params: req.url.searchParams,
      id,
      authorization: req.header('authorization'),
      readJson: async () => {
        if (!isJsonContentType(req.header('content-type'))) {
          return { ok: false, reply: bodyProblem(400, 'must be sent with Content-Type: application/json') };
        }
        const declared = Number(req.header('content-length'));
        if (Number.isFinite(declared) && declared > maxBodyBytes) {
          return { ok: false, reply: bodyProblem(413, `must be at most ${maxBodyBytes} bytes`) };
        }
        const read = await req.readBody(maxBodyBytes);
        if (!read.ok) return { ok: false, reply: bodyProblem(413, `must be at most ${maxBodyBytes} bytes`) };
        if (read.text.trim() === '') return { ok: true, value: {} };
        try {
          return { ok: true, value: JSON.parse(read.text) as unknown };
        } catch {
          // JSON.parse's own message quotes part of the body, which may hold a location. Don't pass it on.
          return { ok: false, reply: bodyProblem(400, 'must be valid JSON') };
        }
      },
    });
  }

  return async (req) => {
    const started = now();
    const origin = req.header('origin');
    const allowedOrigin = origin !== undefined && corsOrigins.has(origin) ? origin : undefined;
    const corsHeaders: Record<string, string> = allowedOrigin === undefined ? {} : { 'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin' };

    let response: ApiResponse;
    if (req.method === 'OPTIONS' && req.header('access-control-request-method') !== undefined) {
      // A browser asking "may this other site call you?" before the real request.
      response =
        allowedOrigin === undefined
          ? toResponse(errorReply(403, 'invalid_request', 'This website is not allowed to call the API.'), {})
          : {
              status: 204,
              headers: {
                ...corsHeaders,
                'Access-Control-Allow-Methods': CORS_METHODS,
                'Access-Control-Allow-Headers': CORS_HEADERS,
                'Access-Control-Max-Age': '600',
              },
              body: '',
            };
    } else {
      const reply = await respond(req).catch((error: unknown): JsonReply => {
        logger.error(error);
        return errorReply(500, 'internal_error', 'Something went wrong on our side. Please try again.');
      });
      response = toResponse(reply, corsHeaders);
    }
    logger.request({ method: req.method, path: req.url.pathname, status: response.status, durationMs: now() - started });
    return response;
  };
}

function toResponse(reply: JsonReply, extraHeaders: Record<string, string>): ApiResponse {
  return {
    status: reply.status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Responses can be about a visitor's location, so nothing in between should keep a copy.
      'Cache-Control': 'no-store',
      ...extraHeaders,
      ...reply.headers,
    },
    body: JSON.stringify(reply.body),
  };
}

/** Reads a web-standard request body up to `limit` bytes, stopping early once it is too big. */
async function readWebBody(request: Request, limit: number): Promise<{ ok: true; text: string } | { ok: false; tooLarge: true }> {
  if (request.body === null) return { ok: true, text: '' };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => undefined);
      return { ok: false, tooLarge: true };
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(all) };
}

/** For servers that speak web-standard Request and Response, like Cloudflare Workers. */
export async function handleWebRequest(handler: (request: ApiRequest) => Promise<ApiResponse>, request: Request): Promise<Response> {
  const response = await handler({
    method: request.method,
    url: new URL(request.url),
    header: (name) => request.headers.get(name) ?? undefined,
    readBody: (limit) => readWebBody(request, limit),
  });
  return new Response(response.status === 204 ? null : response.body, { status: response.status, headers: response.headers });
}
