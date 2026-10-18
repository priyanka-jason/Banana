import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { performance } from 'node:perf_hooks';
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
 * A small local web server for docs/api-contract.md, built on node:http only, because the
 * team hasn't picked a framework yet. It turns each HTTP request into a call to the plain
 * handlers in api/handlers.ts and sends back what they return.
 *
 * Privacy: a visitor's location only ever arrives in a POST body. This file never logs a
 * body, a query string, a header or anything parsed from them (so never a login token).
 * A log line is method, path, status, time.
 *
 * Accounts: /api/lists needs "Authorization: Bearer <login token>" from Supabase Auth.
 * Without `tokens` and `lists` those routes answer 503, and everything else still works.
 */

/** Requests with a bigger body than this get a 413. 64 KB is far more than any real request needs. */
export const MAX_BODY_BYTES = 64 * 1024;
/** After this much data, an oversized upload is cut off instead of read to the end and thrown away. */
const MAX_DISCARD_BYTES = 1024 * 1024;

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

export interface ServerOptions {
  prices: PriceRepository;
  /** Saved lists. Leave out (with `tokens`) to run without accounts. */
  lists?: ListRepository;
  /** Checks login tokens. Leave out to run without accounts. */
  tokens?: TokenVerifier;
  logger?: ServerLogger;
  maxBodyBytes?: number;
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

/** Reads the body as text, up to `limit` bytes. Past that, the rest is drained and dropped. */
function readBody(req: IncomingMessage, limit: number): Promise<{ ok: true; text: string } | { ok: false; tooLarge: true }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        tooLarge = true;
        chunks.length = 0;
        if (size > MAX_DISCARD_BYTES) req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(tooLarge ? { ok: false, tooLarge: true } : { ok: true, text: Buffer.concat(chunks).toString('utf8') }));
    req.on('error', reject);
  });
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

function send(res: ServerResponse, reply: JsonReply): void {
  const text = JSON.stringify(reply.body);
  res.writeHead(reply.status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    // Responses can be about a visitor's location, so nothing in between should keep a copy.
    'Cache-Control': 'no-store',
    ...reply.headers,
  });
  res.end(text);
}

/** Builds the server without starting it. Call .listen() on the result, or use startServer. */
export function createApiServer(options: ServerOptions): Server {
  const logger = options.logger ?? consoleLogger;
  const maxBodyBytes = options.maxBodyBytes ?? MAX_BODY_BYTES;
  const accounts =
    options.lists !== undefined && options.tokens !== undefined ? { lists: options.lists, tokens: options.tokens } : undefined;
  const routes = routesFor(options.prices, accounts, { onError: (error) => logger.error(error) });

  async function respond(req: IncomingMessage, url: URL): Promise<JsonReply> {
    const match = matchRoute(routes, url.pathname);
    if (match === undefined) return errorReply(404, 'not_found', `There is no endpoint at ${url.pathname}.`);

    const route = routes[match.key] ?? {};
    const allowed = Object.keys(route).join(', ');
    const handler = route[req.method as Method];
    if (handler === undefined) {
      return { ...errorReply(405, 'invalid_request', `${url.pathname} only accepts ${allowed}.`), headers: { Allow: allowed } };
    }

    let id = '';
    try {
      id = decodeURIComponent(match.rawId);
    } catch {
      return errorReply(400, 'invalid_request', 'The request has 1 problem.', [{ field: 'id', message: 'is not URL-encoded correctly' }]);
    }

    return handler({
      params: url.searchParams,
      id,
      authorization: req.headers.authorization,
      readJson: async () => {
        if (!isJsonContentType(req.headers['content-type'])) {
          return { ok: false, reply: bodyProblem(400, 'must be sent with Content-Type: application/json') };
        }
        const declared = Number(req.headers['content-length']);
        if (Number.isFinite(declared) && declared > maxBodyBytes) {
          req.resume();
          return { ok: false, reply: bodyProblem(413, `must be at most ${maxBodyBytes} bytes`) };
        }
        const read = await readBody(req, maxBodyBytes);
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

  return createServer((req, res) => {
    const started = performance.now();
    const method = req.method ?? 'GET';
    let url: URL;
    try {
      url = new URL(req.url ?? '/', 'http://localhost');
    } catch {
      url = new URL('http://localhost/');
    }

    respond(req, url)
      .catch((error: unknown): JsonReply => {
        logger.error(error);
        return errorReply(500, 'internal_error', 'Something went wrong on our side. Please try again.');
      })
      .then((reply) => {
        if (!res.headersSent) send(res, reply);
        logger.request({ method, path: url.pathname, status: reply.status, durationMs: performance.now() - started });
      })
      .catch((error: unknown) => logger.error(error));
  });
}

export interface RunningServer {
  server: Server;
  /** Like http://127.0.0.1:8787 */
  url: string;
  close(): Promise<void>;
}

/** Starts the server on 127.0.0.1 only, so it isn't reachable from other machines. Port 0 picks a free port. */
export function startServer(options: ServerOptions & { port: number; host?: string }): Promise<RunningServer> {
  const server = createApiServer(options);
  const host = options.host ?? '127.0.0.1';
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, host, () => {
      server.off('error', reject);
      const { port } = server.address() as AddressInfo;
      resolve({
        server,
        url: `http://${host}:${port}`,
        close: () =>
          new Promise<void>((done, fail) => {
            server.closeAllConnections();
            server.close((error) => (error ? fail(error) : done()));
          }),
      });
    });
  });
}
