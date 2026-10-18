import type { Offer, ProductSpec } from '../types.ts'

export interface BasketProduct {
  offerId: string
  name: string
  pack: string
  spec?: ProductSpec
}
const normalize = (text: string) =>
  text.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
export function productRequest(offer: Offer): BasketProduct {
  return {
    offerId: offer.id,
    name: offer.name,
    pack: offer.pack,
    spec: offer.spec,
  }
}
export function variantKey(item: BasketProduct): string {
  const spec = item.spec
  if (spec?.comparisonGroupId) return `variant:${spec.comparisonGroupId}`
  // Only demo SKUs have a documented shared namespace. Real chain SKUs are not global IDs.
  if (spec?.sku.startsWith('sim-')) {
    const family = spec.sku.replace(
      /-(?:\d+(?:\.\d+)?(?:ml|l|kg|g|lb|oz|ct)|\d+)$/,
      '',
    )
    return `demo:${family}:${normalize(item.name)}:${normalize(spec.brand ?? '')}`
  }
  if (spec?.upc?.trim()) return `upc:${spec.upc.trim()}`
  return `offer:${item.offerId}`
}
export function packageKey(item: BasketProduct): string | null {
  const spec = item.spec
  if (
    spec &&
    Number.isFinite(spec.totalBase) &&
    spec.totalBase! > 0 &&
    Number.isInteger(spec.packCount) &&
    spec.packCount! > 0 &&
    ['weight', 'volume', 'count'].includes(spec.sizeKind ?? '')
  ) {
    return `${spec.sizeKind}:${Number(spec.totalBase!.toFixed(6))}:${spec.packCount}:${Boolean(spec.pricedByWeight)}`
  }
  return spec?.upc?.trim() ? `upc:${spec.upc.trim()}` : null
}
export function samePackage(a: BasketProduct, b: BasketProduct): boolean {
  if (a.offerId === b.offerId) {
    const original = packageKey(a)
    const current = packageKey(b)
    return !original || !current || original === current
  }
  return (
    variantKey(a) === variantKey(b) &&
    packageKey(a) !== null &&
    packageKey(a) === packageKey(b)
  )
}
export function requestKey(item: BasketProduct): string {
  return packageKey(item)
    ? `${variantKey(item)}|${packageKey(item)}`
    : `offer:${item.offerId}`
}

// Enrich identifiers as backend matching data improves, while preserving the requested package.
export function enrichSpec(
  saved?: ProductSpec,
  current?: ProductSpec,
): ProductSpec | undefined {
  if (!saved) return current
  if (!current) return saved
  const definedSaved = Object.fromEntries(
    Object.entries(saved).filter(([, value]) => value !== undefined),
  )
  return {
    ...current,
    ...definedSaved,
    comparisonGroupId: current.comparisonGroupId ?? saved.comparisonGroupId,
    upc: current.upc ?? saved.upc,
  }
}
