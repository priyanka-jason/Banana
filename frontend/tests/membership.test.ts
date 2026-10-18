import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  plans,
  portalUrl,
  premiumStatus,
  subscribeUrl,
} from '../src/lib/membership.ts'

test('Free refreshes every 3-4 days, Premium every day at $4.99 with 20% to food banks', () => {
  const [free, premium] = plans
  assert.equal(free.price, '$0')
  assert.ok(free.features.includes('Prices refreshed every 3–4 days'))
  assert.equal(premium.price, '$4.99')
  assert.ok(premium.features.includes('Prices updated every day'))
  assert.ok(
    premium.features.includes(
      '20% of your subscription goes to local food banks',
    ),
  )
})

test('subscribe link carries the account id to Stripe', () => {
  assert.equal(
    subscribeUrl('https://buy.stripe.com/test_abc123', 'user-1'),
    'https://buy.stripe.com/test_abc123?client_reference_id=user-1',
  )
})

test('no link, or a link that is not a Stripe Payment Link, keeps the button off', () => {
  assert.equal(subscribeUrl(undefined, 'user-1'), '')
  assert.equal(subscribeUrl('', 'user-1'), '')
  assert.equal(subscribeUrl('not a url', 'user-1'), '')
  assert.equal(subscribeUrl('http://buy.stripe.com/x', 'user-1'), '')
  assert.equal(subscribeUrl('https://example.com/pay', 'user-1'), '')
})

test('Premium only while the subscription is active or trialing', () => {
  const base = {
    current_period_end: '2026-11-17T20:00:00Z',
    cancel_at_period_end: false,
  }
  assert.deepEqual(premiumStatus({ ...base, status: 'active' }), {
    premium: true,
    note: 'renews Nov 17, 2026',
  })
  assert.equal(
    premiumStatus({ ...base, status: 'trialing', cancel_at_period_end: true })
      .note,
    'ends Nov 17, 2026',
  )
  for (const status of ['past_due', 'canceled', 'unpaid', 'incomplete'])
    assert.equal(premiumStatus({ ...base, status }).premium, false)
  assert.equal(premiumStatus(null).premium, false)
  assert.deepEqual(
    premiumStatus({
      status: 'active',
      current_period_end: null,
      cancel_at_period_end: false,
    }),
    { premium: true, note: '' },
  )
})

test('Manage subscription only links to Stripe’s customer portal', () => {
  assert.equal(
    portalUrl('https://billing.stripe.com/p/login/test_abc'),
    'https://billing.stripe.com/p/login/test_abc',
  )
  assert.equal(portalUrl(undefined), '')
  assert.equal(portalUrl('https://example.com/portal'), '')
  assert.equal(portalUrl('http://billing.stripe.com/p/login/x'), '')
})
