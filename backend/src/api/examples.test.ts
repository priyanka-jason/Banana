import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildExamples, type ExampleFile } from './examples';

const DIRECTORY = fileURLToPath(new URL('../../docs/examples/', import.meta.url));

describe('the sample API responses in backend/docs/examples', () => {
  it('match what the real code produces (run "npm run examples" to refresh them)', async () => {
    const examples = await buildExamples();
    for (const [name, file] of Object.entries(examples)) {
      const onDisk = readFileSync(`${DIRECTORY}${name}`, 'utf8');
      expect(onDisk, name).toBe(`${JSON.stringify(file, null, 2)}\n`);
    }
  });

  it('have no leftover files that the code no longer produces', async () => {
    const expected = Object.keys(await buildExamples()).sort();
    expect(readdirSync(DIRECTORY).sort()).toEqual(expected);
  });

  it('each describe the request and the response', async () => {
    for (const [name, file] of Object.entries(await buildExamples())) {
      expect(file.description.length, name).toBeGreaterThan(20);
      expect(['GET', 'POST'], name).toContain(file.request.method);
      expect(file.request.path.startsWith('/api/'), name).toBe(true);
      expect(file.response.status, name).toBeGreaterThanOrEqual(200);
    }
  });

  it('use the error shape for every failure, and none for successes', async () => {
    for (const [name, file] of Object.entries(await buildExamples())) {
      const body = file.response.body as { error?: { code: string; message: string } };
      if (file.response.status === 200) {
        expect(body.error, name).toBeUndefined();
      } else {
        expect(['invalid_request', 'not_found', 'internal_error'], name).toContain(body.error?.code);
        expect(body.error?.message.length, name).toBeGreaterThan(0);
      }
    }
  });

  it('keep a visitor location out of every URL: it is only ever in a POST body', async () => {
    for (const [name, file] of Object.entries(await buildExamples())) {
      if (file.request.method === 'GET') {
        expect(file.request.path, name).not.toMatch(/lat|lng|latitude|longitude|radius|near/i);
        expect(file.request.path, name).not.toMatch(/49\.28|123\.12/);
      }
    }
  });

  it('show every search result row with the fields the website needs', async () => {
    const examples = await buildExamples();
    const required = ['id', 'name', 'chainName', 'priceCents', 'regularPriceCents', 'packCount', 'pricedByWeight', 'scrapedAt'];
    let rowsChecked = 0;

    for (const name of Object.keys(examples).filter((key) => key.startsWith('search-') && !key.includes('invalid'))) {
      const file: ExampleFile | undefined = examples[name];
      const rows = (file?.response.body as { rows: Array<Record<string, unknown>> }).rows;
      for (const row of rows) {
        for (const key of required) expect(row, `${name} ${String(row['id'])}`).toHaveProperty(key);
        rowsChecked += 1;
      }
    }
    expect(rowsChecked).toBeGreaterThan(15);
  });

  it('include a request that shows the invalid-request error with several problems', async () => {
    const file = (await buildExamples())['search-invalid.json'];
    const error = (file?.response.body as { error: { code: string; details: unknown[] } }).error;

    expect(file?.response.status).toBe(400);
    expect(error.code).toBe('invalid_request');
    expect(error.details.length).toBeGreaterThan(2);
  });
});
