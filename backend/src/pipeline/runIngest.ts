import type { StoreConnector } from '../connectors/types';
import type { FinalRepository } from '../db/final';
import type { StoreDataRepository } from '../db/storeData';
import type { Chain } from '../types';
import { combine } from './combine';
import { recordsFromItems } from './storeRecords';
import type { CombineResult, StoreRecord } from './types';

export interface IngestOptions {
  connectors: StoreConnector[];
  /** The per-store layer. */
  storeData: StoreDataRepository;
  /** The final layer. */
  final: FinalRepository;
  /** Run everything and report, but save nothing. */
  dryRun?: boolean;
  /** Only run this chain's connector. */
  chainSlug?: string;
  /** Clock to stamp records with. Tests pass a fixed one. */
  now?: () => Date;
}

export interface IngestResult {
  dryRun: boolean;
  /** The chains that were fetched successfully. */
  chains: Chain[];
  scraped: Array<{ chainSlug: string; count: number }>;
  /** Connectors (or their locations) that threw. The other connectors still ran. */
  failures: Array<{ chainSlug: string; error: string }>;
  savedStoreRecords: number;
  /** How many fetched items came without the store's original data. Connectors should set `original` on every item. */
  missingOriginal: number;
  savedItems: number;
  combine: CombineResult;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The whole pipeline in one call:
 *   connectors -> per-store layer -> combine step -> final layer
 *
 * One connector failing doesn't stop the others. The combine step runs on what
 * the per-store layer holds after saving, so it always works on saved data.
 */
export async function runIngest(options: IngestOptions): Promise<IngestResult> {
  const { connectors, storeData, final, dryRun = false, chainSlug, now = () => new Date() } = options;

  const selected =
    chainSlug === undefined ? connectors : connectors.filter((connector) => connector.chain.slug === chainSlug);
  if (selected.length === 0) {
    const known = connectors.map((connector) => connector.chain.slug).join(', ');
    throw new Error(`No connector for chain "${chainSlug}". Known chains: ${known}`);
  }

  const scrapedAt = now().toISOString();
  const scraped: IngestResult['scraped'] = [];
  const failures: IngestResult['failures'] = [];
  const fetched: StoreRecord[] = [];
  const succeeded: StoreConnector[] = [];
  let savedStoreRecords = 0;

  for (const connector of selected) {
    const slug = connector.chain.slug;
    try {
      const items = await connector.fetchItems();
      const records = recordsFromItems(slug, items, scrapedAt);
      if (!dryRun) savedStoreRecords += await storeData.saveRecords(slug, records);
      fetched.push(...records);
      scraped.push({ chainSlug: slug, count: items.length });
      succeeded.push(connector);
    } catch (error) {
      failures.push({ chainSlug: slug, error: messageOf(error) });
    }
  }

  const missingOriginal = fetched.filter((record) => record.original === undefined).length;

  const chains = succeeded.map((connector) => connector.chain);
  const toCombine = dryRun
    ? fetched
    : (await Promise.all(succeeded.map((connector) => storeData.loadRecords(connector.chain.slug)))).flat();
  const combined = combine(chains, toCombine);

  let savedItems = 0;
  if (!dryRun) {
    await final.upsertChains(chains);
    for (const connector of succeeded) {
      try {
        const locations = await connector.fetchLocations?.();
        if (locations !== undefined) await final.upsertLocations(locations);
      } catch (error) {
        failures.push({ chainSlug: connector.chain.slug, error: `locations: ${messageOf(error)}` });
      }
    }
    savedItems = await final.upsertItems(combined.items);
  }

  return { dryRun, chains, scraped, failures, savedStoreRecords, missingOriginal, savedItems, combine: combined };
}
