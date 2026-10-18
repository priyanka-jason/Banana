/**
 * Run the whole pipeline with the sample connectors, kept in memory.
 *
 *   npm run ingest                      run everything and print a summary
 *   npm run ingest -- --dry-run         same, but save nothing
 *   npm run ingest -- --chain walmart   only one store
 *   npm run ingest -- --rows 10         show 10 sample rows (default 5)
 *   npm run ingest -- --simulated       use the simulated Lower Mainland chains instead
 *   npm run ingest -- --database        save to the database in DATABASE_URL (backend/.env)
 *
 * Without --database nothing is saved anywhere permanent: the in-memory layers are
 * thrown away when the script ends. With --database it writes to raw.<chain> and the
 * banana tables (sql/supabase-setup.sql must have been run there first).
 */
import { sampleConnectors } from '../connectors';
import { fileURLToPath } from 'node:url';
import type { FinalRepository } from '../db/final';
import { MemoryFinal, MemoryStoreData } from '../db/memory';
import { createPool, PostgresFinal, PostgresStoreData, poolOptionsFromEnv } from '../db/postgres';
import type { StoreDataRepository } from '../db/storeData';
import { runIngest } from '../pipeline/runIngest';
import { SIMULATED_CATEGORY_MAP, simulatedConnectors } from '../simulated/generate';
import { formatIngestSummary } from '../pipeline/summary';

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} needs a value`);
  return value;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log('Usage: npm run ingest -- [--dry-run] [--simulated] [--database] [--chain <slug>] [--rows <number>]');
    return;
  }

  const rowsText = readOption(args, '--rows');
  const rows = rowsText === undefined ? 5 : Number(rowsText);
  if (!Number.isInteger(rows) || rows < 0) throw new Error('--rows must be a whole number, 0 or more');

  const simulated = args.includes('--simulated');

  let storeData: StoreDataRepository = new MemoryStoreData();
  let final: FinalRepository = new MemoryFinal();
  let close = async (): Promise<void> => undefined;
  if (args.includes('--database')) {
    try {
      process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
    } catch {
      // No .env file; DATABASE_URL may still be set in the environment.
    }
    const options = poolOptionsFromEnv();
    if (options === undefined) throw new Error('--database needs DATABASE_URL (in backend/.env or the environment)');
    const pool = createPool(options);
    storeData = new PostgresStoreData(pool);
    final = new PostgresFinal(pool);
    close = () => pool.end();
    console.log('Saving to the database in DATABASE_URL.');
  }

  let result;
  try {
    result = await runIngest({
      connectors: simulated ? simulatedConnectors : sampleConnectors,
      categoryMap: simulated ? SIMULATED_CATEGORY_MAP : undefined,
      storeData,
      final,
      dryRun: args.includes('--dry-run'),
      chainSlug: readOption(args, '--chain'),
    });
  } finally {
    await close();
  }
  console.log(formatIngestSummary(result, { sampleRows: rows }));
  if (result.failures.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
