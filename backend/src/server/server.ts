import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApiHandler, type ApiHandlerOptions, type ApiRequest } from './handler';

/**
 * The local web server for docs/api-contract.md, built on node:http only. All the request
 * handling (routes, checks, CORS, logging) is in handler.ts, shared with the Cloudflare
 * Worker; this file only connects it to Node's web server.
 */

export {
  consoleLogger,
  MAX_BODY_BYTES,
  type RequestLogEntry,
  type ServerLogger,
} from './handler';

export type ServerOptions = ApiHandlerOptions;

/** After this much data, an oversized upload is cut off instead of read to the end and thrown away. */
const MAX_DISCARD_BYTES = 1024 * 1024;

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

/** Builds the server without starting it. Call .listen() on the result, or use startServer. */
export function createApiServer(options: ServerOptions): Server {
  const handle = createApiHandler(options);
  const logError = options.logger?.error ?? ((error: unknown) => console.error(error));

  return createServer((req, res) => {
    let url: URL;
    try {
      url = new URL(req.url ?? '/', 'http://localhost');
    } catch {
      url = new URL('http://localhost/');
    }
    let bodyRead = false;
    const request: ApiRequest = {
      method: req.method ?? 'GET',
      url,
      header: (name) => {
        const value = req.headers[name];
        return Array.isArray(value) ? value.join(', ') : value;
      },
      readBody: (limit) => {
        bodyRead = true;
        return readBody(req, limit);
      },
    };

    handle(request)
      .then((response) => {
        if (!bodyRead) req.resume(); // Throw away a body nobody read, so the connection stays usable.
        const body = response.status === 204 ? '' : response.body;
        res.writeHead(response.status, { ...response.headers, 'Content-Length': String(Buffer.byteLength(body)) });
        res.end(body);
      })
      .catch((error: unknown) => {
        logError(error);
        if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end();
      });
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
