import { createContext, useContext } from 'react'
import type { Catalogue } from '../api/supabaseCatalogue'
import { neighbourhoodOrigins, type SearchOrigin } from './storeLocations'
import { distanceKm, type NearbyBranch } from '../lib/locations'
import type { Filters, NearbyOffer } from '../types'
export interface CatalogueState {
  data: Catalogue | null
  error: string
  loading: boolean
  retry: () => void
  connected: boolean
}
export const CatalogueContext = createContext<CatalogueState | null>(null)
export function useCatalogue() {
  const state = useContext(CatalogueContext)
  if (!state) throw new Error('CatalogueProvider is required.')
  return state
}
export function catalogueOffers(
  data: Catalogue,
  filters: Filters,
  origin?: SearchOrigin | null,
  branchId?: string | null,
): NearbyOffer[] {
  const point = origin ?? neighbourhoodOrigins[filters.area]
  const rounded = {
    latitude: Math.round(point.latitude * 100) / 100,
    longitude: Math.round(point.longitude * 100) / 100,
  }
  return data.offers.flatMap((offer) => {
    const store = data.stores.find((store) => store.id === offer.storeId)
    if (!store) return []
    const candidates = data.branches.filter(
      (branch) => branch.brandId === offer.storeId,
    )
    const branch = candidates.find((branch) => branch.id === branchId)
    const distance = branch
      ? distanceKm(rounded, branch)
      : Math.min(...candidates.map((branch) => distanceKm(rounded, branch)))
    return [{ ...offer, store, distance }]
  })
}
export function catalogueBranches(
  data: Catalogue,
  origin: SearchOrigin,
  radius: number,
): NearbyBranch[] {
  const point = {
    latitude: Math.round(origin.latitude * 100) / 100,
    longitude: Math.round(origin.longitude * 100) / 100,
  }
  return data.branches
    .flatMap((branch) => {
      const store = data.stores.find((store) => store.id === branch.brandId)
      const distance = distanceKm(point, branch)
      return store &&
        data.offers.some((offer) => offer.storeId === branch.brandId) &&
        distance <= radius
        ? [{ ...branch, store, distance }]
        : []
    })
    .sort((a, b) => a.distance - b.distance)
}
