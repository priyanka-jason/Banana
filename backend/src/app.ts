import { sampleConnectors } from './connectors';
import type { FinalRepository } from './db/final';
import { MemoryFinal, MemoryStoreData } from './db/memory';
import { MemoryPriceRepository } from './db/memoryReader';
import { CachedFinalSource, createPool, PostgresFinal, type PoolOptions } from './db/postgres';
import type { PriceRepository } from './db/repository';
import type { StoreDataRepository } from './db/storeData';
import { MemoryListRepository, type ListRepository } from './lists/lists';
import { PostgresListRepository } from './lists/postgresLists';
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
  /**
   * Saved shopping lists. In memory here, so they are lost when the server stops;
   * createDatabaseBackend keeps them in banana.shopping_lists.
   */
  lists: ListRepository;
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

  // For the database (Supabase) instead, see createDatabaseBackend below.
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

  return { prices, ingest, lists: new MemoryListRepository({ now: options.now }) };
}

export interface DatabaseBackend {
  prices: PriceRepository;
  lists: ListRepository;
  /** Closes the database connections. */
  close(): Promise<void>;
}

/**
 * The same pieces, backed by the database (Supabase) instead of memory. Nothing is loaded at
 * start: prices are whatever ingest last wrote to the banana tables (npm run ingest --
 * --simulated --database), read through a 60-second cache. Saved lists live in
 * banana.shopping_lists, so they survive restarts.
 */
export function createDatabaseBackend(options: PoolOptions): DatabaseBackend {
  const pool = createPool(options);
  return {
    prices: new MemoryPriceRepository(new CachedFinalSource(new PostgresFinal(pool))),
    lists: new PostgresListRepository(pool),
    close: () => pool.end(),
  };
}
