import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { stores } from '../data/mockOffers'
import type { Filters, SortOrder } from '../types'

interface SelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
  className?: string
}
export function SelectControl({
  label,
  value,
  onChange,
  children,
  className = '',
}: SelectProps) {
  return (
    <label className={`select-control ${className}`}>
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
      <CaretDownIcon size={16} aria-hidden="true" />
    </label>
  )
}

export function RadiusSelect({
  value,
  onChange,
  label = 'Distance',
}: {
  value: number
  onChange: (value: number) => void
  label?: string
}) {
  return (
    <SelectControl
      label={label}
      value={String(value)}
      onChange={(next) => onChange(Number(next))}
    >
      {[1, 3, 5, 10].map((km) => (
        <option key={km} value={km}>
          Within {km} km
        </option>
      ))}
    </SelectControl>
  )
}

export function SortSelect({
  value,
  onChange,
  label = 'Sort results',
}: {
  value: SortOrder
  onChange: (value: SortOrder) => void
  label?: string
}) {
  return (
    <SelectControl
      label={label}
      value={value}
      onChange={(next) => onChange(next as SortOrder)}
      className="sort-control"
    >
      <option value="recommended">Sort: Featured</option>
      <option value="price">Lowest price</option>
      <option value="price-desc">Highest price</option>
      <option value="distance">Nearest first</option>
      <option value="discount">Biggest discount</option>
    </SelectControl>
  )
}

export function FilterControls({
  filters,
  onChange,
}: {
  filters: Filters
  onChange: (patch: Partial<Filters>) => void
}) {
  return (
    <>
      <SelectControl
        label="Category"
        value={filters.category}
        onChange={(category) => onChange({ category })}
      >
        <option value="all">Category: All</option>
        {['Produce', 'Dairy', 'Eggs'].map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </SelectControl>
      <SelectControl
        label="Store"
        value={filters.store}
        onChange={(store) => onChange({ store })}
      >
        <option value="all">Store: All</option>
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
          </option>
        ))}
      </SelectControl>
      <RadiusSelect
        value={filters.radius}
        onChange={(radius) => onChange({ radius })}
      />
      <label className="discount-toggle">
        <input
          type="checkbox"
          role="switch"
          checked={filters.discountsOnly}
          onChange={(event) =>
            onChange({ discountsOnly: event.target.checked })
          }
        />
        <span className="switch-track" aria-hidden="true">
          <span />
        </span>
        <span>Discounts only</span>
      </label>
    </>
  )
}
