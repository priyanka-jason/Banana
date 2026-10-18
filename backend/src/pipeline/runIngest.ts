import type { FetchResult, SkippedItem, StoreConnector } from '../connectors/types';
import type { FinalRepository } from '../db/final';
import type { StoreDataRepository } from '../db/storeData';
import type { Chain } from '../types';
import type { CategoryMap } from './categoryMap';
import { combine } from './combine';
import { recordsFromItems } from './storeRecords';
import type { CombineResult, StoreRecord } from './types';

/** Only warn about a drop in item count when there were at least this many items last time. */
const MIN_ITEMS_FOR_DROP_WARNING = 5;
/** Warn when this share (or more) of a store's items had to be skipped. */
const MOSTLY_SKIPPED_SHARE = 0.5;
const DEFAULT_DROP_WARNING_RATIO = 0.5;

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
  /**
   * Warn when a store returns fewer than this share of the items it returned last run.
   * Default 0.5, so a store that drops from 100 items to 49 gets a warning.
   */
  dropWarningRatio?: number;
  /** Clock to stamp records with. Tests pass a fixed one. */
  now?: () => Date;
  /** Store category name to shared category. Default: the hand-checked CATEGORY_MAP. */
  categoryMap?: CategoryMap;
}

export interface IngestResult {
  dryRun: boolean;
  /** The chains that were fetched successfully. */
  chains: Chain[];
  /** Per chain, how many usable items came back (items that were skipped are not counted). */
  scraped: Array<{ chainSlug: string; count: number }>;
  /**
   * Connectors (or their locations) that failed. A connector that returns no items also counts
   * as failed: that usually means the site blocked us or changed its layout.
   * The other connectors still ran.
   */
  failures: Array<{ chainSlug: string; error: string }>;
  /** Items a connector skipped (bad price, garbled date...). The rest of the store still went through. */
  skipped: Array<SkippedItem & { chainSlug: string }>;
  /** Things that look wrong but didn't stop the run, like a store returning far fewer items than last time. */
  warnings: Array<{ chainSlug: string; message: string }>;
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
 * How many items the last run saved for a store. Every record from one run
 * shares one timestamp, so this is the number of records with the newest timestamp.
 */
function lastRunCount(records: StoreRecord[]): number {
  let newest = '';
  for (const record of records) if (record.scrapedAt > newest) newest = record.scrapedAt;
  return records.filter((record) => record.scrapedAt === newest).length;
}

async function fetchFrom(connector: StoreConnector): Promise<FetchResult> {
  return connector.fetchResult !== undefined
    ? connector.fetchResult()
    : { items: await connector.fetchItems(), skipped: [] };
}

/**
 * The whole pipeline in one call:
 *   connectors -> per-store layer -> combine step -> final layer
 *
 * One connector failing doesn't stop the others. A bad item doesn't fail its store: it is
 * skipped and reported. A store that returns nothing is a failure. The combine step runs
 * on what the per-store layer holds after saving, so it always works on saved data.
 */
export async function runIngest(options: IngestOptions): Promise<IngestResult> {
  const {
    connectors,
    storeData,
    final,
    dryRun = false,
    chainSlug,
    dropWarningRatio = DEFAULT_DROP_WARNING_RATIO,
    now = () => new Date(),
    categoryMap,
  } = options;

  const selected =
    chainSlug === undefined ? connectors : connectors.filter((connector) => connector.chain.slug === chainSlug);
  if (selected.length === 0) {
    const known = connectors.map((connector) => connector.chain.slug).join(', ');
    throw new Error(`No connector for chain "${chainSlug}". Known chains: ${known}`);
  }

  const scrapedAt = now().toISOString();
  const scraped: IngestResult['scraped'] = [];
  const failures: IngestResult['failures'] = [];
  const skippedAll: IngestResult['skipped'] = [];
  const warnings: IngestResult['warnings'] = [];
  const fetched: StoreRecord[] = [];
  const succeeded: StoreConnector[] = [];
  let savedStoreRecords = 0;

  for (const connector of selected) {
    const slug = connector.chain.slug;
    try {
      const { items, skipped } = await fetchFrom(connector);
      for (const entry of skipped) skippedAll.push({ chainSlug: slug, ...entry });

      if (items.length === 0) {
        failures.push({
          chainSlug: slug,
          error:
            skipped.length > 0
              ? `all ${skipped.length} items were skipped. First problem: ${skipped[0]?.reason ?? 'unknown'}`
              : 'returned no items (the site may have blocked us or changed its layout)',
        });
        continue;
      }

      const previous = lastRunCount(await storeData.loadRecords(slug));
      if (previous >= MIN_ITEMS_FOR_DROP_WARNING && items.length < previous * dropWarningRatio) {
        warnings.push({ chainSlug: slug, message: `only ${items.length} items this time, down from ${previous} last run` });
      }
      const total = items.length + skipped.length;
      if (skipped.length > 0 && skipped.length / total >= MOSTLY_SKIPPED_SHARE) {
        warnings.push({
          chainSlug: slug,
          message: `${skipped.length} of ${total} items were skipped, so the site's format may have changed`,
        });
      }

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
  const combined = combine(chains, toCombine, categoryMap);

  let savedItems = 0;
  if (!dryRun) {
    await final.upsertChains(chains);
    for (const connector of succeeded) {
      try {
        const locations = await connector.fetchLocations?.();
        if (locations !== undefined) await final.saveChainLocations(connector.chain.slug, locations);
      } catch (error) {
        failures.push({ chainSlug: connector.chain.slug, error: `locations: ${messageOf(error)}` });
      }
    }
    savedItems = await final.upsertItems(combined.items);
  }

  return {
    dryRun,
    chains,
    scraped,
    failures,
    skipped: skippedAll,
    warnings,
    savedStoreRecords,
    missingOriginal,
    savedItems,
    combine: combined,
  };
}
