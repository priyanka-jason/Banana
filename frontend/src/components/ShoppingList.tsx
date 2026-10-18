import { useEffect, useMemo, useRef, useState } from 'react'
import { BasketIcon } from '@phosphor-icons/react/dist/csr/Basket'
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus'
import { MinusIcon } from '@phosphor-icons/react/dist/csr/Minus'
import { TrashIcon } from '@phosphor-icons/react/dist/csr/Trash'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import {
  shoppingList,
  useShoppingList,
  useBasketChoice,
} from '../data/shoppingListState'
import { useCatalogue } from '../data/catalogueState'
import { currency } from '../lib/catalogue'
import { MAX_QUANTITY, itemCount } from '../lib/shoppingList'
import { productRequest, samePackage } from '../lib/basketIdentity'
import { compareBasket } from '../lib/basketComparison'
import { BasketOptions, BasketPlanDetails } from './BasketComparison'
import type { NearbyOffer } from '../types'

export function AddToListButton({ offer }: { offer: NearbyOffer }) {
  const list = useShoppingList()
  const { data } = useCatalogue()
  const inList = list.find((item) => samePackage(item, productRequest(offer)))
  return (
    <button
      className="list-add-button"
      disabled={Boolean(inList && inList.quantity >= MAX_QUANTITY)}
      onClick={() => shoppingList.add(offer, data?.offers)}
      aria-label={`Add ${offer.name} from ${offer.store.name} to my list${inList ? `, ${inList.quantity} already in list` : ''}`}
    >
      <PlusIcon size={16} aria-hidden="true" />
      {inList ? `In list (${inList.quantity})` : 'Add to list'}
    </button>
  )
}
function ListDialog({ onClose }: { onClose: () => void }) {
  const list = useShoppingList()
  const choice = useBasketChoice()
  const { data, loading, error, retry } = useCatalogue()
  const ref = useRef<HTMLDialogElement>(null)
  const selectedRef = useRef<HTMLElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  const comparison = useMemo(
    () =>
      data && list.length
        ? compareBasket(list, data.offers, data.stores)
        : null,
    [list, data],
  )
  const selected = comparison
    ? ([
        comparison.requested,
        ...comparison.exact,
        ...comparison.alternatives,
        ...(comparison.split ? [comparison.split] : []),
      ].find((plan) => plan.id === choice) ?? comparison.requested)
    : null
  function chooseBasket(id: string) {
    shoppingList.choose(id)
    requestAnimationFrame(() => {
      selectedRef.current?.focus({ preventScroll: true })
      selectedRef.current?.scrollIntoView({
        block: 'start',
        behavior: 'instant',
      })
    })
  }
  return (
    <dialog
      ref={ref}
      className="list-dialog basket-dialog"
      aria-labelledby="list-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="dialog-inner">
        <div className="filter-dialog-heading">
          <h2 id="list-title">My list</h2>
          <button
            className="icon-button"
            aria-label="Close my list"
            onClick={onClose}
          >
            <XIcon size={23} />
          </button>
        </div>
        {list.length ? (
          <>
            <p className="list-note">
              One requested list. Compare the total at each chain, or review
              different packaging before choosing.
            </p>
            <section
              className="requested-basket"
              aria-labelledby="requested-basket-title"
            >
              <h3 id="requested-basket-title">Your requested items</h3>
              <ul>
                {list.map((item) => (
                  <li key={item.offerId}>
                    <div className="list-item-text">
                      <strong>{item.name}</strong>
                      <span>
                        {item.quantity} ×{' '}
                        {item.pack || 'Package size unavailable'}
                      </span>
                    </div>
                    <div className="list-stepper">
                      <button
                        className="icon-button"
                        aria-label={`${item.quantity === 1 ? 'Remove' : 'Fewer'} ${item.name}`}
                        onClick={() =>
                          shoppingList.setQuantity(
                            item.offerId,
                            item.quantity - 1,
                          )
                        }
                      >
                        {item.quantity === 1 ? (
                          <TrashIcon size={18} />
                        ) : (
                          <MinusIcon size={18} />
                        )}
                      </button>
                      <span aria-live="polite">{item.quantity}</span>
                      <button
                        className="icon-button"
                        disabled={item.quantity >= MAX_QUANTITY}
                        aria-label={`More ${item.name}`}
                        onClick={() =>
                          shoppingList.setQuantity(
                            item.offerId,
                            item.quantity + 1,
                          )
                        }
                      >
                        <PlusIcon size={18} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
            {loading ? (
              <p role="status">Refreshing Supabase prices…</p>
            ) : error ? (
              <div role="alert">
                <p>
                  Basket prices could not be loaded. No saved prices are being
                  substituted.
                </p>
                <button className="flyer-button" onClick={retry}>
                  Retry prices
                </button>
              </div>
            ) : selected && comparison ? (
              <>
                {choice && selected.id !== choice && (
                  <p className="basket-notice" role="status">
                    Your previous basket option changed or is no longer
                    available. Review the current options before choosing again.
                  </p>
                )}
                <section
                  ref={selectedRef}
                  tabIndex={-1}
                  className="chosen-basket"
                  aria-label="Selected basket"
                >
                  <div className="basket-option-heading">
                    <div>
                      <h3>
                        {selected.kind === 'requested'
                          ? 'Your requested basket'
                          : `Selected: ${selected.name}`}
                      </h3>
                      <p>
                        {selected.kind === 'alternative'
                          ? 'Different packages — original request preserved'
                          : new Set(selected.picks.map((pick) => pick.store.id))
                                .size > 1
                            ? 'Split across stores'
                            : 'Exact requested packages'}
                      </p>
                    </div>
                    <strong className="chosen-total">
                      {selected.picks.length
                        ? currency(selected.totalCents / 100)
                        : 'Unavailable'}
                      {!selected.complete && (
                        <small>Matched-items subtotal</small>
                      )}
                    </strong>
                  </div>
                  <details open={selected.kind === 'alternative'}>
                    <summary>Review selected basket</summary>
                    <BasketPlanDetails plan={selected} />
                  </details>
                  {selected.id !== 'requested' && (
                    <button
                      className="text-button"
                      onClick={() => shoppingList.choose('requested')}
                    >
                      Return to requested basket
                    </button>
                  )}
                </section>
                <BasketOptions
                  comparison={comparison}
                  selectedId={selected.id}
                  onChoose={chooseBasket}
                />
                <p className="list-note">
                  {data?.simulated ? 'Simulated Supabase prices. ' : ''}
                  Catalogue prices, not live stock confirmation. Comparisons
                  cover all catalogue chains.{' '}
                  <button className="text-button" onClick={retry}>
                    Refresh prices
                  </button>
                </p>
              </>
            ) : null}
            <p className="list-note">
              Total doesn’t include taxes or other fees, such as environmental
              handling fees (EHF) or container deposits.
            </p>
            <div className="filter-dialog-actions">
              <button className="text-button" onClick={shoppingList.clear}>
                Clear list
              </button>
              <button className="flyer-button" onClick={onClose}>
                Keep searching
              </button>
            </div>
          </>
        ) : (
          <div className="list-empty">
            <BasketIcon size={38} aria-hidden="true" />
            <p>
              Your list is empty. Search groceries and press “Add to list” to
              compare whole-basket costs.
            </p>
            <button className="flyer-button" onClick={onClose}>
              Keep searching
            </button>
          </div>
        )}
      </div>
    </dialog>
  )
}
export function ListLauncher() {
  const list = useShoppingList()
  const { data } = useCatalogue()
  const [open, setOpen] = useState(false)
  const count = itemCount(list)
  return (
    <>
      <button
        className="list-launcher"
        onClick={() => {
          if (data) shoppingList.reconcile(data.offers)
          setOpen(true)
        }}
        aria-label={`My list, ${count} ${count === 1 ? 'item' : 'items'}`}
      >
        <BasketIcon size={22} aria-hidden="true" />
        My list<span className="list-count">{count}</span>
      </button>
      {open && <ListDialog onClose={() => setOpen(false)} />}
    </>
  )
}
