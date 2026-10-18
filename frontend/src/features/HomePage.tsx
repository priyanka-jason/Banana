import { useState } from 'react'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { Freshness, SearchForm } from '../components/SearchForm'
import { RadiusSelect } from '../components/FilterControls'
import { OfferCard } from '../components/Offer'
import { getNearbyOffers } from '../lib/catalogue'
import { pageHref, updateRoute } from '../lib/navigation'
import type { Filters, NearbyOffer } from '../types'
import type { SearchOrigin } from '../data/mockLocations'

export function HomePage({
  filters,
  params,
  onOpen,
  origin,
}: {
  filters: Filters
  params: URLSearchParams
  onOpen: (offer: NearbyOffer) => void
  origin?: SearchOrigin | null
}) {
  const [query, setQuery] = useState('')
  const nearby = getNearbyOffers(filters, origin).filter(
    (offer) => offer.featured && offer.distance <= filters.radius,
  )
  const browseParams = new URLSearchParams({
    area: filters.area,
    radius: String(filters.radius),
  })
  return (
    <main id="main-content" tabIndex={-1}>
      <section className="home-intro">
        <div className="shell">
          <div className="intro-content">
            <div>
              <h1>
                <span className="headline-line">Your neighbourhood,</span>
                <br />
                for less.
              </h1>
              <p className="intro-description">
                Daily grocery discounts within {filters.radius} km.
              </p>
            </div>
            <div className="intro-search">
              <SearchForm
                id="home-search"
                value={query}
                onChange={setQuery}
                onSubmit={() =>
                  updateRoute('items', params, {
                    q: query,
                    category: '',
                    store: '',
                    sale: '',
                    sort: '',
                    branch: '',
                  })
                }
              />
              <RadiusSelect
                value={filters.radius}
                onChange={(radius) =>
                  updateRoute('home', params, { radius: String(radius) })
                }
              />
            </div>
          </div>
          <Freshness />
        </div>
      </section>
      <section className="shell deals-section" aria-labelledby="nearby-heading">
        <div className="section-heading">
          <h2 id="nearby-heading">Nearby discounts</h2>
          <a href={pageHref('items', browseParams)}>
            View all items <ArrowRightIcon size={20} aria-hidden="true" />
          </a>
        </div>
        {nearby.length ? (
          <div className="offer-grid">
            {nearby.map((offer) => (
              <OfferCard key={offer.id} offer={offer} onOpen={onOpen} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <MagnifyingGlassIcon size={36} aria-hidden="true" />
            <h3>No sample discounts within {filters.radius} km</h3>
            <p>Try a wider distance to see more nearby offers.</p>
            <button
              className="flyer-button"
              onClick={() => updateRoute('home', params, { radius: '10' })}
            >
              Show offers within 10 km
            </button>
          </div>
        )}
      </section>
    </main>
  )
}
