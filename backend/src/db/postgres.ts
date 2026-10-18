import { readFileSync } from 'node:fs';
import pg from 'pg';
import type { FinalItem, StoreRecord } from '../pipeline/types';
import type { Chain, StoreLocation } from '../types';
import type { FinalRepository } from './final';
import type { FinalSource } from './memoryReader';
import { rawTableName, type StoreDataRepository } from './storeData';

/**
 * The storage pieces backed by Postgres: the Supabase database, reached with its
 * connection string (DATABASE_URL in backend/.env, never committed). The tables are the
 * ones from sql/supabase-setup.sql: raw.<chain> for the per-store layer and banana.* for
 * the final layer.
 *
 * Every write sends a whole batch as one JSON value in one query, so saving hundreds of
 * items is a handful of round trips, not hundreds. Values always travel as query
 * parameters, never pasted into the SQL text.
 */

export type SslMode = 'off' | 'require' | 'verify';

export interface PoolOptions {
  connectionString: string;
  /**
   * off: no encryption (only for a database on this computer).
   * require: encrypted, without checking the server's certificate (the default for remote databases).
   * verify: encrypted and checked against `caFile` (Supabase's CA certificate, from its dashboard).
   */
  ssl?: SslMode;
  caFile?: string;
}

function isLocalHost(connectionString: string): boolean {
  try {
    const host = new URL(connectionString).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  } catch {
    return false;
  }
}

/** A small pool of database connections. Close it with `.end()` when done. */
export function createPool(options: PoolOptions): pg.Pool {
  const mode = options.ssl ?? (isLocalHost(options.connectionString) ? 'off' : 'require');
  let ssl: pg.PoolConfig['ssl'];
  if (mode === 'verify') {
    if (options.caFile === undefined) throw new Error('DATABASE_SSL=verify needs DATABASE_SSL_CA (the path to the CA certificate)');
    ssl = { ca: readFileSync(options.caFile, 'utf8'), rejectUnauthorized: true };
  } else if (mode === 'require') {
    ssl = { rejectUnauthorized: false };
  }
  return new pg.Pool({ connectionString: options.connectionString, ssl, max: 5, idleTimeoutMillis: 30_000 });
}

/** Reads DATABASE_URL, DATABASE_SSL and DATABASE_SSL_CA. Undefined if DATABASE_URL isn't set. */
export function poolOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): PoolOptions | undefined {
  const connectionString = env['DATABASE_URL']?.trim();
  if (!connectionString) return undefined;
  const ssl = env['DATABASE_SSL']?.trim();
  if (ssl !== undefined && ssl !== '' && ssl !== 'off' && ssl !== 'require' && ssl !== 'verify') {
    throw new Error('DATABASE_SSL must be off, require or verify');
  }
  return {
    connectionString,
    ...(ssl ? { ssl: ssl as SslMode } : {}),
    ...(env['DATABASE_SSL_CA']?.trim() ? { caFile: env['DATABASE_SSL_CA'].trim() } : {}),
  };
}

/** raw.<chain> as a safe SQL name. rawTableName() already refuses anything but lowercase letters, digits and dashes. */
function rawTable(chainSlug: string): string {
  const [, table = ''] = rawTableName(chainSlug).split('.');
  if (!/^[a-z0-9_]+$/.test(table)) throw new Error(`Invalid table for chain "${chainSlug}"`);
  return `raw."${table}"`;
}

/** Timestamps and dates come back as text in this exact form, so nothing depends on the server's time zone. */
const ISO_TIME = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const ISO_DATE = (column: string) => `to_char(${column}, 'YYYY-MM-DD')`;

const num = (value: unknown): number | undefined => (value === null || value === undefined ? undefined : Number(value));
const text = (value: unknown): string | undefined => (value === null || value === undefined ? undefined : String(value));

/** The per-store layer in Postgres: one table per chain in the "raw" schema. */
export class PostgresStoreData implements StoreDataRepository {
  constructor(private readonly pool: pg.Pool) {}

