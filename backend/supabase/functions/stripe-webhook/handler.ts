// What the stripe-webhook function writes to banana.subscriptions for each Stripe
// event. Plain TypeScript with no Stripe or Supabase imports, so it can be tested
// with fake events (backend/src/stripe/subscriptionEvents.test.ts).

export const SUBSCRIPTION_STATUSES = [
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused',
] as const
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

/** The parts of a Stripe Checkout Session this needs. */
export interface CheckoutSessionLike {
  mode?: string | null
  client_reference_id?: string | null
  customer?: string | { id: string } | null
  subscription?: string | { id: string } | null
}

/** The parts of a Stripe Subscription this needs. Newer Stripe API versions keep
 * the period end on each item instead of the subscription itself. */
export interface SubscriptionLike {
  id: string
  customer: string | { id: string }
  status: string
  cancel_at_period_end?: boolean | null
  current_period_end?: number | null
  items?: { data?: { current_period_end?: number | null }[] } | null
}

export interface SubscriptionFields {
  stripe_subscription_id: string
  stripe_customer_id: string
  status: SubscriptionStatus
  current_period_end: string | null
  cancel_at_period_end: boolean
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const idOf = (value: string | { id: string } | null | undefined) =>
  typeof value === 'string' ? value : (value?.id ?? '')

/**
 * Which Banana account paid, from a completed checkout. The Plans page tags the
 * Stripe Payment Link with the account id (client_reference_id). Anything that
 * isn't a subscription checkout for a valid account id is ignored.
 */
export function accountFromCheckout(
  session: CheckoutSessionLike,
): { userId: string; subscriptionId: string } | null {
  const userId = session.client_reference_id ?? ''
  const subscriptionId = idOf(session.subscription)
  if (session.mode !== 'subscription' || !UUID.test(userId) || !subscriptionId)
    return null
  return { userId: userId.toLowerCase(), subscriptionId }
}

/** A Stripe subscription as a banana.subscriptions row (without user_id). */
export function subscriptionFields(
  subscription: SubscriptionLike,
): SubscriptionFields | null {
  const status = subscription.status as SubscriptionStatus
  if (!subscription.id || !SUBSCRIPTION_STATUSES.includes(status)) return null
  const periodEnd =
    subscription.current_period_end ??
    subscription.items?.data?.[0]?.current_period_end ??
    null
  return {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: idOf(subscription.customer),
    status,
    current_period_end:
      typeof periodEnd === 'number'
        ? new Date(periodEnd * 1000).toISOString()
        : null,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
  }
}
