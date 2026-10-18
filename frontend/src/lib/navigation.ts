import { useSyncExternalStore } from 'react'
import type { Page } from '../types'

function subscribe(callback: () => void) {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}

export function useRoute() {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => '#/',
  )
  const [path, query = ''] = hash.replace(/^#/, '').split('?')
  return {
    page: (path === '/items'
      ? 'items'
      : path === '/locations'
        ? 'locations'
        : path === '/membership'
          ? 'membership'
          : 'home') as Page,
    params: new URLSearchParams(query),
  }
}

export function pageHref(page: Page, params: URLSearchParams) {
  const query = params.toString()
  return `#/${page === 'home' ? '' : page}${query ? `?${query}` : ''}`
}

export function updateRoute(
  page: Page,
  current: URLSearchParams,
  patch: Record<string, string> = {},
  replace = false,
) {
  const params = new URLSearchParams(current)
  for (const [key, value] of Object.entries(patch)) {
    if (
      !value ||
      value === 'all' ||
      (key === 'sort' && value === 'recommended')
    )
      params.delete(key)
    else params.set(key, value)
  }
  const href = pageHref(page, params)
  if (window.location.hash === href) return
  if (replace) window.history.replaceState(null, '', href)
  else window.history.pushState(null, '', href)
  // Notify the external store synchronously so controlled inputs keep their state.
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}