  async saveRecords(chainSlug: string, records: StoreRecord[]): Promise<number> {
    for (const record of records) {
      if (record.chainSlug !== chainSlug) throw new Error(`Record ${record.sku} belongs to "${record.chainSlug}", not "${chainSlug}"`);
    }
    if (records.length === 0) return 0;
    const rows = records.map((r) => ({ sku: r.sku, scraped_at: r.scrapedAt, payload: r.payload, original: r.original ?? null }));
    await this.pool.query(
      `insert into ${rawTable(chainSlug)} (sku, scraped_at, payload, original)
       select sku, scraped_at, payload, original
       from jsonb_to_recordset($1::jsonb) as x(sku text, scraped_at timestamptz, payload jsonb, original jsonb)
       on conflict (sku) do update set scraped_at = excluded.scraped_at, payload = excluded.payload, original = excluded.original`,
      [JSON.stringify(rows)],
    );
    return records.length;
  }

  async loadRecords(chainSlug: string): Promise<StoreRecord[]> {
    const result = await this.pool.query<{ sku: string; scraped_at: string; payload: Record<string, unknown>; original: Record<string, unknown> | null }>(
      `select sku, ${ISO_TIME('scraped_at')} as scraped_at, payload, original from ${rawTable(chainSlug)} order by sku`,
    );
    return result.rows.map((row) => ({
      chainSlug,
      sku: row.sku,
      scrapedAt: row.scraped_at,
      payload: row.payload,
      ...(row.original === null ? {} : { original: row.original }),
    }));
  }
}

/** The final layer in Postgres: the "banana" schema. Also a FinalSource, so the read side can use it. */
export class PostgresFinal implements FinalRepository, FinalSource {
  constructor(private readonly pool: pg.Pool) {}

  async upsertChains(chains: Chain[]): Promise<void> {
    if (chains.length === 0) return;
    await this.pool.query(
      `insert into banana.chains (slug, name, parent_company, has_member_pricing)
       select slug, name, parent_company, has_member_pricing
       from jsonb_to_recordset($1::jsonb) as x(slug text, name text, parent_company text, has_member_pricing boolean)
       on conflict (slug) do update set name = excluded.name, parent_company = excluded.parent_company,
         has_member_pricing = excluded.has_member_pricing`,
      [JSON.stringify(chains.map((c) => ({ slug: c.slug, name: c.name, parent_company: c.parentCompany, has_member_pricing: c.hasMemberPricing })))],
    );
  }

  async upsertLocations(locations: StoreLocation[]): Promise<void> {
    if (locations.length === 0) return;
    await this.pool.query(
      `insert into banana.store_locations (id, chain_slug, name, address, city, postal_code, location)
       select id, chain_slug, name, address, city, postal_code,
         extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
       from jsonb_to_recordset($1::jsonb) as x(id text, chain_slug text, name text, address text, city text,
         postal_code text, lat double precision, lng double precision)
       on conflict (id) do update set chain_slug = excluded.chain_slug, name = excluded.name, address = excluded.address,
         city = excluded.city, postal_code = excluded.postal_code, location = excluded.location`,
      [
        JSON.stringify(
          locations.map((l) => ({
            id: l.id,
            chain_slug: l.chainSlug,
            name: l.name,
            address: l.address ?? null,
            city: l.city ?? null,
            postal_code: l.postalCode ?? null,
            lat: l.lat,
            lng: l.lng,
          })),
        ),
      ],
    );
  }

