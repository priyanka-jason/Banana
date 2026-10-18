// Turns off page zoom in the installed app (added to the home screen), so it feels
// like a native app. The website in a browser keeps pinch-zoom, which people with
// low vision rely on. The map keeps its own pinch-zoom: MapLibre handles that itself.

/** The viewport for the installed app: same as index.html, plus no zooming. */
export const APP_VIEWPORT =
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'

/** Class on <html> while running as the installed app (see index.css). */
export const INSTALLED_APP_CLASS = 'installed-app'

/** The parts of window this needs. */
export interface AppWindow {
  matchMedia: (query: string) => { matches: boolean }
  /** iPhone/iPad Safari sets this when opened from the home screen. */
  navigator: { standalone?: boolean }
}

/** The parts of document this needs. */
export interface AppDocument {
  querySelector: (
    selector: string,
  ) => { setAttribute: (name: string, value: string) => void } | null
  documentElement: { classList: { add: (name: string) => void } }
  addEventListener: (
    type: string,
    listener: (event: { preventDefault: () => void }) => void,
    options: { passive: boolean },
  ) => void
}

/** Running from the home screen rather than in a browser tab. */
export function isInstalledApp(win: AppWindow): boolean {
  return (
    win.matchMedia('(display-mode: standalone)').matches ||
    win.navigator.standalone === true
  )
}

/** In the installed app, stop pinch and double-tap zoom. Returns whether it did. */
export function lockAppZoom(doc: AppDocument, win: AppWindow): boolean {
  if (!isInstalledApp(win)) return false
  doc
    .querySelector('meta[name="viewport"]')
    ?.setAttribute('content', APP_VIEWPORT)
  doc.documentElement.classList.add(INSTALLED_APP_CLASS)
  // iPhones ignore user-scalable=no, so also cancel Safari's pinch gesture.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend'])
    doc.addEventListener(type, (event) => event.preventDefault(), {
      passive: false,
    })
  return true
}
