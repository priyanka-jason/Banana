import { currency } from '../lib/catalogue'
import {
  amountLabel,
  type BasketPick,
  type BasketPlan,
  type BasketComparison as Comparison,
} from '../lib/basketComparison'

function PickDetails({ pick }: { pick: BasketPick }) {
  return (
    <li className={pick.change === 'exact' ? '' : 'basket-changed-line'}>
      <div>
        <strong>{pick.offer.name}</strong>
        <span>{pick.store.name}</span>
        <span>
          {pick.offer.spec?.pricedByWeight && pick.suppliedBase !== undefined
            ? `${amountLabel(pick.suppliedBase, pick.sizeKind)} sold by weight`
            : `${pick.units} × ${pick.offer.pack || 'package size unavailable'}`}
        </span>
        {pick.change !== 'exact' && (
          <>
            <span className="basket-change-label">
              {pick.change === 'quantity'
                ? 'Different quantity / packaging'
                : 'Different packaging · same total amount'}
            </span>
            <span>
              Requested: {pick.requestedQuantity} × {pick.requestedPack}
              {pick.requestedBase !== undefined
                ? ` (${amountLabel(pick.requestedBase, pick.sizeKind)})`
                : ''}
            </span>
            {pick.extraBase! > 0.000001 && (
              <span>
                Includes {amountLabel(pick.extraBase!, pick.sizeKind)} extra
              </span>
            )}
          </>
        )}
      </div>
      <strong>{currency(pick.lineCents / 100)}</strong>
    </li>
  )
}
export function BasketPlanDetails({ plan }: { plan: BasketPlan }) {
  return (
    <ul className="basket-picks">
      {plan.picks.map((pick) => (
        <PickDetails key={pick.lineId} pick={pick} />
      ))}
      {plan.missing.map((line) => (
        <li className="basket-missing" key={line.offerId}>
          <span>
            Unavailable exact match: {line.quantity} × {line.name} ({line.pack})
          </span>
        </li>
      ))}
    </ul>
  )
}
function PlanCard({
  plan,
  selectedId,
  onChoose,
  baseline,
}: {
  plan: BasketPlan
  selectedId: string
  onChoose: (id: string) => void
  baseline: BasketPlan
}) {
  const delta =
    baseline.complete && plan.complete
      ? baseline.totalCents - plan.totalCents
      : 0
  return (
    <article
      className={`basket-option ${selectedId === plan.id ? 'is-chosen' : ''}`}
    >
      <div className="basket-option-heading">
        <div>
          <h4>{plan.name}</h4>
          <p>
            {plan.kind === 'alternative'
              ? 'Package changes — review before choosing'
              : plan.kind === 'split'
                ? `${new Set(plan.picks.map((pick) => pick.store.id)).size} stores · exact requested packages`
                : plan.complete
                  ? 'Exact products, packages & quantities'
                  : `${plan.picks.length} matched · ${plan.missing.length} missing`}
          </p>
        </div>
        <div className="basket-option-total">
          <strong>
            {plan.picks.length
              ? currency(plan.totalCents / 100)
              : 'Unavailable'}
          </strong>
          <span>
            {plan.complete ? 'Whole basket' : 'Matched-items subtotal'}
          </span>
        </div>
      </div>
      {plan.complete && delta > 0 && (
        <p className="basket-saving">
          Save {currency(delta / 100)} vs your requested basket
        </p>
      )}
      <div className="basket-option-actions">
        <details>
          <summary>
            View basket{!plan.complete ? ' & missing items' : ''}
          </summary>
          <BasketPlanDetails plan={plan} />
        </details>
        {plan.complete && (
          <button
            className={
              selectedId === plan.id ? 'basket-selected' : 'flyer-button'
            }
            disabled={selectedId === plan.id}
            aria-label={`Use ${plan.name} ${plan.kind === 'alternative' ? 'alternative' : 'exact'} basket for ${currency(plan.totalCents / 100)}`}
            onClick={() => onChoose(plan.id)}
          >
            {selectedId === plan.id ? 'Selected' : 'Use this basket'}
          </button>
        )}
      </div>
    </article>
  )
}
export function BasketOptions({
  comparison,
  selectedId,
  onChoose,
}: {
  comparison: Comparison
  selectedId: string
  onChoose: (id: string) => void
}) {
  return (
    <section className="basket-options" aria-labelledby="basket-compare-title">
      <h3 id="basket-compare-title">Compare whole baskets</h3>
      <p className="list-note">
        Lowest total first within each group. Exact packages stay separate from
        alternatives.
      </p>
      {comparison.unverified.length > 0 && (
        <p className="basket-notice">
          Matching data is missing for{' '}
          {comparison.unverified.map((line) => line.name).join(', ')}. We won’t
          assume similarly named items are identical.
        </p>
      )}
      <h4 className="basket-section-label">Exact matches</h4>
      {comparison.exact.length ? (
        comparison.exact.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            selectedId={selectedId}
            onChoose={onChoose}
            baseline={comparison.requested}
          />
        ))
      ) : (
        <p className="basket-notice">
          No single chain has an exact match for the full basket.
        </p>
      )}
      <h4 className="basket-section-label">
        Other packaging & quantity options
      </h4>
      <p className="list-note">
        Includes options at the same store. Your requested list is always
        preserved. Review package changes before choosing.
      </p>
      {comparison.alternatives.length ? (
        comparison.alternatives.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            selectedId={selectedId}
            onChoose={onChoose}
            baseline={comparison.requested}
          />
        ))
      ) : (
        <p className="list-note">
          No lower-cost packaging option with verified matching data was found.
        </p>
      )}
      {comparison.split && (
        <>
          <h4 className="basket-section-label">Shop across stores</h4>
          <PlanCard
            plan={comparison.split}
            selectedId={selectedId}
            onChoose={onChoose}
            baseline={comparison.requested}
          />
        </>
      )}
      {comparison.incomplete.length > 0 && (
        <details className="basket-incomplete">
          <summary>
            Incomplete exact baskets ({comparison.incomplete.length})
          </summary>
          <p className="list-note">
            These subtotals cannot be compared as complete baskets.
          </p>
          {comparison.incomplete.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              selectedId={selectedId}
              onChoose={onChoose}
              baseline={comparison.requested}
            />
          ))}
        </details>
      )}
    </section>
  )
}
