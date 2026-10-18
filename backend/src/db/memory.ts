import type { FinalItem, StoreRecord } from '../pipeline/types';
import type { Chain, StoreLocation } from '../types';
import type { FinalRepository } from './final';
import type { StoreDataRepository } from './storeData';

/**
 * Copy a value by turning it into JSON and back. The real database stores
 * JSON, so this makes the in-memory version behave the same way: fields that
 * are `undefined` disappear, and callers can't change saved data by accident.
 */
function jsonCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** The per-store layer kept in memory. For tests and for running without a database. */
export class MemoryStoreData implements StoreDataRepository {
  private readonly tables = new Map<string, Map<string, StoreRecord>>();

  async saveRecords(chainSlug: string, records: StoreRecord[]): Promise<number> {
    for (const record of records) {
      if (record.chainSlug !== chainSlug) {
        throw new Error(`Record ${record.sku} belongs to "${record.chainSlug}", not "${chainSlug}"`);
      }
    }
    const table = this.tables.get(chainSlug) ?? new Map<string, StoreRecord>();
    this.tables.set(chainSlug, table);
    for (const record of records) table.set(record.sku, jsonCopy(record));
    return records.length;
  }

  async loadRecords(chainSlug: string): Promise<StoreRecord[]> {
    return [...(this.tables.get(chainSlug)?.values() ?? [])].map((record) => jsonCopy(record));
  }
}

/** The final layer kept in memory. For tests and for running without a database. */
export class MemoryFinal implements FinalRepository {
  private readonly chains = new Map<string, Chain>();
  private readonly locations = new Map<string, StoreLocation>();
  private readonly items = new Map<string, FinalItem>();

  async upsertChains(chains: Chain[]): Promise<void> {
    for (const chain of chains) this.chains.set(chain.slug, jsonCopy(chain));
  }

  async saveChainLocations(chainSlug: string, locations: StoreLocation[]): Promise<void> {
    for (const location of locations) {
      if (location.chainSlug !== chainSlug) throw new Error(`Store ${location.id} belongs to "${location.chainSlug}", not "${chainSlug}"`);
    }
    if (locations.length === 0) return;
    const keep = new Set(locations.map((location) => location.id));
    for (const [id, location] of this.locations) {
      if (location.chainSlug === chainSlug && !keep.has(id)) this.locations.delete(id);
    }
    for (const location of locations) this.locations.set(location.id, jsonCopy(location));
  }

  async upsertItems(items: FinalItem[]): Promise<number> {
    for (const item of items) this.items.set(item.id, jsonCopy(item));
    return items.length;
  }

  async listItems(): Promise<FinalItem[]> {
    return [...this.items.values()].map((item) => jsonCopy(item));
  }

  /** Saved chains. Extra to the interface, for tests and summaries. */
  async listChains(): Promise<Chain[]> {
    return [...this.chains.values()].map((chain) => jsonCopy(chain));
  }

  /** Saved store locations. Extra to the interface, for tests and summaries. */
  async listLocations(): Promise<StoreLocation[]> {
    return [...this.locations.values()].map((location) => jsonCopy(location));
  }
}
