import type { FinalItem } from '../pipeline/types';
import { findItems, searchFinal, storesWithinRadius, type SearchData } from '../search/search';
import { priceShoppingList } from '../search/shoppingList';
import type {
  Chain,
  MemberPricing,
  NearbyStore,
  PriceFilters,
  PriceRow,
  PriceSearchResult,
  ShoppingListRequest,
  ShoppingListResult,
  StoreLocation,
} from '../types';
import type { PriceRepository } from './repository';

/** Where the data comes from. MemoryFinal (the final layer kept in memory) fits this. */
export interface FinalSource {
  listItems(): Promise<FinalItem[]>;
  listChains(): Promise<Chain[]>;
  listLocations(): Promise<StoreLocation[]>;
}

/**
 * The read side kept in memory: reads whatever the final layer holds right now,
 * so data saved after this was created shows up too. For tests, for local work
 * and for the sample responses. A database version replaces it later.
 */
export class MemoryPriceRepository implements PriceRepository {
  private readonly source: FinalSource;

  constructor(source: FinalSource) {
    this.source = source;
  }

  private async load(): Promise<SearchData> {
    const [items, chains, locations] = await Promise.all([
      this.source.listItems(),
      this.source.listChains(),
      this.source.listLocations(),
    ]);
    return { items, chains, locations };
  }

  async searchPrices(filters?: PriceFilters): Promise<PriceSearchResult> {
    return searchFinal(await this.load(), filters);
  }

  async getItems(ids: readonly string[], options: { memberPricing?: MemberPricing } = {}): Promise<PriceRow[]> {
    return findItems(await this.load(), ids, options.memberPricing);
  }

  async priceShoppingList(request: ShoppingListRequest): Promise<ShoppingListResult> {
    return priceShoppingList(await this.load(), request);
  }

  async listChains(): Promise<Chain[]> {
    const chains = await this.source.listChains();
    return [...chains].sort((a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug));
  }

  async listStoreLocations(options: { chainSlugs?: readonly string[] } = {}): Promise<StoreLocation[]> {
    const locations = await this.source.listLocations();
    const wanted = options.chainSlugs !== undefined && options.chainSlugs.length > 0 ? new Set(options.chainSlugs) : undefined;
    return locations
      .filter((location) => wanted === undefined || wanted.has(location.chainSlug))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  async storesWithinRadius(
    lat: number,
    lng: number,
    radiusKm: number,
    options: { chainSlugs?: readonly string[] } = {},
  ): Promise<NearbyStore[]> {
    return storesWithinRadius(await this.source.listLocations(), lat, lng, radiusKm, options.chainSlugs);
  }
}
