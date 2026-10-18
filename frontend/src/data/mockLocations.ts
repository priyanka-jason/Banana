import type { AreaId } from '../types.ts'

export interface SearchOrigin {
  label: string
  latitude: number
  longitude: number
}
export interface StoreBranch {
  id: string
  brandId: string
  name: string
  address: string
  latitude: number
  longitude: number
}

export const neighbourhoodOrigins: Record<AreaId, SearchOrigin> = {
  'mount-pleasant': {
    label: 'Mount Pleasant, Vancouver',
    latitude: 49.262,
    longitude: -123.105,
  },
  kitsilano: {
    label: 'Kitsilano, Vancouver',
    latitude: 49.267,
    longitude: -123.168,
  },
  downtown: {
    label: 'Downtown, Vancouver',
    latitude: 49.282,
    longitude: -123.12,
  },
}

// Illustrative branch points only. Replace with verified store records from the backend.
export const branches: StoreBranch[] = [
  {
    id: 'saveon-main',
    brandId: 'save-on-foods',
    name: 'Main Street',
    address: 'Main Street, Vancouver, BC',
    latitude: 49.269,
    longitude: -123.1,
  },
  {
    id: 'nofrills-broadway',
    brandId: 'no-frills',
    name: 'Broadway',
    address: 'Broadway, Vancouver, BC',
    latitude: 49.263,
    longitude: -123.124,
  },
  {
    id: 'saveon-cambie',
    brandId: 'save-on-foods',
    name: 'Cambie Street',
    address: 'Cambie Street, Vancouver, BC',
    latitude: 49.25,
    longitude: -123.129,
  },
]
