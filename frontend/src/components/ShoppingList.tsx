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
import { amountLabel, compareBasket } from '../lib/basketComparison'
import { BasketOptions } from './BasketComparison'
import { SaveBasket } from './SavedLists'
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
      aria-label={`Add ${offer.name} from ${offer.store.name} to my basket${inList ? `, ${inList.quantity} already in basket` : ''}`}
    >
      <PlusIcon size={16} aria-hidden="true" />
      {inList ? `In basket (${inList.quantity})` : 'Add to basket'}
    </button>
  )
}
function ListDialog({ onClose }: { onClose: () => void }) {
  const list = useShoppingList()
  const choice = useBasketChoice()
  const { data, loading, error, retry } = useCatalogue()
  const ref = useRef<HTMLDialogElement>(null)
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
      ref.current?.scrollTo({ top: 0, behavior: 'smooth' })
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
          <h2 id="list-title">My basket</h2>
          <button
            className="icon-button"
            aria-label="Close my basket"
            onClick={onClose}
          >
            <XIcon size={23} />
          </button>
        </div>
        {list.length ? (
          <>
            <section
              className="requested-basket"
              aria-labelledby="requested-basket-title"
            >
              <h3 id="requested-basket-title">Your items</h3>
              <ul>
                {list.map((item) => (
                  <li key={item.offerId}>
                    <div className="list-item-text">
                      <strong>{item.name}</strong>
                      {(() => {
                        const pick = selected?.picks.find(
                          (pick) => pick.lineId === item.offerId,
                        )
                        return (
                          <>
                            <a
                              href={`#/locations?store=${encodeURIComponent(pick?.store.id ?? item.storeId)}`}
                              onClick={onClose}
                            >
                              {pick?.store.name ?? item.storeName} · Locations
                            </a>
                            <span>
                              {pick?.units ?? item.quantity} ×{' '}
                              {pick?.offer.pack ||
                                item.pack ||
                                'Package size unavailable'}
                            </span>
                            {pick && (
                              <strong>{currency(pick.lineCents / 100)}</strong>
                            )}
                            {pick && pick.change !== 'exact' && (
                              <span>
                                Different pack · requested {item.quantity} ×{' '}
                                {item.pack}
                              </span>
                            )}
                            {pick && (pick.extraBase ?? 0) > 0.000001 && (
                              <span>
                                +{amountLabel(pick.extraBase!, pick.sizeKind)}{' '}
                                extra
                              </span>
                            )}
                            {selected?.missing.some(
                              (line) => line.offerId === item.offerId,
                            ) && <span>Price unavailable</span>}
                          </>
                        )
                      })()}
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
              {selected && !loading && !error && (
                <p className="list-total">
                  <span>{selected.complete ? 'Total' : 'Subtotal'}</span>
                  <strong>{currency(selected.totalCents / 100)}</strong>
                </p>
              )}
            </section>
            {loading ? (
              <p role="status">Updating prices…</p>
            ) : error ? (
              <div role="alert">
                <p>Couldn’t load prices.</p>
                <button className="flyer-button" onClick={retry}>
                  Retry prices
                </button>
              </div>
            ) : selected && comparison ? (
              <>
                {choice && selected.id !== choice && (
                  <p className="basket-notice" role="status">
                    Previous option unavailable. Choose again.
                  </p>
                )}
                {choice && (
                  <button
                    className="text-button"
                    onClick={() => shoppingList.choose(null)}
                  >
                    Use items as added
                  </button>
                )}
                <BasketOptions
                  comparison={comparison}
                  selectedId={choice ?? ''}
                  onChoose={chooseBasket}
                />
                <p className="list-note">
                  {data?.simulated ? 'Sample prices · ' : ''}{' '}
                  <button className="text-button" onClick={retry}>
                    Refresh prices
                  </button>
                </p>
              </>
            ) : null}
            <p className="list-note">Before taxes, fees & deposits.</p>
            <SaveBasket onLeave={onClose} />
            <div className="filter-dialog-actions">
              <button className="text-button" onClick={shoppingList.clear}>
                Clear basket
              </button>
              <button className="flyer-button" onClick={onClose}>
                Keep searching
              </button>
            </div>
          </>
        ) : (
          <div className="list-empty">
            <BasketIcon size={38} aria-hidden="true" />
            <p>Your basket is empty.</p>
            <button className="flyer-button" onClick={onClose}>
              Keep searching
            </button>
            <SaveBasket onLeave={onClose} />
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
        aria-label={`My basket, ${count} ${count === 1 ? 'item' : 'items'}`}
      >
        <BasketIcon size={22} aria-hidden="true" />
        My basket<span className="list-count">{count}</span>
      </button>
      {open && <ListDialog onClose={() => setOpen(false)} />}
    </>
  )
}
