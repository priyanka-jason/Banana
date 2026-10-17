import type { CategoryNote } from './types';
import type { IngestResult } from './runIngest';
import { toPriceRow } from './priceRow';

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function describeUnitPrice(per: '100g' | '100ml' | 'each', cents: number): string {
  return per === 'each' ? `${cents}¢ each` : `${cents}¢/${per}`;
}

function listNotes(heading: string, notes: CategoryNote[], limit: number): string[] {
  if (notes.length === 0) return [];
  const lines = [heading];
  for (const note of notes.slice(0, limit)) {
    lines.push(`  ${note.chainSlug}: ${note.storeCategories.join(' > ')} -> ${note.category}`);
  }
  if (notes.length > limit) lines.push(`  ...and ${notes.length - limit} more`);
  return lines;
}

/** A readable report of what an ingest run did. */
export function formatIngestSummary(result: IngestResult, options: { sampleRows?: number } = {}): string {
  const sampleRows = options.sampleRows ?? 5;
  const lines: string[] = [];

  lines.push(result.dryRun ? 'Ingest (dry run: nothing was saved)' : 'Ingest');
  lines.push('');

  lines.push('Fetched:');
  for (const entry of result.scraped) {
    const name = result.chains.find((chain) => chain.slug === entry.chainSlug)?.name ?? entry.chainSlug;
    lines.push(`  ${name}: ${entry.count} items`);
  }
  for (const failure of result.failures) {
    lines.push(`  ${failure.chainSlug}: FAILED - ${failure.error}`);
  }
  lines.push('');

  if (!result.dryRun) {
    lines.push(`Saved: ${result.savedStoreRecords} per-store records, ${result.savedItems} final items`);
  }
  lines.push(`Combined: ${result.combine.items.length} items, ${result.combine.rejected.length} rejected`);

  for (const rejected of result.combine.rejected.slice(0, 10)) {
    lines.push(`  rejected ${rejected.chainSlug}:${rejected.sku}: ${rejected.reason}`);
  }
  if (result.combine.rejected.length > 10) {
    lines.push(`  ...and ${result.combine.rejected.length - 10} more`);
  }

  if (result.missingOriginal > 0) {
    lines.push(
      `Warning: ${result.missingOriginal} items had no original store data. Connectors should set \`original\` on every item.`,
    );
  }

  const unreadable = result.combine.unreadableSizes;
  if (unreadable.length > 0) {
    lines.push(`Sizes that could not be read (${unreadable.length}), their size columns are left empty:`);
    for (const entry of unreadable.slice(0, 10)) {
      lines.push(`  ${entry.chainSlug}:${entry.sku}  "${entry.size}"`);
    }
    if (unreadable.length > 10) lines.push(`  ...and ${unreadable.length - 10} more`);
  }

  lines.push(
    ...listNotes(
      `Categories guessed from keywords (${result.combine.guessedCategories.length}), please review:`,
      result.combine.guessedCategories,
      10,
    ),
    ...listNotes(
      `Categories with no match (${result.combine.unmappedCategories.length}), add to CATEGORY_MAP:`,
      result.combine.unmappedCategories,
      10,
    ),
  );

  if (sampleRows > 0 && result.combine.items.length > 0) {
    lines.push('', 'Sample rows (what a non-member sees):');
    for (const item of result.combine.items.slice(0, sampleRows)) {
      const chain = result.chains.find((candidate) => candidate.slug === item.chainSlug);
      if (chain === undefined) continue;
      const row = toPriceRow(item, chain);
      const discount =
        row.discountCents !== undefined
          ? ` (was ${dollars(row.regularPriceCents)}, -${row.discountPercent}%)`
          : '';
      const unit =
        row.comparableUnitPrice !== undefined
          ? `  ${describeUnitPrice(row.comparableUnitPrice.per, row.comparableUnitPrice.cents)}`
          : '';
      lines.push(`  ${row.id}  ${row.name}  ${dollars(row.priceCents)}${discount}${unit}  [${row.category}]`);
    }
  }

  return lines.join('\n');
}
