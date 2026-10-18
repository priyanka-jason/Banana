import {
  branches,
  type SearchOrigin,
  type StoreBranch,
} from '../data/mockLocations.ts'
import { offers, stores } from '../data/mockOffers.ts'
import type { NearbyOffer } from '../types.ts'

const radians = (degrees: number) => (degrees * Math.PI) / 180
const degrees = (angle: number) => (angle * 180) / Math.PI

export function distanceKm(
  a: Pick<SearchOrigin, 'latitude' | 'longitude'>,
  b: Pick<SearchOrigin, 'latitude' | 'longitude'>,
) {
  const dLat = radians(b.latitude - a.latitude)
  const dLng = radians(b.longitude - a.longitude)
  const hav =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) *
      Math.cos(radians(b.latitude)) *
      Math.sin(dLng / 2) ** 2
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, hav)))
}

export function nearbyBranches(
  origin: SearchOrigin,
  radius: number,
  records: StoreBranch[] = branches,
) {
  return records
    .flatMap((branch) => {
      const store = stores.find((store) => store.id === branch.brandId)
      if (!store || !offers.some((offer) => offer.storeId === branch.brandId))
        return []
      const distance = distanceKm(origin, branch)
      return distance <= radius ? [{ ...branch, store, distance }] : []
    })
    .sort((a, b) => a.distance - b.distance)
}

export type NearbyBranch = ReturnType<typeof nearbyBranches>[number]

export function branchOffers(branch: NearbyBranch): NearbyOffer[] {
  return offers
    .filter((offer) => offer.storeId === branch.brandId)
    .map((offer) => ({
      ...offer,
      store: branch.store,
      distance: branch.distance,
    }))
}

export function radiusRing(origin: SearchOrigin, radius: number) {
  const lat = radians(origin.latitude)
  const lng = radians(origin.longitude)
  const angle = radius / 6371.0088
  const points: [number, number][] = []
  for (let index = 0; index < 96; index++) {
    const bearing = (2 * Math.PI * index) / 96
    const nextLat = Math.asin(
      Math.sin(lat) * Math.cos(angle) +
        Math.cos(lat) * Math.sin(angle) * Math.cos(bearing),
    )
    const nextLng =
      lng +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angle) * Math.cos(lat),
        Math.cos(angle) - Math.sin(lat) * Math.sin(nextLat),
      )
    points.push([degrees(nextLng), degrees(nextLat)])
  }
  points.push(points[0])
  return points
}
