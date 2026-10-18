import { CatalogueContext } from './catalogueState'
import { useEffect, useState } from 'react'
import { loadCatalogue, type Catalogue } from '../api/supabaseCatalogue'

export function CatalogueProvider({ children }: { children: React.ReactNode }) {
  const url = import.meta.env.VITE_SUPABASE_URL ?? ''
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{
    revision: number
    data: Catalogue | null
    error: string
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
        if (!controller.signal.aborted) setResult({ revision, data, error: '' })
      })
      .catch((error) => {
        if (
          controller.signal.aborted &&
          controller.signal.reason?.name === 'AbortError'
        )
          return
        setResult({
          revision,
          data: null,
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
  const current = result?.revision === revision ? result : null
  return (
    <CatalogueContext.Provider
      value={{
        data: current?.data ?? null,
        error: current?.error ?? '',
        loading: !current,
        retry: () => setRevision((value) => value + 1),
        connected: true,
      }}
    >
      {children}
    </CatalogueContext.Provider>
  )
}
