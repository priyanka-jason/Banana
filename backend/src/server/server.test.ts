import { request } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createBackend } from '../app';
import type { PriceRow } from '../types';
import { MAX_BODY_BYTES, startServer, type RequestLogEntry, type RunningServer } from './server';

// A location nobody would type by accident, so finding it anywhere in the logs is a real leak.
const SECRET_LAT = 49.2468135;
const SECRET_LNG = -123.1357924;
const SECRET_TEXTS = ['49.2468', '123.1357', '2468135', '1357924'];

let running: RunningServer;
const requestLog: RequestLogEntry[] = [];
const errorLog: unknown[] = [];

beforeAll(async () => {
  const { prices } = await createBackend({ source: 'simulated', now: () => new Date('2026-10-17T20:00:00.000Z') });
  running = await startServer({
    prices,
    port: 0,
    logger: { request: (entry) => requestLog.push(entry), error: (error) => errorLog.push(error) },
  });
});

afterAll(async () => {
  await running.close();
});

beforeEach(() => {
  requestLog.length = 0;
  errorLog.length = 0;
});

function post(path: string, body: unknown, contentType = 'application/json'): Promise<Response> {
  return fetch(`${running.url}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function json<T>(response: Response): Promise<T> {
  expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
  return (await response.json()) as T;
}

interface ErrorBody {
  error: { code: string; message: string; details?: Array<{ field: string; message: string }> };
}

describe('local API server', () => {
  it('answers health', async () => {
    const response = await fetch(`${running.url}/api/health`);
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ status: 'ok' });
    expect(requestLog).toEqual([{ method: 'GET', path: '/api/health', status: 200, durationMs: expect.any(Number) }]);
  });

  it('searches one category, most expensive first', async () => {
    const response = await post('/api/prices/search', { categories: ['meat'], sortBy: 'price', sortOrder: 'desc', limit: 50 });
    expect(response.status).toBe(200);
    const body = await json<{ rows: PriceRow[]; total: number; limit: number; offset: number }>(response);
    expect(body.rows.length).toBeGreaterThan(1);
    expect(body.total).toBeGreaterThanOrEqual(body.rows.length);
    expect(body.rows.every((row) => row.category === 'meat')).toBe(true);
    const prices = body.rows.map((row) => row.priceCents);
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
    expect(prices.every(Number.isInteger)).toBe(true);
  });

  it('treats an empty search body as "everything"', async () => {
    const response = await post('/api/prices/search', '');
    expect(response.status).toBe(200);
    expect((await json<{ total: number }>(response)).total).toBe(283);
  });

  it('returns one item by a URL-encoded id, with member pricing from the query string', async () => {
    const id = 'no-frills:sim-milk-1-2l';
    const response = await fetch(`${running.url}/api/prices/${encodeURIComponent(id)}?memberPricing=member`);
    expect(response.status).toBe(200);
    expect((await json<PriceRow>(response)).id).toBe(id);
    expect(requestLog[0]?.path).toBe('/api/prices/no-frills%3Asim-milk-1-2l');
  });

  it('gives 404 not_found for an unknown item and 400 for a bad memberPricing', async () => {
    const missing = await fetch(`${running.url}/api/prices/${encodeURIComponent('walmart:nope/really')}`);
    expect(missing.status).toBe(404);
    expect((await json<ErrorBody>(missing)).error.code).toBe('not_found');

    const bad = await fetch(`${running.url}/api/prices/walmart%3Ax?memberPricing=gold`);
    expect(bad.status).toBe(400);
    expect((await json<ErrorBody>(bad)).error.details?.[0]?.field).toBe('memberPricing');
  });

  it('looks up a shopping list and reports missing ids', async () => {
    const response = await post('/api/prices/lookup', { ids: ['costco:sim-milk-2-4l', 'costco:does-not-exist'] });
    expect(response.status).toBe(200);
    const body = await json<{ rows: PriceRow[]; missingIds: string[] }>(response);
    expect(body.rows.map((row) => row.id)).toEqual(['costco:sim-milk-2-4l']);
    expect(body.missingIds).toEqual(['costco:does-not-exist']);
  });

  it('prices a whole shopping list, and never reads /api/prices/list as an item id', async () => {
    const response = await post('/api/prices/list', { items: [{ query: 'milk', quantity: 2 }, { query: 'banana' }] });
    expect(response.status).toBe(200);
    const body = await json<{ entries: unknown[]; chains: unknown[] }>(response);
    expect(body.entries).toHaveLength(2);
    expect(body.chains.length).toBeGreaterThan(0);

    const wrongMethod = await fetch(`${running.url}/api/prices/list`);
    expect(wrongMethod.status).toBe(405);
  });

  it('lists chains, categories and stores, with a repeatable ?chain=', async () => {
    const chains = await json<{ chains: unknown[] }>(await fetch(`${running.url}/api/chains`));
    expect(chains.chains).toHaveLength(5);
    const categories = await json<{ categories: unknown[] }>(await fetch(`${running.url}/api/categories`));
    expect(categories.categories.length).toBeGreaterThan(0);

    const all = await json<{ stores: unknown[] }>(await fetch(`${running.url}/api/stores`));
    expect(all.stores).toHaveLength(37);
    const two = await json<{ stores: Array<{ chainSlug: string }> }>(
      await fetch(`${running.url}/api/stores?chain=walmart&chain=costco`),
    );
    expect(new Set(two.stores.map((store) => store.chainSlug))).toEqual(new Set(['walmart', 'costco']));
  });

  it('finds nearby stores from a POST body, nearest first', async () => {
    const response = await post('/api/stores/nearby', { lat: 49.28, lng: -123.12, radiusKm: 10 });
    expect(response.status).toBe(200);
    const { stores } = await json<{ stores: Array<{ distanceKm: number }> }>(response);
    expect(stores.length).toBeGreaterThan(0);
    const distances = stores.map((store) => store.distanceKm);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('rejects bad JSON with 400 invalid_request', async () => {
    const response = await post('/api/prices/search', '{"query": "milk",');
    expect(response.status).toBe(400);
    const body = await json<ErrorBody>(response);
    expect(body.error.code).toBe('invalid_request');
    expect(body.error.details).toEqual([{ field: '(body)', message: 'must be valid JSON' }]);
  });

  it('rejects a POST that is not sent as JSON', async () => {
    const response = await post('/api/prices/search', '{}', 'text/plain');
    expect(response.status).toBe(400);
    expect((await json<ErrorBody>(response)).error.code).toBe('invalid_request');
  });

  it('accepts a charset on the Content-Type', async () => {
    const response = await post('/api/prices/search', { query: 'milk' }, 'application/json; charset=utf-8');
    expect(response.status).toBe(200);
  });

  it('rejects a body over the size limit with 413', async () => {
    const response = await post('/api/prices/search', { query: 'x'.repeat(MAX_BODY_BYTES) });
    expect(response.status).toBe(413);
    const body = await json<ErrorBody>(response);
    expect(body.error.code).toBe('invalid_request');
    expect(body.error.details?.[0]?.field).toBe('(body)');
  });

  it('rejects a body over the limit even when it is streamed without a Content-Length', async () => {
    const status = await new Promise<number>((resolve, reject) => {
      const url = new URL('/api/prices/search', running.url);
      const req = request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      req.on('error', reject);
      // Two writes with no Content-Length makes Node send it in chunks.
      req.write(`{"query":"${'x'.repeat(MAX_BODY_BYTES / 2)}`);
      req.end(`${'x'.repeat(MAX_BODY_BYTES)}"}`);
    });
    expect(status).toBe(413);
  });

  it('gives 404 not_found for an unknown route', async () => {
    const response = await fetch(`${running.url}/api/nope`);
    expect(response.status).toBe(404);
    expect((await json<ErrorBody>(response)).error.code).toBe('not_found');
    expect((await json<ErrorBody>(await fetch(`${running.url}/`))).error.code).toBe('not_found');
  });

  it('gives 405 with an Allow header for the wrong method', async () => {
    const getSearch = await fetch(`${running.url}/api/prices/search`);
    expect(getSearch.status).toBe(405);
    expect(getSearch.headers.get('allow')).toBe('POST');
    expect((await json<ErrorBody>(getSearch)).error.code).toBe('invalid_request');

    const postHealth = await post('/api/health', {});
    expect(postHealth.status).toBe(405);
    expect(postHealth.headers.get('allow')).toBe('GET');

    const deleteItem = await fetch(`${running.url}/api/prices/walmart%3Ax`, { method: 'DELETE' });
    expect(deleteItem.status).toBe(405);
  });

  it('never logs a coordinate sent in a body, even in errors', async () => {
    await post('/api/stores/nearby', { lat: SECRET_LAT, lng: SECRET_LNG, radiusKm: 5 });
    await post('/api/prices/search', { near: { lat: SECRET_LAT, lng: SECRET_LNG, radiusKm: 5 } });
    await post('/api/stores/nearby', { lat: SECRET_LAT, lng: SECRET_LNG, radiusKm: 999 });
    const broken = await post('/api/stores/nearby', `{"lat": ${SECRET_LAT}, "lng": ${SECRET_LNG}, `);

    const brokenText = await broken.text();
    for (const secret of SECRET_TEXTS) expect(brokenText).not.toContain(secret);

    expect(requestLog.map((entry) => `${entry.status} ${entry.path}`)).toEqual([
      '200 /api/stores/nearby',
      '200 /api/prices/search',
      '400 /api/stores/nearby',
      '400 /api/stores/nearby',
    ]);
    const logged = JSON.stringify(requestLog) + errorLog.map(String).join('\n');
    for (const secret of SECRET_TEXTS) expect(logged).not.toContain(secret);
  });

  it('leaves the query string out of the logged path', async () => {
    await fetch(`${running.url}/api/stores?chain=walmart`);
    expect(requestLog[0]?.path).toBe('/api/stores');
  });
});
