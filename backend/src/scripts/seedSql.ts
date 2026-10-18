/**
 * Write a SQL file that loads the simulated data into Supabase.
 *
 *   npm run seed-sql                 writes backend/out/seed-simulated.sql
 *
 * Then paste that file into the Supabase SQL Editor and run it (after sql/supabase-setup.sql).
 * backend/out/ is ignored by git, so the generated file is never committed.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MemoryFinal, MemoryStoreData } from '../db/memory';
import { buildSeedSql } from '../db/seedSql';
import { runIngest } from '../pipeline/runIngest';
import { SIMULATED_TIME } from '../simulated/exportData';
import { SIMULATED_CATEGORY_MAP, simulatedConnectors } from '../simulated/generate';

async function main(): Promise<void> {
  const storeData = new MemoryStoreData();
  const final = new MemoryFinal();
  const result = await runIngest({
    connectors: simulatedConnectors,
    categoryMap: SIMULATED_CATEGORY_MAP,
    storeData,
    final,
    now: () => SIMULATED_TIME,
  });
  if (result.failures.length > 0) throw new Error(`Ingest failed: ${JSON.stringify(result.failures)}`);

  const chains = await final.listChains();
  const records = (await Promise.all(chains.map((chain) => storeData.loadRecords(chain.slug)))).flat();
  const sql = buildSeedSql({
    title: 'Banana: SIMULATED data for the five Lower Mainland chains. Made-up prices, not real ones.',
    chains,
    locations: await final.listLocations(),
    records,
    items: await final.listItems(),
  });

  const directory = fileURLToPath(new URL('../../out/', import.meta.url));
  mkdirSync(directory, { recursive: true });
  const file = `${directory}seed-simulated.sql`;
  writeFileSync(file, sql);
  console.log(`Wrote backend/out/seed-simulated.sql (${Math.round(Buffer.byteLength(sql) / 1024)} KB)`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
