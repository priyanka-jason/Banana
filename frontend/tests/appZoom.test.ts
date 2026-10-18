import test from 'node:test'
import assert from 'node:assert/strict'
import {
  APP_VIEWPORT,
  type AppDocument,
  type AppWindow,
  INSTALLED_APP_CLASS,
  isInstalledApp,
  lockAppZoom,
} from '../src/lib/appZoom.ts'

const BROWSER_VIEWPORT =
  'width=device-width, initial-scale=1.0, viewport-fit=cover'

/** Just enough of window and document for appZoom. */
function fakePage({
  standaloneMedia = false,
  iosStandalone,
}: { standaloneMedia?: boolean; iosStandalone?: boolean } = {}) {
  let viewport = BROWSER_VIEWPORT
  const classes = new Set<string>()
  const listeners: string[] = []
  const meta = {
    setAttribute: (_: string, value: string) => {
      viewport = value
    },
  }
  const doc = {
    querySelector: (selector: string) =>
      selector === 'meta[name="viewport"]' ? meta : null,
    documentElement: {
      classList: { add: (name: string) => classes.add(name) },
    },
    addEventListener: (type: string) => listeners.push(type),
  } as AppDocument
  const win = {
    matchMedia: (query: string) => ({
      matches: query === '(display-mode: standalone)' && standaloneMedia,
    }),
    navigator: { standalone: iosStandalone },
  } as AppWindow
  return { doc, win, viewport: () => viewport, classes, listeners }
}

test('a browser tab is not the installed app', () => {
  const { win } = fakePage()
  assert.equal(isInstalledApp(win), false)
})

test('the installed app is recognised on Android and on iPhone', () => {
  assert.equal(isInstalledApp(fakePage({ standaloneMedia: true }).win), true)
  assert.equal(isInstalledApp(fakePage({ iosStandalone: true }).win), true)
})

test('in a browser, zoom stays on and nothing changes', () => {
  const page = fakePage()
  assert.equal(lockAppZoom(page.doc, page.win), false)
  assert.equal(page.viewport(), BROWSER_VIEWPORT)
  assert.equal(page.classes.size, 0)
  assert.deepEqual(page.listeners, [])
})

test('in the installed app, pinch and double-tap zoom are turned off', () => {
  const page = fakePage({ iosStandalone: true })
  assert.equal(lockAppZoom(page.doc, page.win), true)
  assert.equal(page.viewport(), APP_VIEWPORT)
  assert.match(page.viewport(), /maximum-scale=1\.0, user-scalable=no/)
  assert.ok(page.classes.has(INSTALLED_APP_CLASS))
  assert.deepEqual(page.listeners, [
    'gesturestart',
    'gesturechange',
    'gestureend',
  ])
})
