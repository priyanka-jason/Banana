import test from 'node:test'
import assert from 'node:assert/strict'
import {
  installHintKind,
  isIosSafari,
  type InstallContext,
} from '../src/lib/installHint.ts'

const iphone =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const ipad =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const iosChrome =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1'
const android =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'

const phone: InstallContext = {
  standalone: false,
  canPrompt: false,
  userAgent: android,
  maxTouchPoints: 5,
  coarsePointer: true,
  dismissed: false,
}

test('Android with an install prompt gets the Install button', () => {
  assert.equal(installHintKind({ ...phone, canPrompt: true }), 'prompt')
})

test('iPhone and iPad Safari get the Share tip', () => {
  assert.equal(installHintKind({ ...phone, userAgent: iphone }), 'ios')
  assert.equal(installHintKind({ ...phone, userAgent: ipad }), 'ios')
})

test('no hint when installed, dismissed, on a desktop, or with no way to install', () => {
  assert.equal(
    installHintKind({ ...phone, canPrompt: true, standalone: true }),
    'none',
  )
  assert.equal(
    installHintKind({ ...phone, canPrompt: true, dismissed: true }),
    'none',
  )
  assert.equal(
    installHintKind({ ...phone, canPrompt: true, coarsePointer: false }),
    'none',
  )
  assert.equal(installHintKind(phone), 'none')
})

test('only Safari on iOS gets the Safari wording', () => {
  assert.equal(isIosSafari(iphone, 5), true)
  assert.equal(isIosSafari(ipad, 5), true)
  assert.equal(isIosSafari(ipad, 0), false) // a real Mac
  assert.equal(isIosSafari(iosChrome, 5), false)
})
