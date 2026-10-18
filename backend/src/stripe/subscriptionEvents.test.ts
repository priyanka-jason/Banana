import { describe, expect, it } from 'vitest'
import {
  accountFromCheckout,
  subscriptionFields,
} from '../../supabase/functions/stripe-webhook/handler'

const USER = '0f8c3a52-6c1e-4b8e-9a51-2f4a7d9e1b23'

describe('accountFromCheckout', () => {
  it('reads the Banana account and subscription from a subscription checkout', () => {
    expect(
      accountFromCheckout({
        mode: 'subscription',
        client_reference_id: USER.toUpperCase(),
        subscription: 'sub_123',
      }),
    ).toEqual({ userId: USER, subscriptionId: 'sub_123' })
    expect(
      accountFromCheckout({
        mode: 'subscription',
        client_reference_id: USER,
        subscription: { id: 'sub_456' },
      }),
    ).toEqual({ userId: USER, subscriptionId: 'sub_456' })
  })

  it('ignores one-off payments, missing or invalid account ids, and missing subscriptions', () => {
    expect(
      accountFromCheckout({ mode: 'payment', client_reference_id: USER, subscription: 'sub_1' }),
    ).toBeNull()
    expect(accountFromCheckout({ mode: 'subscription', subscription: 'sub_1' })).toBeNull()
    expect(
      accountFromCheckout({
        mode: 'subscription',
        client_reference_id: 'not-a-uuid',
        subscription: 'sub_1',
      }),
    ).toBeNull()
    expect(
      accountFromCheckout({ mode: 'subscription', client_reference_id: USER }),
    ).toBeNull()
  })
})

describe('subscriptionFields', () => {
  it('turns a Stripe subscription into a subscriptions row', () => {
    expect(
      subscriptionFields({
        id: 'sub_123',
        customer: 'cus_9',
        status: 'active',
        cancel_at_period_end: false,
        current_period_end: 1_793_000_000,
      }),
    ).toEqual({
      stripe_subscription_id: 'sub_123',
      stripe_customer_id: 'cus_9',
      status: 'active',
      current_period_end: new Date(1_793_000_000 * 1000).toISOString(),
      cancel_at_period_end: false,
    })
  })

  it('reads the period end from the first item on newer Stripe API versions', () => {
    const fields = subscriptionFields({
      id: 'sub_1',
      customer: { id: 'cus_1' },
      status: 'canceled',
      cancel_at_period_end: true,
      items: { data: [{ current_period_end: 1_793_000_000 }] },
    })
    expect(fields?.stripe_customer_id).toBe('cus_1')
    expect(fields?.status).toBe('canceled')
    expect(fields?.cancel_at_period_end).toBe(true)
    expect(fields?.current_period_end).toBe(new Date(1_793_000_000 * 1000).toISOString())
  })

  it('leaves the period end empty when Stripe gives none, and rejects unknown statuses', () => {
    expect(
      subscriptionFields({ id: 'sub_1', customer: 'cus_1', status: 'incomplete' })
        ?.current_period_end,
    ).toBeNull()
    expect(
      subscriptionFields({ id: 'sub_1', customer: 'cus_1', status: 'something_new' }),
    ).toBeNull()
  })
})
