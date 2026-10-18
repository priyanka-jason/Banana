import { handleCategories, handleChains, handleStores } from '../api/handlers';
import { MemoryFinal, MemoryStoreData } from '../db/memory';
import { MemoryPriceRepository } from '../db/memoryReader';
import { runIngest } from '../pipeline/runIngest';
import type { MemberPricing, PriceRow } from '../types';
import { SIMULATED_CATEGORY_MAP, simulatedConnectors } from './generate';

/** "Updated Oct 17, 2026 at 6:00 AM" Vancouver time, fixed so the files are the same every run. */
export const SIMULATED_TIME = new Date('2026-10-17T13:00:00.000Z');

/** Run the whole pipeline on the simulated chains and give back a read repository over the result. */
export async function loadSimulated(): Promise<MemoryPriceRepository> {
  const final = new MemoryFinal();
  const result = await runIngest({
    connectors: simulatedConnectors,
    storeData: new MemoryStoreData(),
    final,
    categoryMap: SIMULATED_CATEGORY_MAP,
    now: () => SIMULATED_TIME,
  });
  if (result.failures.length > 0) throw new Error(`Simulated ingest failed: ${JSON.stringify(result.failures)}`);
  return new MemoryPriceRepository(final);
}

async function allRows(repo: MemoryPriceRepository, memberPricing: MemberPricing): Promise<PriceRow[]> {
  const rows: PriceRow[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await repo.searchPrices({ sortBy: 'name', limit: 100, offset, memberPricing });
    rows.push(...page.rows);
    if (rows.length >= page.total || page.rows.length === 0) return rows;
  }
}

/**
 * Every file for backend/docs/simulated/, keyed by file name. Each holds the
 * same JSON body the matching API endpoint would send.
 */
export async function buildSimulatedFiles(): Promise<Record<string, unknown>> {
  const repo = await loadSimulated();
  const [chains, categories, stores] = await Promise.all([
    handleChains(repo),
    handleCategories(),
    handleStores(repo, {}),
  ]);
  return {
    'chains.json': chains.body,
    'categories.json': categories.body,
    'stores.json': stores.body,
    'prices.json': {
      note: 'SIMULATED data for the hackathon demo. Not real prices. Same shape as PriceRow in docs/api-contract.md.',
      updatedAt: SIMULATED_TIME.toISOString(),
      rows: await allRows(repo, 'non-member'),
    },
  };
}
