/**
 * Run the whole pipeline with the sample connectors, kept in memory.
 *
 *   npm run ingest                      run everything and print a summary
 *   npm run ingest -- --dry-run         same, but save nothing
 *   npm run ingest -- --chain walmart   only one store
 *   npm run ingest -- --rows 10         show 10 sample rows (default 5)
 *
 * Nothing is saved anywhere permanent yet: the in-memory repositories are
 * thrown away when the script ends. Supabase versions come later.
 */
import { sampleConnectors } from '../connectors';
import { MemoryFinal, MemoryStoreData } from '../db/memory';
import { runIngest } from '../pipeline/runIngest';
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
    console.log('Usage: npm run ingest -- [--dry-run] [--chain <slug>] [--rows <number>]');
    return;
  }

  const rowsText = readOption(args, '--rows');
  const rows = rowsText === undefined ? 5 : Number(rowsText);
  if (!Number.isInteger(rows) || rows < 0) throw new Error('--rows must be a whole number, 0 or more');

  const result = await runIngest({
    connectors: sampleConnectors,
    storeData: new MemoryStoreData(),
    final: new MemoryFinal(),
    dryRun: args.includes('--dry-run'),
    chainSlug: readOption(args, '--chain'),
  });

  console.log(formatIngestSummary(result, { sampleRows: rows }));
  if (result.failures.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
