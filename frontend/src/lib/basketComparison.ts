import type { Offer, Store } from '../types.ts'
import type { ListItem } from './shoppingList.ts'
import {
  enrichSpec,
  packageKey,
  productRequest,
  samePackage,
  variantKey,
} from './basketIdentity.ts'

export interface BasketPick {
  lineId: string
  offer: Offer
  store: Store
  units: number
  lineCents: number
  requestedQuantity: number
  requestedPack: string
  requestedBase?: number
  suppliedBase?: number
  extraBase?: number
  sizeKind?: string
  change: 'exact' | 'packaging' | 'quantity'
}
export interface BasketPlan {
  id: string
  kind: 'requested' | 'exact' | 'alternative' | 'split'
  name: string
  picks: BasketPick[]
  missing: ListItem[]
  totalCents: number
  complete: boolean
}
export interface BasketComparison {
  requested: BasketPlan
  exact: BasketPlan[]
  alternatives: BasketPlan[]
  incomplete: BasketPlan[]
  split?: BasketPlan
  unverified: ListItem[]
}
const cents = (offer: Offer) => Math.round(offer.price * 100)
const tolerance = 0.000001
function exactPick(line: ListItem, offer: Offer, store: Store): BasketPick {
  const amount = line.spec?.totalBase
  return {
    lineId: line.offerId,
    offer,
    store,
    units: line.quantity,
    lineCents: cents(offer) * line.quantity,
    requestedQuantity: line.quantity,
    requestedPack: line.pack,
    requestedBase: amount ? amount * line.quantity : undefined,
    suppliedBase: amount ? amount * line.quantity : undefined,
    extraBase: 0,
    sizeKind: line.spec?.sizeKind,
    change: 'exact',
  }
}
function alternativePick(
  line: ListItem,
  offer: Offer,
  store: Store,
): BasketPick | null {
  if (samePackage(line, productRequest(offer)))
    return exactPick(line, offer, store)
  const source = line.spec
  const target = offer.spec
  if (
    !source ||
    !target ||
    variantKey(line).startsWith('offer:') ||
    variantKey(line) !== variantKey(productRequest(offer)) ||
    !source.totalBase ||
    !target.totalBase ||
    source.sizeKind !== target.sizeKind ||
    Boolean(source.pricedByWeight) !== Boolean(target.pricedByWeight)
  )
    return null
  const required = source.totalBase * line.quantity
  const units = source.pricedByWeight
    ? required / target.totalBase
    : Math.ceil((required - tolerance) / target.totalBase)
  if (!Number.isFinite(units) || units <= 0) return null
  const supplied = units * target.totalBase
  const lineCents = Math.round(cents(offer) * units)
  if (!Number.isSafeInteger(lineCents)) return null
  return {
    ...exactPick(line, offer, store),
    units,
    lineCents,
    requestedBase: required,
    suppliedBase: supplied,
    extraBase: Math.max(0, supplied - required),
    change: supplied - required > tolerance ? 'quantity' : 'packaging',
  }
}
function plan(
  id: string,
  kind: BasketPlan['kind'],
  name: string,
  list: ListItem[],
  picks: BasketPick[],
): BasketPlan {
  const missing = list.filter(
    (line) => !picks.some((pick) => pick.lineId === line.offerId),
  )
  return {
    id:
      kind === 'requested' || kind === 'exact'
        ? id
        : `${id}:${picks.map((pick) => `${pick.lineId}=${pick.offer.id}@${pick.units}`).join('|')}`,
    kind,
    name,
    picks,
    missing,
    complete: missing.length === 0,
    totalCents: picks.reduce((sum, pick) => sum + pick.lineCents, 0),
  }
}
const byCost = (a: BasketPick, b: BasketPick) =>
  a.lineCents - b.lineCents ||
  Number(a.change !== 'exact') - Number(b.change !== 'exact') ||
  (a.extraBase ?? 0) - (b.extraBase ?? 0) ||
  a.offer.id.localeCompare(b.offer.id)
