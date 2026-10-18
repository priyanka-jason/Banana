import { CatalogueContext } from './catalogueState'
import { useCallback, useEffect, useState } from 'react'
import { loadCatalogue, type Catalogue } from '../api/supabaseCatalogue'
import { catalogueKey, catalogueUrl } from '../lib/supabaseClient'
import { loadSavedCatalogue, saveCatalogue } from '../lib/offlineCatalogue'

export function CatalogueProvider({ children }: { children: React.ReactNode }) {
  const url = catalogueUrl
  const key = catalogueKey
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{
    revision: number
    data: Catalogue | null
    error: string
    savedAt: string
  } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(
      () =>
        controller.abort(
          new Error('Supabase request timed out. Please retry.'),
        ),
      20000,
    )
    Promise.resolve()
      .then(() => {
        if (!url || !key)
          throw new Error(
            'Supabase is not configured. Add the project URL and publishable key to frontend/.env.local, then restart Vite.',
          )
        return loadCatalogue(url, key, controller.signal)
      })
      .then((data) => {
        if (controller.signal.aborted) return
        setResult({ revision, data, error: '', savedAt: '' })
        void saveCatalogue(data)
      })
      .catch(async (error) => {
        if (
          controller.signal.aborted &&
          controller.signal.reason?.name === 'AbortError'
        )
          return
        // No connection (or Supabase down): show the last saved prices, labelled.
        const saved = await loadSavedCatalogue()
        if (saved) {
          setResult({
            revision,
            data: saved.catalogue,
            error: '',
            savedAt: saved.savedAt,
          })
          return
        }
        setResult({
          revision,
          data: null,
          savedAt: '',
          error:
            error instanceof Error
              ? error.message
              : 'Supabase is unavailable. Please retry.',
        })
      })
      .finally(() => clearTimeout(timeout))
    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [url, key, revision])
  const retry = useCallback(() => setRevision((value) => value + 1), [])
  const current = result?.revision === revision ? result : null
  return (
    <CatalogueContext.Provider
      value={{
        data: current?.data ?? null,
        error: current?.error ?? '',
        loading: !current,
        retry,
        connected: true,
        offline: Boolean(current?.savedAt),
        savedAt: current?.savedAt ?? '',
      }}
    >
      {children}
    </CatalogueContext.Provider>
  )
}
