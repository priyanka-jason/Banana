import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { MapPinIcon } from '@phosphor-icons/react/dist/csr/MapPin'
import { NavigationArrowIcon } from '@phosphor-icons/react/dist/csr/NavigationArrow'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { ListIcon } from '@phosphor-icons/react/dist/csr/List'
import { MapTrifoldIcon } from '@phosphor-icons/react/dist/csr/MapTrifold'
import { RadiusSelect } from '../components/FilterControls'
import { Price, MissingOfferData } from '../components/Offer'
import { searchAddresses } from '../api/addressSearch'
import { neighbourhoodOrigins, type SearchOrigin } from '../data/storeLocations'
import { type NearbyBranch } from '../lib/locations'
import { updateRoute } from '../lib/navigation'
import type { Filters, NearbyOffer } from '../types'
import './LocationsPage.css'
import { useCatalogue, catalogueBranches } from '../data/catalogueState'
import { ProductImage, StoreLogo } from '../components/ProductImage'
import { Freshness } from '../components/SearchForm'

const LocationsMap = lazy(() => import('../components/LocationsMap'))

interface Props {
  filters: Filters
  params: URLSearchParams
  origin: SearchOrigin | null
  onOriginChange: (origin: SearchOrigin | null) => void
  onOpen: (offer: NearbyOffer) => void
}

