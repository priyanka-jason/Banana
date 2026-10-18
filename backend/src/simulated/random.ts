/**
 * Repeatable "random" numbers for the simulated data.
 *
 * The same text always gives the same number, so every run makes exactly the
 * same prices, stores and sales. That keeps item ids stable and tests reliable.
 */

/** Turn text into a 32-bit number (FNV-1a hash). */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A number from 0 (inclusive) to 1 (exclusive), always the same for the same parts. */
export function chance(...parts: string[]): number {
  // One round of mulberry32 to spread the hash out evenly.
  let t = (hash(parts.join('|')) + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A number from `low` to `high`, always the same for the same parts. */
export function between(low: number, high: number, ...parts: string[]): number {
  return low + (high - low) * chance(...parts);
}
