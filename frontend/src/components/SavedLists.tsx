import { useEffect, useState } from 'react'
import { BookmarkSimpleIcon } from '@phosphor-icons/react/dist/csr/BookmarkSimple'
import { useAuth } from '../data/authState'
import { useCatalogue } from '../data/catalogueState'
import { shoppingList, useShoppingList } from '../data/shoppingListState'
import {
  deleteList,
  fetchSavedLists,
  renameList,
  saveList,
} from '../data/savedListsApi'
import {
  MAX_LIST_NAME,
  MAX_SAVED_LISTS,
  cleanListName,
  formatPricesDate,
  pricesAsOf,
  type SavedList,
} from '../lib/savedLists'
import { itemCount } from '../lib/shoppingList'

/** Save My list under a name, and load it again later (signed-in shoppers only).
 * onLeave closes My list: it is a modal dialog that would cover the sign-in window. */
export function SavedLists({ onLeave }: { onLeave: () => void }) {
  const { user, openAuthModal } = useAuth()
  const { data } = useCatalogue()
  const list = useShoppingList()
  const [lists, setLists] = useState<SavedList[] | null>(null)
  const [name, setName] = useState('Weekly groceries')
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(
    null,
  )
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const userId = user?.id
  useEffect(() => {
    if (!userId) return
    let current = true
    fetchSavedLists().then(
      (result) => current && setLists(result),
      (error: Error) => current && setMessage(error.message),
    )
    return () => {
      current = false
    }
  }, [userId])

  if (!user)
    return (
      <section className="saved-lists" aria-labelledby="saved-lists-title">
        <h3 id="saved-lists-title">Saved lists</h3>
        <p className="list-note">
          Buy the same things every week? Sign in to save this list and load it
          again with the latest prices.
        </p>
        <button
          className="text-button"
          onClick={() => {
            onLeave()
            openAuthModal()
          }}
        >
          Sign in to save lists
        </button>
      </section>
    )

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

  const loaded = lists?.find((saved) => saved.id === loadedId)
  const full = (lists?.length ?? 0) >= MAX_SAVED_LISTS
  const cleanName = cleanListName(name)

  function load(saved: SavedList) {
    if (
      list.length &&
      !window.confirm(`Replace the items in My list with “${saved.name}”?`)
    )
      return
    const offers = data?.offers ?? []
    shoppingList.replace(saved.items, offers)
    setLoadedId(saved.id)
    const asOf = pricesAsOf(offers)
    setMessage(
      `Loaded “${saved.name}”.${asOf ? ` Prices as of ${formatPricesDate(asOf)}.` : ''}`,
    )
  }

  return (
    <section className="saved-lists" aria-labelledby="saved-lists-title">
      <h3 id="saved-lists-title">Saved lists</h3>
      {list.length > 0 && (
        <form
          className="saved-list-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (!cleanName || full) return
            void run(async () => {
              const id = await saveList(null, cleanName, list)
              setLoadedId(id)
              return `Saved “${cleanName}”.`
            })
          }}
        >
          <label htmlFor="saved-list-name">Save My list as</label>
          <div>
            <input
              id="saved-list-name"
              value={name}
              maxLength={MAX_LIST_NAME}
              onChange={(event) => setName(event.target.value)}
            />
            <button
              className="flyer-button"
              disabled={busy || !cleanName || full}
            >
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
                  await saveList(loaded.id, loaded.name, list)
                  return `Updated “${loaded.name}”.`
                })
              }
            >
              Update “{loaded.name}” with these items
            </button>
          )}
          {full && (
            <p className="list-note">
              You have {MAX_SAVED_LISTS} saved lists, the most you can keep.
              Delete one to save another.
            </p>
          )}
        </form>
      )}
      {message && (
        <p className="saved-list-status" role="status">
          {message}
        </p>
      )}
      {lists === null ? (
        !message && <p className="list-note">Loading your saved lists…</p>
      ) : lists.length === 0 ? (
        <p className="list-note">
          No saved lists yet. Add the things you buy every week, then save them
          here.
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
                        if (loadedId === saved.id) setLoadedId(null)
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
    </section>
  )
}
