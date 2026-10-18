import { sampleConnectors } from './connectors';
import type { FinalRepository } from './db/final';
import { MemoryFinal, MemoryStoreData } from './db/memory';
import { MemoryPriceRepository } from './db/memoryReader';
import type { PriceRepository } from './db/repository';
import type { StoreDataRepository } from './db/storeData';
import { runIngest, type IngestResult } from './pipeline/runIngest';
import { SIMULATED_CATEGORY_MAP, simulatedConnectors } from './simulated/generate';

/**
 * Which made-up data to load:
 * - 'simulated': the five Lower Mainland chains in docs/simulated (the default for the website)
 * - 'sample': the small hand-written sample set in src/connectors/sample
 */
export type DataSource = 'simulated' | 'sample';

export interface BackendOptions {
  source?: DataSource;
  /** Clock to stamp records with. Tests pass a fixed one. */
  now?: () => Date;
}

export interface Backend {
  /** The read side the API handlers use. */
  prices: PriceRepository;
  /** What the ingest run did, so a caller can report failures. */
  ingest: IngestResult;
}

/**
 * Puts the pieces together: connectors -> runIngest -> per-store and final layers -> PriceRepository.
 *
 * Today both layers live in memory and are rebuilt every time the backend starts.
 * Everything past this function only sees the interfaces (StoreDataRepository,
 * FinalRepository, PriceRepository), so swapping storage only touches this file.
 */
export async function createBackend(options: BackendOptions = {}): Promise<Backend> {
  const source = options.source ?? 'simulated';

  // SUPABASE GOES HERE: a later version builds Supabase-backed StoreDataRepository and
  // FinalRepository (writing to raw.<chain> and public tables) and a PriceRepository that
  // reads the public tables with the limited key, instead of these in-memory ones.
  // The website server would then only read, and ingest would run as its own job.
  const storeData: StoreDataRepository = new MemoryStoreData();
  const memoryFinal = new MemoryFinal();
  const final: FinalRepository = memoryFinal;
  const prices: PriceRepository = new MemoryPriceRepository(memoryFinal);

  const ingest = await runIngest({
    connectors: source === 'simulated' ? simulatedConnectors : sampleConnectors,
    categoryMap: source === 'simulated' ? SIMULATED_CATEGORY_MAP : undefined,
    storeData,
    final,
    now: options.now,
  });

  return { prices, ingest };
}
