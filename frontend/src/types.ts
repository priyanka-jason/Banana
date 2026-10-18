export type AreaId = 'mount-pleasant' | 'kitsilano' | 'downtown'
export type Category = string
export type SortOrder =
  'recommended' | 'price' | 'price-desc' | 'distance' | 'discount'
export type Page = 'home' | 'items' | 'locations'

export interface Store {
  id: string
  name: string
  logo: string
  website: string
}

export interface Offer {
  id: string
  name: string
  pack: string
  category: Category
  image: string
  price: number
  regularPrice?: number
  unitPrice: string
  storeId: string
  distances: Record<AreaId, number>
  featured?: boolean
  saleEnd?: string
  updatedAt?: string
  source?: 'supabase'
  simulated?: boolean
  missingFields?: string[]
  sourceUrl?: string
}

export interface NearbyOffer extends Offer {
  distance: number
  store: Store
}

export interface Filters {
  query: string
  category: string
  store: string
  radius: number
  discountsOnly: boolean
  sort: SortOrder
  area: AreaId
}
