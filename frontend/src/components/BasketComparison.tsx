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
                ? 'Different quantity'
                : 'Same amount · different pack'}
            </span>
            <span>
              Original: {pick.requestedQuantity} × {pick.requestedPack}
              {pick.requestedBase !== undefined
                ? ` (${amountLabel(pick.requestedBase, pick.sizeKind)})`
                : ''}
            </span>
            {pick.extraBase! > 0.000001 && (
              <span>+{amountLabel(pick.extraBase!, pick.sizeKind)} extra</span>
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
            Missing: {line.quantity} × {line.name} ({line.pack})
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
              ? 'Different packaging'
              : plan.kind === 'split'
                ? `${new Set(plan.picks.map((pick) => pick.store.id)).size} stores`
                : plan.complete
                  ? 'Exact match'
                  : `${plan.picks.length} matched · ${plan.missing.length} missing`}
          </p>
        </div>
        <div className="basket-option-total">
          <strong>
            {plan.picks.length
              ? currency(plan.totalCents / 100)
              : 'Unavailable'}
          </strong>
          <span>{!plan.complete && 'Subtotal'}</span>
        </div>
      </div>
      {plan.complete && delta > 0 && (
        <p className="basket-saving">
          Save {currency(delta / 100)} vs original
        </p>
      )}
      <div className="basket-option-actions">
        <details>
          <summary>Items{!plan.complete ? ' & missing' : ''}</summary>
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
            {selectedId === plan.id ? 'Selected' : 'Use basket'}
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
      <h3 id="basket-compare-title">Compare stores</h3>
      {comparison.unverified.length > 0 && (
        <p className="basket-notice">
          Matching unavailable:{' '}
          {comparison.unverified.map((line) => line.name).join(', ')}.
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
        <p className="basket-notice">No complete exact match.</p>
      )}
      <h4 className="basket-section-label">Other pack sizes</h4>
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
        <p className="list-note">No cheaper alternatives.</p>
      )}
      {comparison.split && (
        <>
          <h4 className="basket-section-label">Split across stores</h4>
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
            Missing items ({comparison.incomplete.length} stores)
          </summary>
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
