import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { useCatalogue } from '../data/catalogueState'
import type { FormEvent } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  id: string
  button?: boolean
}

export function SearchForm({
  value,
  onChange,
  onSubmit,
  id,
  button = true,
}: Props) {
  function submit(event: FormEvent) {
    event.preventDefault()
    onSubmit()
  }
  return (
    <form
      className={`search-form ${button ? 'with-button' : ''}`}
      role="search"
      onSubmit={submit}
    >
      <label className="sr-only" htmlFor={id}>
        Search groceries
      </label>
      <MagnifyingGlassIcon
        className="search-leading"
        size={23}
        aria-hidden="true"
      />
      <input
        id={id}
        type="search"
        placeholder="Search groceries"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
      />
      {value ? (
        <button
          className="clear-search icon-button"
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
        >
          <XIcon size={18} />
        </button>
      ) : null}
      {button ? (
        <button
          type="submit"
          className="search-submit"
          aria-label="Search groceries"
        >
          <MagnifyingGlassIcon size={25} />
        </button>
      ) : null}
    </form>
  )
}

export function Freshness() {
  const { data, connected } = useCatalogue()
  const dates =
    data?.offers
      .map((offer) => offer.updatedAt)
      .filter(
        (date): date is string =>
          Boolean(date) && Number.isFinite(Date.parse(date!)),
      )
      .sort() ?? []
  const oldest = dates[0]
  if (connected)
    return (
      <p className="freshness">
        {data?.simulated ? 'Simulated prices' : 'Prices'} (CAD) · Supabase
        {oldest ? (
          <>
            {' '}
            · Updated{' '}
            <time dateTime={oldest}>
              {new Intl.DateTimeFormat('en-CA', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                timeZone: 'America/Vancouver',
                timeZoneName: 'short',
              }).format(new Date(oldest))}
            </time>
          </>
        ) : (
          ' · Update time unavailable'
        )}
      </p>
    )
  return null
}
