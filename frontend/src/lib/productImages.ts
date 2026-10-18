import {
  PRODUCT_IMAGE_KEYS,
  PRODUCT_IMAGE_SIZES,
} from '../data/productImages.ts'

/**
 * The picture for a product, from public/images/products/. Each picture comes as
 * <name>-240 and <name>-480 in AVIF and WebP; this returns the 480 px WebP path, and
 * ProductImage turns it into a <picture> with AVIF first.
 *
 * Pictures are keyed by the product (the sku without "sim-") and, when the pack size has its
 * own picture, by size too: Costco's "2 x 4 L" milk shows two jugs, the regular "4 L" one jug.
 * Unknown products give '' so the placeholder shows; nothing is guessed.
 */
export function productImage(sku: string, size?: string | null): string {
  const key = sku.replace(/^sim-/, '')
  if (!PRODUCT_IMAGE_KEYS.has(key)) return ''
  const variant = size ? sizeSlug(size) : ''
  const name =
    variant && PRODUCT_IMAGE_SIZES[key]?.includes(variant)
      ? `${key}--${variant}`
      : key
  return `/images/products/${name}-480.webp`
}

/** "2 x 4 L" -> "2x4-l", "1.36 kg" -> "1_36-kg", "40 rolls" -> "40-rolls" (same as the picture build). */
export function sizeSlug(size: string): string {
  return size
    .toLowerCase()
    .replace(/ x /g, 'x')
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/\./g, '_')
    .replace(/^-|-$/g, '')
}

/** For a /images/products/<name>-480.webp path, the <name> part; otherwise undefined. */
export function productImageName(src: string): string | undefined {
  return /^\/images\/products\/(.+)-480\.webp$/.exec(src)?.[1]
}
