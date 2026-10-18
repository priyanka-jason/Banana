import { useEffect, useState } from 'react'
import { Header, MobileNav } from './components/Header'
import { OfferDialog } from './components/OfferDialog'
import { AuthModal } from './components/AuthModal'
import { ProfileModal } from './components/ProfileModal'
import { MembershipsModal } from './components/MembershipsModal'
import { SavedListsModal } from './components/SavedLists'
import { HomePage } from './features/HomePage'
import { SearchPage } from './features/SearchPage'
import { LocationsPage } from './features/LocationsPage'
import { MembershipPage } from './features/MembershipPage'
import type { SearchOrigin } from './data/storeLocations'
import { readFilters } from './lib/catalogue'
import { loadSavedOrigin, saveOrigin } from './lib/locations'
import { useRoute } from './lib/navigation'
import type { NearbyOffer } from './types'
import { BackendReadiness } from './components/BackendReadiness'
import { ListLauncher } from './components/ShoppingList'
import './App.css'
import { useCatalogue } from './data/catalogueState'
import { useAuth } from './data/authState'

function App() {
  const { page, params } = useRoute()
  const catalogue = useCatalogue()
  const { account } = useAuth()
  const canonicalParams = new URLSearchParams(params)
  if (canonicalParams.get('store') === 'superstore')
    canonicalParams.set('store', 'real-canadian-superstore')
  const filters = readFilters(canonicalParams, {
    stores: catalogue.data?.stores.map((store) => store.id) ?? [],
    categories: catalogue.data?.offers.map((offer) => offer.category) ?? [],
  })
  const [selected, setSelected] = useState<NearbyOffer | null>(null)
  const [savedOrigin] = useState(loadSavedOrigin)
  const accountLocationKey = JSON.stringify([
    account?.id,
    account?.use_location,
    account?.latitude,
    account?.longitude,
    account?.location_label,
  ])
  const [originOverride, setOriginOverride] = useState<{
    key: string
    value: SearchOrigin | null
  } | null>(null)
  const accountOrigin: SearchOrigin | null =
    account?.use_location &&
    Number.isFinite(account.latitude) &&
    Number.isFinite(account.longitude)
      ? {
          label: account.location_label || 'Your saved location',
          latitude: account.latitude!,
          longitude: account.longitude!,
        }
      : null
  const origin =
    originOverride?.key === accountLocationKey
      ? originOverride.value
      : (accountOrigin ?? savedOrigin)
  const setOrigin = (nextOrigin: SearchOrigin | null) => {
    setOriginOverride({ key: accountLocationKey, value: nextOrigin })
    saveOrigin(nextOrigin)
  }

  useEffect(() => {
    document.title = `${page === 'home' ? 'Nearby grocery deals' : page === 'locations' ? 'Grocery store locations' : page === 'plans' ? 'Plans' : 'Search groceries'} | Banana`
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
      <Header page={page} params={params} />
      <BackendReadiness />
      {page === 'plans' ? (
        <MembershipPage />
      ) : catalogue.loading || catalogue.error ? (
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
      <ListLauncher />
      <MobileNav page={page} params={params} />
      {selected ? (
        <OfferDialog offer={selected} onClose={() => setSelected(null)} />
      ) : null}
      <AuthModal />
      <ProfileModal />
      <MembershipsModal />
      <SavedListsModal />
    </>
  )
}

export default App
