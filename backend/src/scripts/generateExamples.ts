/**
 * Write the sample API requests and responses to backend/docs/examples/.
 *
 *   npm run examples
 *
 * It only adds or overwrites the files it makes. It never deletes anything, so if an
 * example is renamed or removed in the code, delete its old file by hand (a test
 * will tell you which file is left over).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildExamples } from '../api/examples';

async function main(): Promise<void> {
  const directory = fileURLToPath(new URL('../../docs/examples/', import.meta.url));
  mkdirSync(directory, { recursive: true });

  const examples = await buildExamples();
  for (const [name, file] of Object.entries(examples)) {
    writeFileSync(`${directory}${name}`, `${JSON.stringify(file, null, 2)}\n`);
  }
  console.log(`Wrote ${Object.keys(examples).length} example files to backend/docs/examples/`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
