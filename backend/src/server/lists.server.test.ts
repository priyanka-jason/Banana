import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createBackend } from '../app';
import { createKeyVerifier } from '../auth/tokens';
import { MAX_SAVED_LISTS } from '../lists/lists';
import { startServer, type RequestLogEntry, type RunningServer } from './server';

const ISSUER = 'https://example-project.supabase.co/auth/v1';
const ALICE = 'aaaaaaaa-0000-4000-8000-00000000000a';
const BOB = 'bbbbbbbb-0000-4000-8000-00000000000b';
// A location nobody would type by accident, so finding it in the logs is a real leak.
const SECRET_TEXTS = ['49.2468', '123.1357'];

let running: RunningServer;
let withoutAccounts: RunningServer;
let privateKey: CryptoKey;
const requestLog: RequestLogEntry[] = [];
const errorLog: unknown[] = [];
const tokens = new Map<string, string>();

async function tokenFor(userId: string): Promise<string> {
  return new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);
}

beforeAll(async () => {
  const pair = await generateKeyPair('ES256');
  privateKey = pair.privateKey;
  const verifier = createKeyVerifier({
    keys: createLocalJWKSet({ keys: [{ ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'ES256' }] }),
    issuer: ISSUER,
  });
  tokens.set(ALICE, await tokenFor(ALICE));
  tokens.set(BOB, await tokenFor(BOB));

  const { prices, lists } = await createBackend({ source: 'simulated', now: () => new Date('2026-10-17T20:00:00.000Z') });
  const logger = { request: (entry: RequestLogEntry) => requestLog.push(entry), error: (error: unknown) => errorLog.push(error) };
  running = await startServer({ prices, lists, tokens: verifier, port: 0, logger });
  withoutAccounts = await startServer({ prices, port: 0, logger });
});

afterAll(async () => {
  await running.close();
  await withoutAccounts.close();
});

beforeEach(() => {
  requestLog.length = 0;
  errorLog.length = 0;
});