function StoreRow({
  branch,
  number,
  selected,
  onSelect,
  onBrowse,
  onOpen,
}: {
  branch: NearbyBranch
  number: number
  selected: boolean
  onSelect: () => void
  onBrowse: () => void
  onOpen: (offer: NearbyOffer) => void
}) {
  const { data } = useCatalogue()
  const linkedOffers = data!.offers
    .filter((offer) => offer.storeId === branch.brandId)
    .map((offer) => ({
      ...offer,
      store: branch.store,
      distance: branch.distance,
    }))
  // One example per product, while keeping the full chain catalogue one click away.
  const uniqueOffers = [
    ...new Map(linkedOffers.map((offer) => [offer.name, offer])).values(),
  ]
  const previews = [
    uniqueOffers[0],
    uniqueOffers.find(
      (offer) =>
        offer.id !== uniqueOffers[0]?.id &&
        ['Dairy', 'dairy-eggs'].includes(offer.category),
    ) ?? uniqueOffers[1],
  ].filter((offer): offer is NearbyOffer => Boolean(offer))
  return (
    <article
      id={`store-${branch.id}`}
      className={`location-store ${selected ? 'is-selected' : ''}`}
    >
      <div className="location-store-summary">
        <button
          className="store-select"
          onClick={onSelect}
          aria-expanded={selected}
          aria-controls={`offers-${branch.id}`}
          aria-label={`${selected ? 'Collapse' : 'Select'} ${branch.store.name}, ${branch.name}`}
        >
          <span className={`location-store-logo ${branch.brandId}`}>
            <StoreLogo src={branch.store.logo} name={branch.store.name} />
          </span>
          <span className="location-store-name">
            <strong>{branch.store.name}</strong>
            <span>{branch.name}</span>
            <span
              className={
                branch.missingAddress || !branch.address
                  ? 'missing-backend'
                  : undefined
              }
            >
              {branch.missingAddress
                ? `Missing backend: street address${branch.address ? ` · ${branch.address}` : ''}`
                : branch.address || 'Missing backend: street address'}
            </span>
          </span>
        </button>
        <div className="location-store-actions">
          <span>{branch.distance.toFixed(1)} km</span>
          <button className="flyer-button" onClick={onBrowse}>
            Browse items
          </button>
        </div>
        <button
          className="store-expand icon-button"
          onClick={onSelect}
          aria-label={`${selected ? 'Collapse' : 'Expand'} ${branch.name} offers`}
          aria-expanded={selected}
        >
          <CaretDownIcon
            size={20}
            style={{ rotate: selected ? '180deg' : '0deg' }}
          />
        </button>
        <span className="store-number sr-only">Map marker {number}</span>
      </div>
      <div
        id={`offers-${branch.id}`}
        hidden={!selected}
        className="location-chain-offers"
      >
        <div className="chain-heading">
          <h3>Offers from this chain</h3>
        </div>
        <ul
          className="location-offer-previews"
          aria-label="Offers from this chain"
        >
          {previews.map((offer) => (
            <li key={offer.id}>
              <button
                className="location-offer"
                onClick={() => onOpen(offer)}
                aria-label={`View ${offer.name} offer at ${branch.store.name}`}
              >
                <ProductImage src={offer.image} alt="" />
                <span>
                  <strong>{offer.name}</strong>
                  <span className="pack">{offer.pack}</span>
                  <Price offer={offer} />
                  <span className="unit-price">{offer.unitPrice}</span>
                  <MissingOfferData offer={offer} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

export function LocationsPage({
  filters,
  params,
  origin: savedOrigin,
  onOriginChange,
  onOpen,
}: Props) {
  const { data } = useCatalogue()
  const origin = savedOrigin ?? neighbourhoodOrigins[filters.area]
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<SearchOrigin[]>([])
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>('saveon-main')
  const [sort, setSort] = useState('distance')
  const [view, setView] = useState<'list' | 'map'>('list')
  const controller = useRef<AbortController | null>(null)
  const requestId = useRef(0)
  const input = useRef<HTMLInputElement>(null)
  const locationList = useMemo(() => {
    const result = catalogueBranches(data!, origin, filters.radius)
    if (sort === 'name')
      result.sort(
        (a, b) =>
          a.store.name.localeCompare(b.store.name) || a.distance - b.distance,
      )
    return result
  }, [data, origin, filters.radius, sort])
  const selected =
    selectedId === null
      ? undefined
      : (locationList.find((branch) => branch.id === selectedId) ??
        locationList[0])
  useEffect(
    () => () => {
      controller.current?.abort()
      requestId.current++
    },
    [],
  )
  const selectFromMap = useCallback((id: string) => {
    setSelectedId(id)
    setView('list')
    window.requestAnimationFrame(() => {
      const row = document.getElementById(`store-${id}`)
      row
        ?.querySelector<HTMLButtonElement>('.store-select')
        ?.focus({ preventScroll: true })
      row?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
    })
  }, [])

  async function findAddress() {
    if (query.trim().length < 3) {
      setMessage('Enter a street address in Vancouver.')
      input.current?.focus()
      return
    }
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    const currentRequest = ++requestId.current
    setMatches([])
    setMessage('')
    setSearching(true)
    const timeout = window.setTimeout(() => abort.abort(), 12000)
    try {
      const result = await searchAddresses(query.trim(), abort.signal)
      if (currentRequest !== requestId.current) return
      setMatches(result)
      setMessage(
        result.length
          ? 'Choose an address below to update nearby stores.'
          : 'No Vancouver addresses found. Try the full street address.',
      )
    } catch {
      if (currentRequest === requestId.current)
        setMessage(
          'Address search is unavailable. Try again or use your location.',
        )
    } finally {
      window.clearTimeout(timeout)
      if (currentRequest === requestId.current) setSearching(false)
    }
  }
  function chooseAddress(next: SearchOrigin) {
    onOriginChange(next)
    setQuery('')
    setMatches([])
    setMessage('')
    setSelectedId('')
    setView('list')
  }
  function locate() {
    controller.current?.abort()
    requestId.current++
    setSearching(false)
    setMatches([])
    if (!navigator.geolocation) {
      setMessage(
        'Location sharing isn’t available in this browser. Search an address instead.',
      )
      return
    }
    const currentRequest = ++requestId.current
    setLocating(true)
    setMessage('')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (currentRequest !== requestId.current) return
        chooseAddress({
          label: 'Your current location',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        setLocating(false)
      },
      (error) => {
        if (currentRequest !== requestId.current) return
        setLocating(false)
        setMessage(
          error.code === 1
            ? 'Location permission was denied. You can search an address instead.'
            : 'We couldn’t find your location. Try again or search an address.',
        )
      },
      { timeout: 12000, maximumAge: 60000, enableHighAccuracy: false },
    )
  }
  function browse(branch: NearbyBranch) {
    onOriginChange(origin)
    updateRoute('items', new URLSearchParams(), {
      store: branch.brandId,
      branch: branch.id,
      area: filters.area,
      radius: String(filters.radius),
    })
  }

  return (
    <main id="main-content" tabIndex={-1} className="locations-page">
      <section className="locations-intro">
        <div className="shell locations-intro-inner">
          <div>
            <h1 className="page-title">Locations</h1>
            <p>Find grocery offers near you.</p>
          </div>
          <div className="locations-controls">
            <div className="location-search-row">
              <form
                className="location-address-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void findAddress()
                }}
                role="search"
                aria-label="Find an address"
              >
                <label className="sr-only" htmlFor="address-search">
                  Search an address in Vancouver
                </label>
                <input
                  ref={input}
                  id="address-search"
                  value={query}
                  onChange={(event) => {
                    controller.current?.abort()
                    requestId.current++
                    setSearching(false)
                    setMatches([])
                    setMessage('')
                    setQuery(event.target.value)
                  }}
                  placeholder="Search an address in Vancouver"
                  autoComplete="off"
                  maxLength={200}
                  disabled={locating}
                />
                <button
                  type="submit"
                  aria-label="Search address"
                  disabled={searching || locating}
                >
                  <MagnifyingGlassIcon size={23} aria-hidden="true" />
                </button>
              </form>
              <button
                className="locate-button"
                onClick={locate}
                disabled={locating || searching}
              >
                <NavigationArrowIcon size={21} aria-hidden="true" />
                {locating ? 'Locating…' : 'Use my location'}
              </button>
              <RadiusSelect
                value={filters.radius}
                onChange={(radius) =>
                  updateRoute('locations', params, { radius: String(radius) })
                }
              />
            </div>
            <p className="location-hint">
              Approximate straight-line radius · Showing stores with item data
            </p>
          </div>
        </div>
        <div className="shell address-feedback">
          {searching && <p role="status">Searching addresses…</p>}
          {message && <p role="status">{message}</p>}
          {matches.length > 0 && (
            <ul className="address-matches" aria-label="Address search results">
              {matches.map((match, index) => (
                <li key={`${match.label}-${index}`}>
                  <button onClick={() => chooseAddress(match)}>
                    <MapPinIcon size={19} aria-hidden="true" />
                    <span>{match.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <div className="locations-mobile-tabs" aria-label="Locations view">
        <button aria-pressed={view === 'list'} onClick={() => setView('list')}>
          <ListIcon size={19} />
          List
        </button>
        <button aria-pressed={view === 'map'} onClick={() => setView('map')}>
          <MapTrifoldIcon size={19} />
          Map
        </button>
      </div>
      <div className={`locations-workspace view-${view}`}>
        <section
          className="location-list-panel"
          aria-labelledby="nearby-stores-heading"
        >
          <div className="location-list-toolbar">
            <h2 id="nearby-stores-heading" role="status">
              {locationList.length} nearby{' '}
              {locationList.length === 1 ? 'store' : 'stores'}
            </h2>
            <label className="location-sort">
              <span className="sr-only">Sort stores</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="distance">Nearest first</option>
                <option value="name">Store name</option>
              </select>
              <CaretDownIcon size={16} aria-hidden="true" />
            </label>
          </div>
          <p className="search-origin">
            <MapPinIcon size={16} aria-hidden="true" />
            <span>Near {origin.label}</span>
            {savedOrigin && (
              <button
                className="text-button"
                onClick={() => {
                  onOriginChange(null)
                  setMessage('')
                  setQuery('')
                }}
              >
                Reset
              </button>
            )}
          </p>
          {locationList.map((branch, index) => (
            <StoreRow
              key={branch.id}
              branch={branch}
              number={index + 1}
              selected={selected?.id === branch.id}
              onSelect={() =>
                setSelectedId(selected?.id === branch.id ? null : branch.id)
              }
              onBrowse={() => browse(branch)}
              onOpen={onOpen}
            />
          ))}
          {!locationList.length && (
            <div className="locations-empty">
              <MapPinIcon size={36} aria-hidden="true" />
              <h3>No supported stores within {filters.radius} km</h3>
              <p>
                Try a wider radius or another address. We only show stores with
                item data.
              </p>
              <button
                className="flyer-button"
                onClick={() =>
                  filters.radius < 10
                    ? updateRoute('locations', params, { radius: '10' })
                    : onOriginChange(null)
                }
              >
                {filters.radius < 10 ? 'Expand to 10 km' : 'Use Mount Pleasant'}
              </button>
            </div>
          )}
          <footer className="location-data-note">
            <Freshness />
            <p>
              Address lookup:{' '}
              <a
                href="https://www2.gov.bc.ca/gov/content/data/geographic-data-services/location-services/geocoder"
                target="_blank"
                rel="noreferrer"
              >
                BC Address Geocoder
              </a>
              . Banana doesn’t save your address.
            </p>
          </footer>
        </section>
        <section className="location-map-panel" aria-label="Map view">
          <Suspense
            fallback={
              <div className="map-message" role="status">
                Loading map…
              </div>
            }
          >
            <LocationsMap
              origin={origin}
              visible={view === 'map'}
              radius={filters.radius}
              branches={locationList}
              selectedId={selected?.id}
              onSelect={selectFromMap}
            />
          </Suspense>
        </section>
      </div>
    </main>
  )
}
