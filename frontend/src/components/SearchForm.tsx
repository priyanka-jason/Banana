import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
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
  return (
    <p className="freshness">
      Sample prices (CAD)<span aria-hidden="true"> · </span>
      <time dateTime="2026-10-17T06:00:00-07:00">
        Updated Oct 17, 2026, 6:00 AM
      </time>
    </p>
  )
}
