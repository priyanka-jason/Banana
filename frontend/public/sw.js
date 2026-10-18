// Service worker: lets Banana open with no signal once it has been visited.
//
// It only handles this site's own files (GET requests to the same origin).
// Supabase, Stripe, address search and every other site go straight to the
// network and are never stored here. Saved prices are handled by the app itself
// (src/lib/offlineCatalogue.ts), in a separate cache this worker leaves alone.
//
// - Pages: network first, so a new deploy shows up on the next visit; the last
//   copy is used only when the network fails.
// - /assets/*: Vite puts a content fingerprint in these names, so a stored copy
//   never goes stale. Served from the cache, fetched once.
// - Icons, images, manifest: the stored copy is shown at once and refreshed in
//   the background.
//
// Bump VERSION to throw away every stored app file on the next visit.
const VERSION = 'v1'
const SHELL = `banana-shell-${VERSION}`
const PAGE = new URL('./', self.registration.scope).href

// Store the page plus the script and style files it names, so the very first
// visit is enough to open offline later.
async function storeShell() {
  const cache = await caches.open(SHELL)
  const response = await fetch(PAGE, { cache: 'no-cache' })
  if (!response.ok) return
  const html = await response.clone().text()
  await cache.put(PAGE, response)
  const files = [
    ...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g),
  ].map((match) => new URL(match[1], PAGE).href)
  await cache.addAll([...new Set(files), 'site.webmanifest'])
}

self.addEventListener('install', (event) => {
  event.waitUntil(storeShell().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter(
              (name) => name.startsWith('banana-shell-') && name !== SHELL,
            )
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

const storable = (response) =>
  response && response.ok && response.type === 'basic'

async function networkFirstPage(request) {
  const cache = await caches.open(SHELL)
  try {
    const response = await fetch(request)
    if (storable(response)) await cache.put(PAGE, response.clone())
    return response
  } catch (error) {
    const saved = await cache.match(PAGE)
    if (saved) return saved
    throw error
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL)
  const saved = await cache.match(request)
  if (saved) return saved
  const response = await fetch(request)
  if (storable(response)) await cache.put(request, response.clone())
  return response
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(SHELL)
  const saved = await cache.match(request)
  const fresh = fetch(request).then(async (response) => {
    if (storable(response)) await cache.put(request, response.clone())
    return response
  })
  if (saved) {
    event.waitUntil(fresh.catch(() => undefined))
    return saved
  }
  return fresh
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // Development API proxy and the worker itself are never stored.
  if (url.pathname.startsWith('/api/') || url.pathname.endsWith('/sw.js'))
    return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request))
  } else if (url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirst(request))
  } else if (
    /\.(png|svg|webp|avif|jpe?g|ico|webmanifest|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(request, event))
  }
})
