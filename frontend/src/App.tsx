import { useEffect, useState } from 'react'
import { Header, MobileNav } from './components/Header'
import { OfferDialog } from './components/OfferDialog'
import { HomePage } from './features/HomePage'
import { SearchPage } from './features/SearchPage'
import { LocationsPage } from './features/LocationsPage'
import type { SearchOrigin } from './data/storeLocations'
import { readFilters } from './lib/catalogue'
import { loadSavedOrigin, saveOrigin } from './lib/locations'
import { useRoute } from './lib/navigation'
import type { NearbyOffer } from './types'
import { BackendReadiness } from './components/BackendReadiness'
import './App.css'
import { useCatalogue } from './data/catalogueState'

function App() {
  const { page, params } = useRoute()
  const catalogue = useCatalogue()
  const canonicalParams = new URLSearchParams(params)
  if (canonicalParams.get('store') === 'superstore')
    canonicalParams.set('store', 'real-canadian-superstore')
  const filters = readFilters(canonicalParams, {
    stores: catalogue.data?.stores.map((store) => store.id) ?? [],
    categories: catalogue.data?.offers.map((offer) => offer.category) ?? [],
  })
  const [selected, setSelected] = useState<NearbyOffer | null>(null)
  const [origin, setOriginState] = useState<SearchOrigin | null>(
    loadSavedOrigin,
  )

  const setOrigin = (nextOrigin: SearchOrigin | null) => {
    setOriginState(nextOrigin)
    saveOrigin(nextOrigin)
  }
  useEffect(() => {
    document.title = `${page === 'home' ? 'Nearby grocery deals' : page === 'locations' ? 'Grocery store locations' : 'Search groceries'} | Banana`
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [page])
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('main-content')?.focus()
        }}
      >
        Skip to content
      </a>
      <Header
        page={page}
        params={params}
        area={filters.area}
        onAreaChange={() => setOrigin(null)}
      />
      <BackendReadiness />
      {catalogue.loading || catalogue.error ? (
        <main
          id="main-content"
          tabIndex={-1}
          className="shell empty-state"
          aria-live="polite"
        >
          <h1 className="page-title">
            {catalogue.loading
              ? 'Loading groceries…'
              : 'Unable to load groceries'}
          </h1>
          <p>
            {catalogue.loading ? 'Connecting to Supabase.' : catalogue.error}
          </p>
          {catalogue.error && (
            <button className="flyer-button" onClick={catalogue.retry}>
              Try again
            </button>
          )}
        </main>
      ) : page === 'home' ? (
        <HomePage
          filters={filters}
          params={params}
          onOpen={setSelected}
          origin={origin}
        />
      ) : page === 'locations' ? (
        <LocationsPage
          key={filters.area}
          filters={filters}
          params={params}
          onOpen={setSelected}
          origin={origin}
          onOriginChange={setOrigin}
        />
      ) : (
        <SearchPage
          filters={filters}
          params={params}
          onOpen={setSelected}
          origin={origin}
        />
      )}
      <MobileNav page={page} params={params} />
      {selected ? (
        <OfferDialog offer={selected} onClose={() => setSelected(null)} />
      ) : null}
    </>
  )
}

export default App
