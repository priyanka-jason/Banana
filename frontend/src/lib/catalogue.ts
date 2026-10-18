import { areas, offers, stores } from '../data/mockOffers.ts'
import { branches, type SearchOrigin } from '../data/mockLocations.ts'
import { distanceKm } from './locations.ts'
import type { Filters, NearbyOffer, SortOrder } from '../types.ts'

export const currency = (value: number) => `$${value.toFixed(2)}`
export const isDiscounted = (offer: NearbyOffer) =>
  Boolean(offer.regularPrice && offer.regularPrice > offer.price)
export const saving = (offer: NearbyOffer) =>
  offer.regularPrice
    ? (offer.regularPrice - offer.price) / offer.regularPrice
    : 0

export function readFilters(params: URLSearchParams): Filters {
  const sorts: SortOrder[] = [
    'recommended',
    'price',
    'price-desc',
    'distance',
    'discount',
  ]
  const area =
    areas.find((item) => item.id === params.get('area'))?.id ?? 'mount-pleasant'
  const radius = Number(params.get('radius') || 5)
  return {
    query: params.get('q') || '',
    category: ['Produce', 'Dairy', 'Eggs'].includes(
      params.get('category') || '',
    )
      ? params.get('category')!
      : 'all',
    store: stores.some((store) => store.id === params.get('store'))
      ? params.get('store')!
      : 'all',
    radius: [1, 3, 5, 10].includes(radius) ? radius : 5,
    discountsOnly: params.get('sale') === '1',
    sort: sorts.includes(params.get('sort') as SortOrder)
      ? (params.get('sort') as SortOrder)
      : 'recommended',
    area,
  }
}

export function getNearbyOffers(
  filters: Filters,
  origin?: SearchOrigin | null,
  branchId?: string | null,
): NearbyOffer[] {
  return offers.map((offer) => ({
    ...offer,
    store: stores.find((store) => store.id === offer.storeId)!,
    distance: origin
      ? (() => {
          const chainBranches = branches.filter(
            (branch) => branch.brandId === offer.storeId,
          )
          const selectedBranch = chainBranches.find(
            (branch) => branch.id === branchId,
          )
          return selectedBranch
            ? distanceKm(origin, selectedBranch)
            : Math.min(
                ...chainBranches.map((branch) => distanceKm(origin, branch)),
              )
        })()
      : offer.distances[filters.area],
  }))
}

export function filterOffers(
  items: NearbyOffer[],
  filters: Filters,
): NearbyOffer[] {
  const query = filters.query.trim().toLocaleLowerCase()
  const result = items.filter(
    (item) =>
      item.distance <= filters.radius &&
      (filters.category === 'all' || item.category === filters.category) &&
      (filters.store === 'all' || item.storeId === filters.store) &&
      (!filters.discountsOnly || isDiscounted(item)) &&
      (!query ||
        `${item.name} ${item.pack} ${item.category} ${item.store.name}`
          .toLocaleLowerCase()
          .includes(query)),
  )
  switch (filters.sort) {
    case 'price':
      return result.sort((a, b) => a.price - b.price)
    case 'price-desc':
      return result.sort((a, b) => b.price - a.price)
    case 'distance':
      return result.sort((a, b) => a.distance - b.distance)
    case 'discount':
      return result.sort((a, b) => saving(b) - saving(a))
    default:
      return result
  }
}