  async upsertItems(items: FinalItem[]): Promise<number> {
    if (items.length === 0) return 0;
    const json = JSON.stringify(
      items.map((i) => ({
        chain_slug: i.chainSlug,
        sku: i.sku,
        name: i.name,
        brand: i.brand ?? null,
        size: i.size ?? null,
        pack_count: i.packCount,
        size_amount: i.sizeAmount ?? null,
        size_unit: i.sizeUnit ?? null,
        size_kind: i.sizeKind ?? null,
        size_total_base: i.sizeTotalBase ?? null,
        priced_by_weight: i.pricedByWeight,
        upc: i.upc ?? null,
        category: i.category,
        store_categories: i.storeCategories,
        image_url: i.imageUrl ?? null,
        location_id: i.locationId ?? null,
        regular: i.regularPriceCents,
        sale: i.salePriceCents ?? null,
        member: i.memberPriceCents ?? null,
        unit_price: i.unitPriceCents ?? null,
        unit_label: i.unitLabel ?? null,
        sale_start: i.saleStart ?? null,
        sale_end: i.saleEnd ?? null,
        source_url: i.sourceUrl ?? null,
        scraped_at: i.scrapedAt,
      })),
    );
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `insert into banana.products (chain_slug, sku, name, brand, size, pack_count, size_amount, size_unit, size_kind,
           size_total_base, priced_by_weight, upc, category, store_categories, image_url)
         select chain_slug, sku, name, brand, size, pack_count, size_amount, size_unit, size_kind, size_total_base,
           priced_by_weight, upc, category, array(select jsonb_array_elements_text(store_categories)), image_url
         from jsonb_to_recordset($1::jsonb) as x(chain_slug text, sku text, name text, brand text, size text,
           pack_count integer, size_amount numeric, size_unit text, size_kind text, size_total_base numeric,
           priced_by_weight boolean, upc text, category text, store_categories jsonb, image_url text)
         on conflict (chain_slug, sku) do update set name = excluded.name, brand = excluded.brand, size = excluded.size,
           pack_count = excluded.pack_count, size_amount = excluded.size_amount, size_unit = excluded.size_unit,
           size_kind = excluded.size_kind, size_total_base = excluded.size_total_base,
           priced_by_weight = excluded.priced_by_weight, upc = excluded.upc, category = excluded.category,
           store_categories = excluded.store_categories, image_url = excluded.image_url`,
        [json],
      );
      await client.query(
        `insert into banana.prices (product_id, location_id, regular_price_cents, sale_price_cents, member_price_cents,
           unit_price_cents, unit_label, sale_start, sale_end, source_url, scraped_at)
         select p.id, x.location_id, x.regular, x.sale, x.member, x.unit_price, x.unit_label, x.sale_start, x.sale_end,
           x.source_url, x.scraped_at
         from jsonb_to_recordset($1::jsonb) as x(chain_slug text, sku text, location_id text, regular integer, sale integer,
           member integer, unit_price integer, unit_label text, sale_start date, sale_end date, source_url text,
           scraped_at timestamptz)
         join banana.products p on p.chain_slug = x.chain_slug and p.sku = x.sku
         on conflict (product_id, location_id) do update set regular_price_cents = excluded.regular_price_cents,
           sale_price_cents = excluded.sale_price_cents, member_price_cents = excluded.member_price_cents,
           unit_price_cents = excluded.unit_price_cents, unit_label = excluded.unit_label,
           sale_start = excluded.sale_start, sale_end = excluded.sale_end, source_url = excluded.source_url,
           scraped_at = excluded.scraped_at`,
        [json],
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    return items.length;
  }

