/**
 * Run the API locally, on made-up data kept in memory.
 *
 *   npm run api                 the simulated Lower Mainland chains (default)
 *   npm run api -- --sample     the small hand-written sample set instead
 *   PORT=9000 npm run api       another port (default 8787)
 *
 * It only listens on 127.0.0.1, so other machines can't reach it. The website's Vite dev
 * proxy finds it with API_PROXY_TARGET=http://127.0.0.1:8787. Stop it with Ctrl+C.
 */
import { createBackend } from '../app';
import { startServer } from './server';

const DEFAULT_PORT = 8787;

function readPort(text: string | undefined): number {
  if (text === undefined || text === '') return DEFAULT_PORT;
  const port = Number(text);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`PORT must be a whole number from 0 to 65535, not "${text}"`);
  return port;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: [PORT=8787] npm run api -- [--sample]');
    return;
  }

  const source = args.includes('--sample') ? 'sample' : 'simulated';
  const port = readPort(process.env['PORT']);
  const { prices, ingest } = await createBackend({ source });
  for (const failure of ingest.failures) console.error(`Could not load ${failure.chainSlug}: ${failure.error}`);
  console.log(`Loaded ${ingest.savedItems} ${source} items from ${ingest.chains.length} chains.`);

  const running = await startServer({ prices, port });
  console.log(`Banana API listening on ${running.url}/api (Ctrl+C to stop)`);

  const stop = (): void => {
    running.close().finally(() => process.exit(0));
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