const byTotal = (a: BasketPlan, b: BasketPlan) =>
  a.totalCents - b.totalCents || a.id.localeCompare(b.id)
export function compareBasket(
  list: ListItem[],
  offers: Offer[],
  stores: Store[],
): BasketComparison {
  const usable = offers.filter(
    (offer) =>
      Number.isFinite(offer.price) &&
      offer.price >= 0 &&
      stores.some((store) => store.id === offer.storeId),
  )
  const currentLines = list.map((line) => {
    const current = usable.find((offer) => offer.id === line.offerId)
    return current
      ? { ...line, spec: enrichSpec(line.spec, current.spec) }
      : line
  })
  const pickFor = (
    line: ListItem,
    storeId?: string,
    allowAlternative = false,
  ) =>
    usable
      .flatMap((offer) => {
        if (storeId && offer.storeId !== storeId) return []
        const store = stores.find((store) => store.id === offer.storeId)!
        const pick = allowAlternative
          ? alternativePick(line, offer, store)
          : samePackage(line, productRequest(offer))
            ? exactPick(line, offer, store)
            : null
        return pick ? [pick] : []
      })
      .sort(byCost)
  const preferred = list[0]?.storeId
  const basePicks = currentLines.flatMap((line) => {
    const choice =
      pickFor(line, preferred)[0] ??
      pickFor(line, line.storeId)[0] ??
      pickFor(line)[0]
    return choice ? [choice] : []
  })
  const requested = plan(
    'requested',
    'requested',
    'Your requested basket',
    currentLines,
    basePicks,
  )
  const exact: BasketPlan[] = []
  const incomplete: BasketPlan[] = []
  const alternatives: BasketPlan[] = []
  for (const store of stores) {
    const exactPicks = currentLines.flatMap((line) =>
      pickFor(line, store.id).slice(0, 1),
    )
    const exactPlan = plan(
      `exact:${store.id}`,
      'exact',
      store.name,
      currentLines,
      exactPicks,
    )
    if (exactPlan.complete) exact.push(exactPlan)
    else incomplete.push(exactPlan)
    const alternatePicks = currentLines.flatMap((line) =>
      pickFor(line, store.id, true).slice(0, 1),
    )
    const alternatePlan = plan(
      `alternative:${store.id}`,
      'alternative',
      store.name,
      currentLines,
      alternatePicks,
    )
    if (
      alternatePlan.complete &&
      alternatePicks.some((pick) => pick.change !== 'exact') &&
      (!exactPlan.complete || alternatePlan.totalCents < exactPlan.totalCents)
    )
      alternatives.push(alternatePlan)
  }
  const mixedPicks = currentLines.flatMap((line) => pickFor(line).slice(0, 1))
  const mixed = plan(
    'split',
    'split',
    'Split-store exact basket',
    currentLines,
    mixedPicks,
  )
  return {
    requested,
    exact: exact.sort(byTotal),
    alternatives: alternatives.sort(byTotal),
    incomplete: incomplete.sort(
      (a, b) => a.missing.length - b.missing.length || byTotal(a, b),
    ),
    split:
      mixed.complete &&
      new Set(mixed.picks.map((pick) => pick.store.id)).size > 1
        ? mixed
        : undefined,
    unverified: currentLines.filter(
      (line) => variantKey(line).startsWith('offer:') || !packageKey(line),
    ),
  }
}
export function amountLabel(amount: number, kind?: string): string {
  if (kind === 'volume')
    return amount >= 1000
      ? `${Number((amount / 1000).toFixed(3))} L`
      : `${Number(amount.toFixed(2))} ml`
  if (kind === 'weight')
    return amount >= 1000
      ? `${Number((amount / 1000).toFixed(3))} kg`
      : `${Number(amount.toFixed(2))} g`
  return `${Number(amount.toFixed(2))} items`
}
