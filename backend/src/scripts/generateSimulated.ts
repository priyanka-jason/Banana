/**
 * Write the simulated Lower Mainland data to backend/docs/simulated/, for the
 * website team to use as mock data.
 *
 *   npm run simulate
 *
 * It only adds or overwrites the files it makes. It never deletes anything.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSimulatedFiles } from '../simulated/exportData';

async function main(): Promise<void> {
  const directory = fileURLToPath(new URL('../../docs/simulated/', import.meta.url));
  mkdirSync(directory, { recursive: true });

  const files = await buildSimulatedFiles();
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(`${directory}${name}`, `${JSON.stringify(body, null, 2)}\n`);
  }
  console.log(`Wrote ${Object.keys(files).length} files to backend/docs/simulated/`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
