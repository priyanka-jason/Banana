import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useCatalogue } from '../data/catalogueState'
import { savedAtLabel } from '../lib/offlineCatalogue'
import { INSTALL_HINT_DISMISSED_KEY, installHintKind } from '../lib/installHint'
import './AppStatus.css'

function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** Says when prices are a saved copy or the device has no connection. */
export function OfflineBanner() {
  const { offline, savedAt, retry } = useCatalogue()
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  )
  // Signal is back: fetch fresh prices instead of the saved copy.
  const wasOnline = useRef(online)
  useEffect(() => {
    if (online && !wasOnline.current && offline) retry()
    wasOnline.current = online
  }, [online, offline, retry])
  if (online && !offline) return null
  return (
    <div className="app-status offline-banner" role="status">
      <p className="shell">
        <strong>
          {online ? 'Prices couldn’t be refreshed.' : 'You’re offline.'}
        </strong>{' '}
        {offline
          ? `Showing prices saved ${savedAtLabel(savedAt)}, which may be out of date.`
          : 'Sign-in and saved lists need a connection.'}
        {online && offline ? (
          <>
            {' '}
            <button className="text-button" onClick={retry}>
              Try again
            </button>
          </>
        ) : null}
      </p>
    </div>
  )
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

function readDismissed() {
  try {
    return localStorage.getItem(INSTALL_HINT_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

/** Suggests adding Banana to the home screen, on phones that aren't using the installed app. */
export function InstallHint() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(
    null,
  )
  const [dismissed, setDismissed] = useState(readDismissed)
  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as InstallPromptEvent)
    }
    const installed = () => setPromptEvent(null)
    window.addEventListener('beforeinstallprompt', capture)
    window.addEventListener('appinstalled', installed)
    return () => {
      window.removeEventListener('beforeinstallprompt', capture)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])
  const kind = installHintKind({
    standalone:
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    canPrompt: Boolean(promptEvent),
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    dismissed,
  })
  if (kind === 'none') return null
  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(INSTALL_HINT_DISMISSED_KEY, '1')
    } catch {
      // Storage blocked: the hint just comes back next visit.
    }
  }
  return (
    <aside className="app-status install-hint" aria-label="Install Banana">
      <div className="shell">
        <p>
          {kind === 'ios' ? (
            <>
              Add Banana to your home screen: tap <strong>Share</strong>, then{' '}
              <strong>Add to Home Screen</strong>.
            </>
          ) : (
            'Install Banana on your phone for quick access, even offline.'
          )}
        </p>
        {kind === 'prompt' && promptEvent ? (
          <button
            className="flyer-button"
            onClick={() => {
              void promptEvent.prompt().finally(() => setPromptEvent(null))
            }}
          >
            Install app
          </button>
        ) : null}
        <button className="text-button" onClick={dismiss}>
          Not now
        </button>
      </div>
    </aside>
  )
}
