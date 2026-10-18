import type { StoreRecord } from '../pipeline/types';

/**
 * The per-store layer: everything the connectors scraped, kept as scraped,
 * one table per store. It is private. The website never reads it, and only
 * backend scripts (with the admin key) write to it.
 */
export interface StoreDataRepository {
  /**
   * Save records for one chain. A record with a `sku` that already exists
   * replaces the old one. Returns how many records were saved.
   */
  saveRecords(chainSlug: string, records: StoreRecord[]): Promise<number>;

  /** Every record saved for one chain. */
  loadRecords(chainSlug: string): Promise<StoreRecord[]>;
}

/**
 * The per-store table for a chain: the slug with "-" turned into "_", in the private "raw"
 * schema. "real-canadian-superstore" is raw.real_canadian_superstore. Matches sql/draft-schema.sql.
 */
export function rawTableName(chainSlug: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(chainSlug)) throw new Error(`Invalid chain slug: "${chainSlug}"`);
  return `raw.${chainSlug.replaceAll('-', '_')}`;
}
