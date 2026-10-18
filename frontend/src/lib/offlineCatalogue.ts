import type { Catalogue } from '../api/supabaseCatalogue.ts'

// The last catalogue that loaded, kept so the app still shows prices with no
// signal. It lives in Cache Storage (no tight size limit, unlike localStorage),
// in its own cache that the service worker (public/sw.js) never clears.
export const OFFLINE_CACHE = 'banana-data'
const KEY = '/offline/catalogue.json'
const VERSION = 1

export interface SavedCatalogue {
  catalogue: Catalogue
  /** ISO time the catalogue was saved. */
  savedAt: string
}

export function encodeSavedCatalogue(
  catalogue: Catalogue,
  savedAt = new Date(),
): string {
  return JSON.stringify({
    version: VERSION,
    savedAt: savedAt.toISOString(),
    catalogue,
  })
}

/** The saved catalogue, or null when it is missing, corrupt or from an older version. */
export function decodeSavedCatalogue(text: string): SavedCatalogue | null {
  try {
    const value = JSON.parse(text)
    const catalogue = value?.catalogue
    if (
      value?.version !== VERSION ||
      typeof value.savedAt !== 'string' ||
      !Number.isFinite(Date.parse(value.savedAt)) ||
      !Array.isArray(catalogue?.stores) ||
      !Array.isArray(catalogue?.offers) ||
      !Array.isArray(catalogue?.branches)
    )
      return null
    // JSON has no Infinity; unknown distances come back as null.
    for (const offer of catalogue.offers)
      for (const area of Object.keys(offer.distances ?? {}))
        offer.distances[area] ??= Infinity
    return { catalogue, savedAt: value.savedAt }
  } catch {
    return null
  }
}

/** The part of the browser's Cache Storage used here (also easy to fake in tests). */
export interface CacheStore {
  open(name: string): Promise<{
    put(key: string, response: Response): Promise<void>
    match(key: string): Promise<Response | undefined>
  }>
}

const browserCaches = () => (globalThis as { caches?: CacheStore }).caches

/** Saves the catalogue; quietly does nothing if storage is unavailable or full. */
export async function saveCatalogue(
  catalogue: Catalogue,
  storage: CacheStore | undefined = browserCaches(),
  now = new Date(),
): Promise<void> {
  if (!storage) return
  try {
    const cache = await storage.open(OFFLINE_CACHE)
    await cache.put(
      KEY,
      new Response(encodeSavedCatalogue(catalogue, now), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  } catch {
    // Private browsing or a full disk: the app still works online.
  }
}

export async function loadSavedCatalogue(
  storage: CacheStore | undefined = browserCaches(),
): Promise<SavedCatalogue | null> {
  if (!storage) return null
  try {
    const cache = await storage.open(OFFLINE_CACHE)
    const response = await cache.match(KEY)
    return response ? decodeSavedCatalogue(await response.text()) : null
  } catch {
    return null
  }
}

/** "Oct 17, 3:40 p.m.", in Vancouver time. */
export function savedAtLabel(savedAt: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Vancouver',
  }).format(new Date(savedAt))
}
