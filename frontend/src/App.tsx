import { useEffect, useState } from 'react'
import { Header, MobileNav } from './components/Header'
import { OfferDialog } from './components/OfferDialog'
import { HomePage } from './features/HomePage'
import { SearchPage } from './features/SearchPage'
import { LocationsPage } from './features/LocationsPage'
import type { SearchOrigin } from './data/mockLocations'
import { readFilters } from './lib/catalogue'
import { useRoute } from './lib/navigation'
import type { NearbyOffer } from './types'
import './App.css'

function App() {
  const { page, params } = useRoute()
  const filters = readFilters(params)
  const [selected, setSelected] = useState<NearbyOffer | null>(null)
  const [origin, setOrigin] = useState<SearchOrigin | null>(null)
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
      {page === 'home' ? (
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
