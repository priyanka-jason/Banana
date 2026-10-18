export interface Plan {
  id: 'free' | 'premium'
  name: string
  price: string
  period: string
  summary: string
  features: string[]
}

export const PREMIUM_MONTHLY_PRICE = 4.99
export const FOOD_BANK_SHARE = 0.2

export const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    summary: 'Compare grocery prices near you at no cost.',
    features: [
      'Prices refreshed every 3–4 days',
      'Search and compare every store near you',
      'Store locations and distances',
      'Build a shopping list with store totals',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: `$${PREMIUM_MONTHLY_PRICE.toFixed(2)}`,
    period: 'per month (CAD)',
    summary: 'Catch every sale the day it starts.',
    features: [
      'Prices updated every day',
      'Everything in Free',
      `${Math.round(FOOD_BANK_SHARE * 100)}% of your subscription goes to local food banks`,
      'Cancel any time',
    ],
  },
]

/**
 * Where the Subscribe button sends a signed-in visitor: the Stripe Payment Link,
 * tagged with their account id (client_reference_id) so the payment can be matched
 * to the account later. Only https://buy.stripe.com links are accepted; anything
 * else (including no link configured yet) returns '' and the button stays off.
 */
export function subscribeUrl(
  paymentLink: string | undefined,
  accountId: string,
): string {
  if (!paymentLink) return ''
  let url: URL
  try {
    url = new URL(paymentLink)
  } catch {
    return ''
  }
  if (url.protocol !== 'https:' || url.hostname !== 'buy.stripe.com') return ''
  url.searchParams.set('client_reference_id', accountId)
  return url.toString()
}

/** The Stripe customer portal link (https://billing.stripe.com/...), or '' if unset or not Stripe's. */
export function portalUrl(link: string | undefined): string {
  if (!link) return ''
  try {
    const url = new URL(link)
    return url.protocol === 'https:' && url.hostname === 'billing.stripe.com'
      ? url.toString()
      : ''
  } catch {
    return ''
  }
}

/** The signed-in person's row in banana.subscriptions, written by the stripe-webhook function. */
export interface SubscriptionRow {
  status: string
  current_period_end: string | null
  cancel_at_period_end: boolean
}

export interface PremiumStatus {
  premium: boolean
  /** "renews Nov 17" or "ends Nov 17", when Stripe gave a date. */
  note: string
}

/** Premium while the subscription is active or in a trial; anything else is Free. */
export function premiumStatus(row: SubscriptionRow | null): PremiumStatus {
  if (!row || !['active', 'trialing'].includes(row.status))
    return { premium: false, note: '' }
  const end = row.current_period_end ? new Date(row.current_period_end) : null
  if (!end || Number.isNaN(end.getTime())) return { premium: true, note: '' }
  const date = new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Vancouver',
  }).format(end)
  return {
    premium: true,
    note: `${row.cancel_at_period_end ? 'ends' : 'renews'} ${date}`,
  }
}
