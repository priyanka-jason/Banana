import { useEffect, useState } from 'react'
import {
  searchOffers,
  searchRowToOffer,
  type SearchRow,
} from '../api/supabaseCatalogue'
import { catalogueKey, catalogueUrl } from '../lib/supabaseClient'
import { distanceKm } from '../lib/locations'
import { filterOffers } from '../lib/catalogue'
import {
  SEARCH_PAGE_SIZE,
  roundedPoint,
  searchOffersBody,
} from '../lib/searchRequest'
import { catalogueOffers, useCatalogue } from './catalogueState'
import { neighbourhoodOrigins, type SearchOrigin } from './storeLocations'
import type { Filters, NearbyOffer } from '../types'

export interface OfferSearch {
  items: NearbyOffer[]
  /** How many offers match in all (more may load with loadMore). */
  total: number
  /** A request is running; items still show the previous results meanwhile. */
  loading: boolean
  loadMore: () => void
}

interface Result {
  key: string
  rows: SearchRow[]
  total: number
  failed: boolean
}

const TYPING_PAUSE_MS = 250

/**
 * Search results from the database function banana.search_offers, so every
 * client sorts and prices the same way. With no connection, or if the request
 * fails, it falls back to searching the loaded (or saved) catalogue in the browser.
 */
export function useOfferSearch({
  filters,
  origin,
  branchId,
  pageSize = SEARCH_PAGE_SIZE,
}: {
  filters: Filters
  origin?: SearchOrigin | null
  branchId?: string | null
  pageSize?: number
}): OfferSearch {
  const { data, offline } = useCatalogue()
  const point = origin ?? neighbourhoodOrigins[filters.area]
  const key = JSON.stringify(
    searchOffersBody(filters, point, { branchId, limit: pageSize }),
  )
  const [result, setResult] = useState<Result | null>(null)
  const [extra, setExtra] = useState({ key: '', pages: 0 })
  const pages = extra.key === key ? extra.pages : 0

  // First page: wait for typing to pause, then ask the database.
  useEffect(() => {
    if (offline) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchOffers(
        catalogueUrl,
        catalogueKey,
        JSON.parse(key),
        controller.signal,
      )
        .then((rows) =>
          setResult({
            key,
            rows,
            total: Number(rows[0]?.total_count ?? 0),
            failed: false,
          }),
        )
        .catch(() => {
          if (!controller.signal.aborted)
            setResult({ key, rows: [], total: 0, failed: true })
        })
    }, TYPING_PAUSE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, offline])

  // Further pages ("Show more").
  useEffect(() => {
    if (offline || !pages || result?.key !== key || result.failed) return
    const offset = (pages + 1) * pageSize
    if (result.rows.length >= offset || result.rows.length >= result.total)
      return
    const controller = new AbortController()
    searchOffers(
      catalogueUrl,
      catalogueKey,
      { ...JSON.parse(key), p_offset: result.rows.length },
      controller.signal,
    )
      .then((rows) =>
        setResult((current) =>
          current?.key === key
            ? { ...current, rows: [...current.rows, ...rows] }
            : current,
        ),
      )
      .catch(() => undefined)
    return () => controller.abort()
  }, [key, offline, pages, pageSize, result])

  const loadMore = () => setExtra({ key, pages: pages + 1 })
  const visible = (pages + 1) * pageSize

  // Offline, or the database couldn't be reached: search in the browser.
  if (offline || (result?.key === key && result.failed)) {
    const local = data
      ? filterOffers(catalogueOffers(data, filters, origin, branchId), filters)
      : []
    return {
      items: local.slice(0, visible),
      total: local.length,
      loading: false,
      loadMore,
    }
  }

  const known = new Map(data?.offers.map((offer) => [offer.id, offer]))
  const near = roundedPoint(point)
  const branch = data?.branches.find((item) => item.id === branchId)
  const seen = new Set<string>()
  const items = (result?.rows ?? []).flatMap((row): NearbyOffer[] => {
    if (seen.has(row.id)) return []
    seen.add(row.id)
    const offer = searchRowToOffer(row, known.get(row.id))
    const store = data?.stores.find((item) => item.id === row.chain_slug)
    if (!offer || !store) return []
    const distance = branch
      ? distanceKm(near, branch)
      : (row.distance_km ?? Infinity)
    return [{ ...offer, store, distance: Number(distance) }]
  })
  return {
    items: items.slice(0, visible),
    total: result?.total ?? 0,
    loading:
      result?.key !== key ||
      result.rows.length < Math.min(visible, result.total),
    loadMore,
  }
}
