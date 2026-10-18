import { useCatalogue } from '../data/catalogueState'

export function BackendReadiness() {
  const { data, connected, retry } = useCatalogue()
  if (!connected || !data) return null
  const gaps = new Map<string, number>()
  data.offers.forEach((offer) =>
    offer.missingFields?.forEach((field) =>
      gaps.set(field, (gaps.get(field) ?? 0) + 1),
    ),
  )
  const diagnostics = data.diagnostics
  const count =
    [...gaps.values()].reduce((sum, value) => sum + value, 0) +
    (diagnostics?.excludedPrices ?? 0) +
    (diagnostics?.excludedLocations ?? 0) +
    (diagnostics?.missingAddresses ?? 0) +
    (diagnostics?.missingWebsites ?? 0) +
    (diagnostics?.missingPrices ?? 0)
  return (
    <aside
      className="shell backend-readiness"
      aria-label="Backend data readiness"
    >
      <div className="backend-readiness-heading">
        <strong>
          Supabase connected · {data.offers.length} offers ·{' '}
          {data.branches.length} stores
        </strong>
        <button className="text-button" onClick={retry}>
          Refresh data
        </button>
      </div>
      <details open={count > 0}>
        <summary>
          {count
            ? 'Backend data still needed'
            : 'Required catalogue fields are available'}
        </summary>
        {count > 0 && (
          <ul>
            {[...gaps].map(([field, count]) => (
              <li key={field}>
                <strong>{field}:</strong> missing on {count}{' '}
                {count === 1 ? 'offer' : 'offers'}
              </li>
            ))}
            {Boolean(diagnostics?.missingPrices) && (
              <li>
                <strong>Products without chain-wide prices:</strong>{' '}
                {diagnostics!.missingPrices} products
              </li>
            )}
            {Boolean(diagnostics?.excludedPrices) && (
              <li>
                <strong>Unusable prices/products:</strong>{' '}
                {diagnostics!.excludedPrices} rows excluded from display
              </li>
            )}
            {Boolean(diagnostics?.excludedLocations) && (
              <li>
                <strong>Store coordinates:</strong>{' '}
                {diagnostics!.excludedLocations} branches excluded from map
              </li>
            )}
            {Boolean(diagnostics?.missingWebsites) && (
              <li>
                <strong>Store website links:</strong> missing on{' '}
                {diagnostics!.missingWebsites} chains
              </li>
            )}
            {Boolean(diagnostics?.missingAddresses) && (
              <li>
                <strong>Street addresses:</strong> missing on{' '}
                {diagnostics!.missingAddresses} stores
              </li>
            )}
          </ul>
        )}
        <p>
          Product images and logos are frontend visual assets. All grocery and
          store data comes from Supabase.{' '}
          {data.simulated ? 'Prices include simulated demo data.' : ''} Blank
          fields are never replaced with invented values.
        </p>
      </details>
    </aside>
  )
}
