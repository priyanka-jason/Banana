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