  async listItems(): Promise<FinalItem[]> {
    const result = await this.pool.query<Record<string, unknown>>(
      `select p.chain_slug, p.sku, p.name, p.brand, p.size, p.pack_count, p.size_amount, p.size_unit, p.size_kind,
         p.size_total_base, p.priced_by_weight, p.upc, p.category, p.store_categories, p.image_url,
         pr.location_id, pr.regular_price_cents, pr.sale_price_cents, pr.member_price_cents, pr.unit_price_cents,
         pr.unit_label, ${ISO_DATE('pr.sale_start')} as sale_start, ${ISO_DATE('pr.sale_end')} as sale_end,
         pr.source_url, ${ISO_TIME('pr.scraped_at')} as scraped_at
       from banana.products p
       join banana.prices pr on pr.product_id = p.id
       order by p.chain_slug, p.sku`,
    );
    return result.rows.map((row): FinalItem => {
      const optional = {
        brand: text(row['brand']),
        size: text(row['size']),
        sizeAmount: num(row['size_amount']),
        sizeUnit: text(row['size_unit']) as FinalItem['sizeUnit'],
        sizeKind: text(row['size_kind']) as FinalItem['sizeKind'],
        sizeTotalBase: num(row['size_total_base']),
        upc: text(row['upc']),
        imageUrl: text(row['image_url']),
        locationId: text(row['location_id']),
        salePriceCents: num(row['sale_price_cents']),
        memberPriceCents: num(row['member_price_cents']),
        unitPriceCents: num(row['unit_price_cents']),
        unitLabel: text(row['unit_label']),
        saleStart: text(row['sale_start']),
        saleEnd: text(row['sale_end']),
        sourceUrl: text(row['source_url']),
      };
      const chainSlug = String(row['chain_slug']);
      const sku = String(row['sku']);
      return {
        id: `${chainSlug}:${sku}`,
        chainSlug,
        sku,
        name: String(row['name']),
        packCount: Number(row['pack_count']),
        pricedByWeight: Boolean(row['priced_by_weight']),
        category: String(row['category']) as FinalItem['category'],
        storeCategories: (row['store_categories'] as string[] | null) ?? [],
        regularPriceCents: Number(row['regular_price_cents']),
        scrapedAt: String(row['scraped_at']),
        ...(Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined)) as Partial<FinalItem>),
      };
    });
  }

  async listChains(): Promise<Chain[]> {
    const result = await this.pool.query<{ slug: string; name: string; parent_company: string; has_member_pricing: boolean }>(
      'select slug, name, parent_company, has_member_pricing from banana.chains order by slug',
    );
    return result.rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      parentCompany: row.parent_company,
      hasMemberPricing: row.has_member_pricing,
    }));
  }

  async listLocations(): Promise<StoreLocation[]> {
    const result = await this.pool.query<Record<string, unknown>>(
      `select id, chain_slug, name, address, city, postal_code,
         extensions.st_y(location::extensions.geometry) as lat, extensions.st_x(location::extensions.geometry) as lng
       from banana.store_locations order by id`,
    );
    return result.rows.map((row) => {
      const optional = { address: text(row['address']), city: text(row['city']), postalCode: text(row['postal_code']) };
      return {
        id: String(row['id']),
        chainSlug: String(row['chain_slug']),
        name: String(row['name']),
        lat: Number(row['lat']),
        lng: Number(row['lng']),
        ...(Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined)) as Partial<StoreLocation>),
      };
    });
  }
}

/**
 * Keeps a copy of the final layer for a short time, so each website request doesn't reload
 * every product from the database. Prices only change when ingest runs, so 60 seconds is plenty.
 */
export class CachedFinalSource implements FinalSource {
  private cache: { at: number; items: Promise<FinalItem[]>; chains: Promise<Chain[]>; locations: Promise<StoreLocation[]> } | undefined;

  constructor(
    private readonly source: FinalSource,
    private readonly ttlMs = 60_000,
    private readonly clock: () => number = Date.now,
  ) {}

  private fresh() {
    const now = this.clock();
    if (this.cache === undefined || now - this.cache.at >= this.ttlMs) {
      const cache = { at: now, items: this.source.listItems(), chains: this.source.listChains(), locations: this.source.listLocations() };
      // A failed load must not stick: the next request tries again.
      Promise.all([cache.items, cache.chains, cache.locations]).catch(() => {
        if (this.cache === cache) this.cache = undefined;
      });
      this.cache = cache;
    }
    return this.cache;
  }

  listItems(): Promise<FinalItem[]> {
    return this.fresh().items;
  }

  listChains(): Promise<Chain[]> {
    return this.fresh().chains;
  }

  listLocations(): Promise<StoreLocation[]> {
    return this.fresh().locations;
  }
}
