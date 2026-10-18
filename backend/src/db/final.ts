import type { FinalItem } from '../pipeline/types';
import type { Chain, StoreLocation } from '../types';

/**
 * The write side of the final layer. Only the combine step uses it, with the
 * admin key. The website reads the same data through PriceRepository, with the
 * limited key, and can never write.
 */
export interface FinalRepository {
  /** Save chains. A chain with a `slug` that already exists is updated. */
  upsertChains(chains: Chain[]): Promise<void>;

  /** Save store locations. A location with an `id` that already exists is updated. */
  upsertLocations(locations: StoreLocation[]): Promise<void>;

  /** Save items. An item with an `id` that already exists is updated. Returns how many were saved. */
  upsertItems(items: FinalItem[]): Promise<number>;

  /** Everything saved so far. For checks and summaries, not for the website. */
  listItems(): Promise<FinalItem[]>;
}
