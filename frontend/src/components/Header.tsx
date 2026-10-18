import { HouseIcon } from '@phosphor-icons/react/dist/csr/House'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { MapPinIcon } from '@phosphor-icons/react/dist/csr/MapPin'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { areas } from '../data/mockOffers'
import { pageHref, updateRoute } from '../lib/navigation'
import type { AreaId, Page } from '../types'

interface Props {
  page: Page
  params: URLSearchParams
  area: AreaId
  onAreaChange?: () => void
}

export function Header({ page, params, area, onAreaChange }: Props) {
  const areaName = areas.find((item) => item.id === area)!.name
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <a
          href={pageHref('home', params)}
          className="wordmark"
          aria-label="Banana home"
        >
          Banana
        </a>
        <nav className="desktop-nav" aria-label="Main navigation">
          <a
            href={pageHref('home', params)}
            aria-current={page === 'home' ? 'page' : undefined}
          >
            Home
          </a>
          <a
            href={pageHref('items', params)}
            aria-current={page === 'items' ? 'page' : undefined}
          >
            Search items
          </a>
          <a
            href={pageHref('locations', params)}
            aria-current={page === 'locations' ? 'page' : undefined}
          >
            Locations
          </a>
        </nav>
        <label className="location-control">
          <MapPinIcon size={21} aria-hidden="true" />
          <span>
            {areaName}
            <span className="location-city">, Vancouver</span>
          </span>
          <CaretDownIcon size={15} aria-hidden="true" />
          <select
            aria-label="Your neighbourhood"
            value={area}
            onChange={(event) => {
              onAreaChange?.()
              updateRoute(page, params, { area: event.target.value })
            }}
          >
            {areas.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}, Vancouver
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  )
}

export function MobileNav({ page, params }: Omit<Props, 'area'>) {
  return (
    <nav className="mobile-nav" aria-label="Main navigation">
      <a
        href={pageHref('home', params)}
        aria-current={page === 'home' ? 'page' : undefined}
      >
        <HouseIcon
          size={25}
          weight={page === 'home' ? 'fill' : 'regular'}
          aria-hidden="true"
        />
        <span>Home</span>
      </a>
      <a
        href={pageHref('items', params)}
        aria-current={page === 'items' ? 'page' : undefined}
      >
        <MagnifyingGlassIcon size={25} aria-hidden="true" />
        <span>Search items</span>
      </a>
      <a
        href={pageHref('locations', params)}
        aria-current={page === 'locations' ? 'page' : undefined}
      >
        <MapPinIcon
          size={25}
          weight={page === 'locations' ? 'fill' : 'regular'}
          aria-hidden="true"
        />
        <span>Locations</span>
      </a>
    </nav>
  )
}
