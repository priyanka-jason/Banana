import { useEffect, useRef, useState } from 'react'
import { BasketIcon } from '@phosphor-icons/react/dist/csr/Basket'
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus'
import { MinusIcon } from '@phosphor-icons/react/dist/csr/Minus'
import { TrashIcon } from '@phosphor-icons/react/dist/csr/Trash'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { shoppingList, useShoppingList } from '../data/shoppingListState'
import { currency } from '../lib/catalogue'
import {
  MAX_QUANTITY,
  groupByStore,
  itemCount,
  listTotal,
} from '../lib/shoppingList'
import type { NearbyOffer } from '../types'

export function AddToListButton({ offer }: { offer: NearbyOffer }) {
  const list = useShoppingList()
  const inList = list.find((item) => item.offerId === offer.id)
  return (
    <button
      className="list-add-button"
      onClick={() => shoppingList.add(offer)}
      aria-label={`Add ${offer.name} from ${offer.store.name} to my list${inList ? `, ${inList.quantity} already in list` : ''}`}
    >
      <PlusIcon size={16} aria-hidden="true" />
      {inList ? `In list (${inList.quantity})` : 'Add to list'}
    </button>
  )
}

function ListDialog({ onClose }: { onClose: () => void }) {
  const list = useShoppingList()
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  const groups = groupByStore(list)
  return (
    <dialog
      ref={ref}
      className="list-dialog"
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
            onClick={onClose}
            aria-label="Close my list"
          >
            <XIcon size={23} />
          </button>
        </div>
        {list.length ? (
          <>
            {groups.map((group) => (
              <section key={group.storeId} className="list-group">
                <h3>
                  {group.storeName}
                  <span>{currency(group.total)}</span>
                </h3>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.offerId}>
                      <div className="list-item-text">
                        <strong>{item.name}</strong>
                        <span>
                          {item.pack ? `${item.pack} · ` : ''}
                          {currency(item.price)} each
                        </span>
                      </div>
                      <div className="list-stepper">
                        <button
                          className="icon-button"
                          onClick={() =>
                            shoppingList.setQuantity(
                              item.offerId,
                              item.quantity - 1,
                            )
                          }
                          aria-label={`${item.quantity === 1 ? 'Remove' : 'Fewer'} ${item.name}`}
                        >
                          {item.quantity === 1 ? (
                            <TrashIcon size={18} aria-hidden="true" />
                          ) : (
                            <MinusIcon size={18} aria-hidden="true" />
                          )}
                        </button>
                        <span aria-live="polite">{item.quantity}</span>
                        <button
                          className="icon-button"
                          disabled={item.quantity >= MAX_QUANTITY}
                          onClick={() =>
                            shoppingList.setQuantity(
                              item.offerId,
                              item.quantity + 1,
                            )
                          }
                          aria-label={`More ${item.name}`}
                        >
                          <PlusIcon size={18} aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <p className="list-total">
              <span>Total</span>
              <strong>{currency(listTotal(list))}</strong>
            </p>
            <p className="list-note">
              Prices are the ones shown in search. Stock may vary.
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
              Your list is empty. Search for milk, eggs or bread and press “Add
              to list”. The list stays while you search for more.
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
  const [open, setOpen] = useState(false)
  const count = itemCount(list)
  return (
    <>
      <button
        className="list-launcher"
        onClick={() => setOpen(true)}
        aria-label={`My list, ${count} ${count === 1 ? 'item' : 'items'}`}
      >
        <BasketIcon size={22} aria-hidden="true" />
        My list
        <span className="list-count">{count}</span>
      </button>
      {open ? <ListDialog onClose={() => setOpen(false)} /> : null}
    </>
  )
}
