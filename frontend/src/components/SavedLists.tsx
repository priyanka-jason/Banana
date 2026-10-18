import { useEffect, useState } from 'react'
import { BookmarkSimpleIcon } from '@phosphor-icons/react/dist/csr/BookmarkSimple'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { useAuth } from '../data/authState'
import { useCatalogue } from '../data/catalogueState'
import {
  shoppingList,
  useLoadedList,
  useShoppingList,
} from '../data/shoppingListState'
import {
  deleteList,
  fetchSavedLists,
  renameList,
  saveList,
} from '../data/savedListsApi'
import {
  MAX_LIST_NAME,
  cleanListName,
  formatPricesDate,
  pricesAsOf,
  type SavedList,
} from '../lib/savedLists'
import { itemCount } from '../lib/shoppingList'
import './AccountModals.css'

/**
 * Inside My basket: save the basket under a name (signed-in shoppers only).
 * onLeave closes My basket: it is a modal dialog that would cover the sign-in window.
 */
export function SaveBasket({ onLeave }: { onLeave: () => void }) {
  const { user, openAuthModal, openSavedListsModal } = useAuth()
  const basket = useShoppingList()
  const loaded = useLoadedList()
  const [name, setName] = useState('Weekly groceries')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  if (!user)
    return (
      <section className="saved-lists" aria-labelledby="save-basket-title">
        <h3 id="save-basket-title">Save this basket</h3>
        <p className="list-note">
          Buy the same things every week? Sign in to save your basket and load
          it again with the latest prices.
        </p>
        <button
          className="text-button"
          onClick={() => {
            onLeave()
            openAuthModal()
          }}
        >
          Sign in to save your basket
        </button>
      </section>
    )
  if (!basket.length) return null

  const cleanName = cleanListName(name)
  async function run(task: () => Promise<string>) {
    setBusy(true)
    setMessage('')
    try {
      setMessage(await task())
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="saved-lists" aria-labelledby="save-basket-title">
      <form
        className="saved-list-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!cleanName) return
          void run(async () => {
            const id = await saveList(null, cleanName, basket)
            shoppingList.setLoaded({ id, name: cleanName })
            return `Saved “${cleanName}”. Find it under My Account → Saved lists.`
          })
        }}
      >
        <label id="save-basket-title" htmlFor="saved-list-name">
          Save basket as
        </label>
        <div>
          <input
            id="saved-list-name"
            value={name}
            maxLength={MAX_LIST_NAME}
            onChange={(event) => setName(event.target.value)}
          />
          <button className="flyer-button" disabled={busy || !cleanName}>
            Save
          </button>
        </div>
        {loaded && (
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await saveList(loaded.id, loaded.name, basket)
                return `Updated “${loaded.name}”.`
              })
            }
          >
            Update “{loaded.name}” with this basket
          </button>
        )}
      </form>
      {message && (
        <p className="saved-list-status" role="status">
          {message}
        </p>
      )}
      <button
        className="text-button"
        onClick={() => {
          onLeave()
          openSavedListsModal()
        }}
      >
        See my saved lists
      </button>
    </section>
  )
}

/** My Account → Saved lists: load, rename or delete a saved list. */
export function SavedListsModal() {
  const { user, savedListsModalOpen, closeSavedListsModal } = useAuth()
  const { data } = useCatalogue()
  const basket = useShoppingList()
  const loaded = useLoadedList()
  const [lists, setLists] = useState<SavedList[] | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(
    null,
  )
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const open = savedListsModalOpen && Boolean(user)
  useEffect(() => {
    if (!open) return
    let current = true
    fetchSavedLists().then(
      (result) => current && setLists(result),
      (error: Error) => current && setMessage(error.message),
    )
    return () => {
      current = false
    }
  }, [open])

  if (!open) return null

  function close() {
    setMessage('')
    setRenaming(null)
    closeSavedListsModal()
  }

  async function run(task: () => Promise<string>) {
    setBusy(true)
    setMessage('')
    try {
      const done = await task()
      setLists(await fetchSavedLists())
      setMessage(done)
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function load(saved: SavedList) {
    if (
      basket.length &&
      !window.confirm(`Replace the items in My basket with “${saved.name}”?`)
    )
      return
    const offers = data?.offers ?? []
    shoppingList.load(saved, offers)
    const asOf = pricesAsOf(offers)
    setMessage(
      `Loaded “${saved.name}” into My basket.${asOf ? ` Prices as of ${formatPricesDate(asOf)}.` : ''}`,
    )
  }

  return (
    <div
      className="modal-backdrop"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-labelledby="saved-lists-title"
    >
      <div
        className="account-modal-content"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="modal-close-btn"
          onClick={close}
          aria-label="Close saved lists"
        >
          <XIcon size={20} />
        </button>
        <div className="account-modal-header">
          <h2 id="saved-lists-title">Saved lists</h2>
          <p className="account-modal-subtitle">
            Load a list into My basket with the latest prices.
          </p>
        </div>
        {message && (
          <p className="saved-list-status" role="status">
            {message}
          </p>
        )}
        {lists === null ? (
          !message && <p className="list-note">Loading your saved lists…</p>
        ) : lists.length === 0 ? (
          <p className="list-note">
            No saved lists yet. Fill My basket with what you buy every week,
            then use “Save basket as”.
          </p>
        ) : (
          <ul className="saved-list-items">
            {lists.map((saved) => (
              <li key={saved.id}>
                <BookmarkSimpleIcon size={18} aria-hidden="true" />
                {renaming?.id === saved.id ? (
                  <form
                    className="saved-list-rename"
                    onSubmit={(event) => {
                      event.preventDefault()
                      const next = cleanListName(renaming.name)
                      if (!next) return
                      setRenaming(null)
                      void run(async () => {
                        await renameList(saved.id, next)
                        if (loaded?.id === saved.id)
                          shoppingList.setLoaded({ id: saved.id, name: next })
                        return `Renamed to “${next}”.`
                      })
                    }}
                  >
                    <input
                      aria-label={`New name for ${saved.name}`}
                      value={renaming.name}
                      maxLength={MAX_LIST_NAME}
                      autoFocus
                      onChange={(event) =>
                        setRenaming({ id: saved.id, name: event.target.value })
                      }
                    />
                    <button className="text-button" disabled={busy}>
                      Save
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setRenaming(null)}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <span className="saved-list-name">
                      <strong>{saved.name}</strong>
                      <span>
                        {itemCount(saved.items)}{' '}
                        {itemCount(saved.items) === 1 ? 'item' : 'items'}
                        {loaded?.id === saved.id ? ' · in My basket' : ''}
                      </span>
                    </span>
                    <span className="saved-list-actions">
                      <button
                        className="flyer-button"
                        disabled={busy || !saved.items.length}
                        onClick={() => load(saved)}
                        aria-label={`Load ${saved.name}`}
                      >
                        Load
                      </button>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() =>
                          setRenaming({ id: saved.id, name: saved.name })
                        }
                        aria-label={`Rename ${saved.name}`}
                      >
                        Rename
                      </button>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm(`Delete “${saved.name}”?`)) return
                          if (loaded?.id === saved.id)
                            shoppingList.setLoaded(null)
                          void run(async () => {
                            await deleteList(saved.id)
                            return `Deleted “${saved.name}”.`
                          })
                        }}
                        aria-label={`Delete ${saved.name}`}
                      >
                        Delete
                      </button>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
