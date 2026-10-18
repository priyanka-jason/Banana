import { beforeAll, describe, expect, it } from 'vitest';
import { createBackend } from '../app';
import { createApiHandler, handleWebRequest, type ApiRequest, type ApiResponse, type RequestLogEntry } from './handler';

const SITE = 'https://banana-8qk.pages.dev';
let handle: (request: ApiRequest) => Promise<ApiResponse>;
const log: RequestLogEntry[] = [];

beforeAll(async () => {
  const { prices } = await createBackend({ source: 'simulated', now: () => new Date('2026-10-17T13:00:00.000Z') });
  handle = createApiHandler({
    prices,
    corsOrigins: [SITE],
    logger: { request: (entry) => log.push(entry), error: () => undefined },
  });
});

function web(path: string, init: RequestInit = {}): Promise<Response> {
  return handleWebRequest(handle, new Request(`https://banana-api.example.workers.dev${path}`, init));
}

describe('handleWebRequest (what the Cloudflare Worker uses)', () => {
  it('answers like the local server', async () => {
    const health = await web('/api/health');
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: 'ok' });

    const search = await web('/api/prices/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'milk', chainSlugs: ['no-frills'], limit: 20 }),
    });
    expect(search.status).toBe(200);
    const body = (await search.json()) as { total: number; rows: Array<{ id: string }> };
    expect(body.total).toBe(2);
    expect(body.rows.map((row) => row.id)).toEqual(['no-frills:sim-milk-1-2l', 'no-frills:sim-milk-2-4l']);
  });

  it('refuses an oversized body without reading all of it', async () => {
    const response = await web('/api/prices/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'x'.repeat(70 * 1024) }),
    });
    expect(response.status).toBe(413);
  });

  it('reports bad JSON without echoing it', async () => {
    const response = await web('/api/stores/nearby', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"lat": 49.2468135, "lng":',
    });
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain('49.2468');
  });
});

describe('cross-site permission (CORS)', () => {
  it('lets the live website call the API, and says so', async () => {
    const response = await web('/api/chains', { headers: { Origin: SITE } });
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(SITE);
    expect(response.headers.get('vary')).toBe('Origin');
  });

  it('answers the browser\'s "may I?" question for the live website', async () => {
    const response = await web('/api/prices/search', {
      method: 'OPTIONS',
      headers: { Origin: SITE, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(SITE);
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    expect(response.headers.get('access-control-allow-headers')).toContain('Content-Type');
  });

  it('gives other websites no permission', async () => {
    const other = await web('/api/chains', { headers: { Origin: 'https://evil.example.com' } });
    expect(other.headers.get('access-control-allow-origin')).toBeNull();

    const preflight = await web('/api/prices/search', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example.com', 'Access-Control-Request-Method': 'POST' },
    });
    expect(preflight.status).toBe(403);
    expect(preflight.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('is off unless origins are listed', async () => {
    const { prices } = await createBackend({ source: 'sample' });
    const closed = createApiHandler({ prices, logger: { request: () => undefined, error: () => undefined } });
    const response = await handleWebRequest(closed, new Request('https://x.example/api/chains', { headers: { Origin: SITE } }));
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('logs only method, path, status and time', () => {
    for (const entry of log) expect(Object.keys(entry).sort()).toEqual(['durationMs', 'method', 'path', 'status']);
  });
});
