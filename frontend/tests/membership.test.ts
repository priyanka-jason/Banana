import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plans, subscribeUrl } from '../src/lib/membership.ts'

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