function call(method: string, path: string, user: string | undefined, body?: unknown, server = running): Promise<Response> {
  const headers: Record<string, string> = {};
  if (user !== undefined) headers['Authorization'] = `Bearer ${tokens.get(user) ?? user}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${server.url}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

interface ListBody {
  id: string;
  name: string;
  items: unknown[];
}

describe('saved lists over HTTP', () => {
  it('needs a valid login: no token, a made-up token, or a broken header all get 401', async () => {
    for (const user of [undefined, 'made.up.token']) {
      const response = await call('GET', '/api/lists', user);
      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toBe('Bearer');
      expect(((await response.json()) as { error: { code: string } }).error.code).toBe('unauthorized');
    }
    const basic = await fetch(`${running.url}/api/lists`, { headers: { Authorization: 'Basic abc' } });
    expect(basic.status).toBe(401);
  });

  it('answers 503 when the server has accounts switched off, and the rest of the API still works', async () => {
    const response = await call('GET', '/api/lists', ALICE, undefined, withoutAccounts);
    expect(response.status).toBe(503);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('unavailable');
    expect((await fetch(`${withoutAccounts.url}/api/health`)).status).toBe(200);
  });

  it('creates, reads, renames, prices and deletes a list', async () => {
    const created = await call('POST', '/api/lists', ALICE, {
      name: '  Weekly groceries  ',
      items: [{ query: 'milk', quantity: 2 }, { query: 'banana' }, { itemId: 'walmart:sim-bananas' }],
    });
    expect(created.status).toBe(201);
    const list = (await created.json()) as ListBody;
    expect(list.name).toBe('Weekly groceries');
    expect(list.items).toHaveLength(3);

    const mine = (await (await call('GET', '/api/lists', ALICE)).json()) as { lists: Array<{ id: string; itemCount: number }> };
    expect(mine.lists).toEqual([expect.objectContaining({ id: list.id, itemCount: 3 })]);

    const read = await call('GET', `/api/lists/${list.id}`, ALICE);
    expect(read.status).toBe(200);
    expect(((await read.json()) as ListBody).items).toEqual(list.items);

    const renamed = await call('PUT', `/api/lists/${list.id}`, ALICE, { name: 'Party', items: [{ query: 'chips' }] });
    expect(renamed.status).toBe(200);
    expect((await renamed.json()) as ListBody).toMatchObject({ id: list.id, name: 'Party', items: [{ query: 'chips' }] });

    const priced = await call('POST', `/api/lists/${list.id}/prices`, ALICE, {
      near: { lat: 49.2468135, lng: -123.1357924, radiusKm: 10 },
    });
    expect(priced.status).toBe(200);
    const result = (await priced.json()) as { entries: unknown[]; chains: unknown[] };
    expect(result.entries).toHaveLength(1);
    expect(result.chains.length).toBeGreaterThan(0);

    expect((await call('DELETE', `/api/lists/${list.id}`, ALICE)).status).toBe(200);
    expect((await call('GET', `/api/lists/${list.id}`, ALICE)).status).toBe(404);
  });

  it("keeps people's lists apart: Bob gets 404 for everything of Alice's", async () => {
    const list = (await (await call('POST', '/api/lists', ALICE, { name: 'Alice only', items: [{ query: 'eggs' }] })).json()) as ListBody;

    expect(((await (await call('GET', '/api/lists', BOB)).json()) as { lists: unknown[] }).lists).toEqual([]);
    expect((await call('GET', `/api/lists/${list.id}`, BOB)).status).toBe(404);
    expect((await call('PUT', `/api/lists/${list.id}`, BOB, { name: 'hacked', items: [] })).status).toBe(404);
    expect((await call('POST', `/api/lists/${list.id}/prices`, BOB, {})).status).toBe(404);
    expect((await call('DELETE', `/api/lists/${list.id}`, BOB)).status).toBe(404);

    const still = (await (await call('GET', `/api/lists/${list.id}`, ALICE)).json()) as ListBody;
    expect(still.name).toBe('Alice only');
    await call('DELETE', `/api/lists/${list.id}`, ALICE);
  });

  it('checks list bodies and reports every problem', async () => {
    const response = await call('POST', '/api/lists', ALICE, { name: '', items: [{ query: 'milk', itemId: 'x' }, { quantity: 0 }], color: 'red' });
    expect(response.status).toBe(400);
    const fields = ((await response.json()) as { error: { details: Array<{ field: string }> } }).error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['color', 'name', 'items[0]', 'items[1].quantity']));
  });

  it('refuses to price an empty list, and refuses "items" in the pricing body', async () => {
    const empty = (await (await call('POST', '/api/lists', ALICE, { name: 'Empty' })).json()) as ListBody;
    expect((await call('POST', `/api/lists/${empty.id}/prices`, ALICE, {})).status).toBe(400);
    await call('PUT', `/api/lists/${empty.id}`, ALICE, { name: 'Empty', items: [{ query: 'milk' }] });
    expect((await call('POST', `/api/lists/${empty.id}/prices`, ALICE, { items: [{ query: 'x' }] })).status).toBe(400);
    await call('DELETE', `/api/lists/${empty.id}`, ALICE);
  });

  it(`stops at ${MAX_SAVED_LISTS} lists per person`, async () => {
    const ids: string[] = [];
    for (let i = 0; i < MAX_SAVED_LISTS; i += 1) {
      ids.push(((await (await call('POST', '/api/lists', BOB, { name: `List ${i}` })).json()) as ListBody).id);
    }
    expect((await call('POST', '/api/lists', BOB, { name: 'One too many' })).status).toBe(400);
    for (const id of ids) await call('DELETE', `/api/lists/${id}`, BOB);
  });

  it('treats odd ids and paths as not found, and wrong methods as 405', async () => {
    expect((await call('GET', '/api/lists/not-a-uuid', ALICE)).status).toBe(404);
    expect((await call('GET', '/api/lists/aaaaaaaa-0000-4000-8000-000000000000/other', ALICE)).status).toBe(404);
    expect((await call('PATCH', '/api/lists', ALICE)).status).toBe(405);
  });

  it('never logs the login token or a location', async () => {
    const list = (await (await call('POST', '/api/lists', ALICE, { name: 'Log check', items: [{ query: 'milk' }] })).json()) as ListBody;
    await call('POST', `/api/lists/${list.id}/prices`, ALICE, { near: { lat: 49.2468135, lng: -123.1357924, radiusKm: 5 } });
    await call('DELETE', `/api/lists/${list.id}`, ALICE);

    const logged = JSON.stringify(requestLog) + errorLog.map(String).join('\n');
    expect(requestLog.length).toBeGreaterThan(0);
    expect(logged).not.toContain(tokens.get(ALICE) ?? 'missing');
    expect(logged).not.toContain('Bearer');
    for (const secret of SECRET_TEXTS) expect(logged).not.toContain(secret);
  });
});
