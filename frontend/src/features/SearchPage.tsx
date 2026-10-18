import { useEffect, useRef, useState } from 'react'
import { FunnelIcon } from '@phosphor-icons/react/dist/csr/Funnel'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { FilterControls, SortSelect } from '../components/FilterControls'
import { Freshness, SearchForm } from '../components/SearchForm'
import { OfferTable } from '../components/Offer'
import { updateRoute } from '../lib/navigation'
import type { Filters, NearbyOffer } from '../types'
import { type SearchOrigin } from '../data/storeLocations'
import { useCatalogue } from '../data/catalogueState'
import { useOfferSearch } from '../data/offerSearch'
import { pageHref } from '../lib/navigation'

function FilterDialog({
  filters,
  onApply,
  onClose,
}: {
  filters: Filters
  onApply: (filters: Filters) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(filters)
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      className="filter-dialog"
      aria-labelledby="filter-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="dialog-inner">
        <div className="filter-dialog-heading">
          <h2 id="filter-title">Filters</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close filters"
          >
            <XIcon size={23} />
          </button>
        </div>
        <div className="filter-dialog-fields">
          <FilterControls
            filters={draft}
            onChange={(patch) =>
              setDraft((current) => ({ ...current, ...patch }))
            }
          />
        </div>
        <div className="filter-dialog-actions">
          <button
            className="text-button"
            onClick={() =>
              setDraft({
                ...draft,
                category: 'all',
                store: 'all',
                radius: 5,
                discountsOnly: false,
              })
            }
          >
            Reset filters
          </button>
          <button className="flyer-button" onClick={() => onApply(draft)}>
            Show results
          </button>
        </div>
      </div>
    </dialog>
  )
}

export function SearchPage({
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
  const [filterOpen, setFilterOpen] = useState(false)
  const { data } = useCatalogue()
  const branch = data!.branches.find(
    (branch) =>
      branch.id === params.get('branch') && branch.brandId === filters.store,
  )
  const search = useOfferSearch({
    filters,
    origin,
    branchId: branch?.id,
    pageSize: 20,
  })
  const items = search.items
  function change(patch: Partial<Filters>) {
    const next = { ...filters, ...patch }
    updateRoute(
      'items',
      params,
      {
        q: next.query,
        category: next.category,
        store: next.store,
        radius: String(next.radius),
        sale: next.discountsOnly ? '1' : '',
        sort: next.sort,
        branch:
          'store' in patch && patch.store !== filters.store
            ? ''
            : params.get('branch') || '',
      },
      Object.keys(patch).length === 1 && 'query' in patch,
    )
  }
  const activeCount =
    Number(filters.category !== 'all') +
    Number(filters.store !== 'all') +
    Number(filters.radius !== 5) +
    Number(filters.discountsOnly)
  const hasChanges =
    activeCount > 0 || Boolean(filters.query) || filters.sort !== 'recommended'
  return (
    <main id="main-content" tabIndex={-1} className="shell search-page">
      <h1 className="page-title">Search items</h1>
      {branch && (
        <p className="branch-context">
          Offers from this chain · {branch.name}. Stock may vary.{' '}
          <a
            href={pageHref(
              'locations',
              new URLSearchParams({
                area: filters.area,
                radius: String(filters.radius),
              }),
            )}
          >
            Back to locations
          </a>
        </p>
      )}
      <SearchForm
        id="catalogue-search"
        value={filters.query}
        onChange={(query) => change({ query })}
        onSubmit={() => {}}
        button={false}
      />
      <div className="desktop-filters">
        <FilterControls filters={filters} onChange={change} />
        <SortSelect
          value={filters.sort}
          onChange={(sort) => change({ sort })}
        />
      </div>
      <div className="mobile-filter-bar">
        <button className="filter-trigger" onClick={() => setFilterOpen(true)}>
          <FunnelIcon size={20} aria-hidden="true" />
          Filters
          {activeCount > 0 ? (
            <span className="filter-count">{activeCount}</span>
          ) : null}
        </button>
        <SortSelect
          value={filters.sort}
          onChange={(sort) => change({ sort })}
          label="Sort mobile results"
        />
      </div>
      <div className="results-meta">
        <p role="status" aria-live="polite">
          {search.loading && !items.length
            ? 'Searching…'
            : `${search.total} ${search.total === 1 ? 'offer' : 'offers'}`}
          {filters.query ? ` for “${filters.query}”` : ''}
          {hasChanges ? (
            <button
              className="reset-results text-button"
              onClick={() =>
                change({
                  query: '',
                  category: 'all',
                  store: 'all',
                  radius: 5,
                  discountsOnly: false,
                  sort: 'recommended',
                })
              }
            >
              Clear all
            </button>
          ) : null}
        </p>
      </div>
      {items.length ? (
        <>
          <OfferTable offers={items} onOpen={onOpen} />
          {search.total > items.length && (
            <button
              className="flyer-button load-more"
              disabled={search.loading}
              onClick={search.loadMore}
            >
              Show more ({items.length} of {search.total})
            </button>
          )}
        </>
      ) : search.loading ? null : (
        <div className="empty-state">
          <MagnifyingGlassIcon size={38} aria-hidden="true" />
          <h2>No matching groceries</h2>
          <p>Try a different search, a wider distance, or fewer filters.</p>
          <button
            className="flyer-button"
            onClick={() =>
              change({
                query: '',
                category: 'all',
                store: 'all',
                radius: 5,
                discountsOnly: false,
                sort: 'recommended',
              })
            }
          >
            Clear search and filters
          </button>
        </div>
      )}
      {filterOpen ? (
        <FilterDialog
          filters={filters}
          onClose={() => setFilterOpen(false)}
          onApply={(next) => {
            change(next)
            setFilterOpen(false)
          }}
        />
      ) : null}
      <footer className="page-data-note">
        <Freshness />
      </footer>
    </main>
  )
}
