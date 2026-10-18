export type AreaId = 'mount-pleasant' | 'kitsilano' | 'downtown'
export type Category = string
export type SortOrder =
  'recommended' | 'price' | 'price-desc' | 'distance' | 'discount'
export type Page = 'home' | 'items' | 'locations' | 'plans'

export interface Store {
  id: string
  name: string
  logo: string
  website: string
}

export interface ProductSpec {
  sku: string
  comparisonGroupId?: string
  brand?: string
  upc?: string
  packCount?: number
  sizeKind?: string
  totalBase?: number
  pricedByWeight?: boolean
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
  spec?: ProductSpec
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
