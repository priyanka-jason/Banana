import { useEffect, useState } from 'react'
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check'
import { HandHeartIcon } from '@phosphor-icons/react/dist/csr/HandHeart'
import { useAuth } from '../data/authState'
import { fetchMySubscription } from '../data/subscriptionApi'
import {
  FOOD_BANK_SHARE,
  plans,
  portalUrl,
  premiumStatus,
  subscribeUrl,
  type Plan,
  type PremiumStatus,
} from '../lib/membership'
import './MembershipPage.css'

// A Stripe Payment Link (https://buy.stripe.com/...). Public by design: it only opens
// Stripe's own checkout page. Until it is set, Subscribe stays switched off.
const paymentLink = import.meta.env.VITE_STRIPE_PAYMENT_LINK as
  string | undefined
// Stripe's customer portal (https://billing.stripe.com/...), where subscribers
// cancel or change their card.
const manageLink = portalUrl(
  import.meta.env.VITE_STRIPE_PORTAL_LINK as string | undefined,
)

/** The signed-in person's Premium status. After checkout (#/plans?subscribed=1)
 * it checks again for a little while, until Stripe's webhook has recorded it. */
function usePremiumStatus(userId: string | undefined) {
  const [status, setStatus] = useState<PremiumStatus | null>(null)
  const justSubscribed = /[?&]subscribed=1\b/.test(window.location.hash)
  useEffect(() => {
    if (!userId) return
    let current = true
    let tries = 0
    let timer: number | undefined
    const check = () =>
      fetchMySubscription().then((row) => {
        if (!current) return
        const next = premiumStatus(row)
        setStatus(next)
        if (justSubscribed && !next.premium && ++tries < 10)
          timer = window.setTimeout(check, 3000)
      })
    void check()
    return () => {
      current = false
      window.clearTimeout(timer)
    }
  }, [userId, justSubscribed])
  return { status: userId ? status : null, justSubscribed }
}

function PremiumAction({ status }: { status: PremiumStatus | null }) {
  const { user, loading, openAuthModal } = useAuth()
  if (loading) return null
  if (!user)
    return (
      <>
        <button className="flyer-button plan-action" onClick={openAuthModal}>
          Sign in to subscribe
        </button>
        <p className="plan-fine-print">
          You need a free Banana account to subscribe.
        </p>
      </>
    )
  if (status?.premium)
    return (
      <>
        <p className="plan-current">
          You’re on Premium{status.note ? ` · ${status.note}` : ''}
        </p>
        {manageLink && (
          <a
            className="text-button plan-action"
            href={manageLink}
            rel="noopener"
          >
            Manage subscription
          </a>
        )}
      </>
    )
  const href = subscribeUrl(paymentLink, user.id)
  if (!href)
    return (
      <>
        <button className="flyer-button plan-action" disabled>
          Opening soon
        </button>
        <p className="plan-fine-print">
          Subscriptions open shortly. You’ll keep Free in the meantime.
        </p>
      </>
    )
  return (
    <>
      <a className="flyer-button plan-action" href={href} rel="noopener">
        Subscribe with Stripe
      </a>
      <p className="plan-fine-print">
        Secure checkout by Stripe. Banana never sees your card details.
      </p>
    </>
  )
}

function PlanCard({
  plan,
  status,
}: {
  plan: Plan
  status: PremiumStatus | null
}) {
  const { user, openAuthModal } = useAuth()
  const premium = plan.id === 'premium'
  return (
    <article
      className={`plan-card ${premium ? 'is-premium' : ''}`}
      aria-labelledby={`plan-${plan.id}`}
    >
      {premium && <p className="plan-badge">Daily prices</p>}
      <h2 id={`plan-${plan.id}`}>{plan.name}</h2>
      <p className="plan-summary">{plan.summary}</p>
      <p className="plan-price">
        <strong>{plan.price}</strong> <span>{plan.period}</span>
      </p>
      <ul className="plan-features">
        {plan.features.map((feature) => (
          <li key={feature}>
            <CheckIcon size={18} weight="bold" aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>
      {premium ? (
        <PremiumAction status={status} />
      ) : status?.premium ? null : user ? (
        <p className="plan-current">You’re on Free</p>
      ) : (
        <button className="text-button plan-action" onClick={openAuthModal}>
          Create a free account
        </button>
      )}
    </article>
  )
}

export function MembershipPage() {
  const { user } = useAuth()
  const { status, justSubscribed } = usePremiumStatus(user?.id)
  return (
    <main id="main-content" tabIndex={-1} className="shell membership-page">
      <h1 className="page-title">Plans</h1>
      <p className="membership-intro">
        Banana is free to use. Premium gets you fresher prices, so you catch
        every sale the day it starts.
      </p>
      {justSubscribed && user && !status?.premium && (
        <p className="plan-thanks" role="status">
          Thanks for subscribing! Your Premium plan will show here in a moment.
        </p>
      )}
      <div className="plan-grid">
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} status={status} />
        ))}
      </div>
      <section className="food-bank-note" aria-labelledby="food-bank-heading">
        <HandHeartIcon size={32} aria-hidden="true" />
        <div>
          <h2 id="food-bank-heading">Your subscription helps feed others</h2>
          <p>
            {Math.round(FOOD_BANK_SHARE * 100)}% of every Premium payment goes
            straight to local food banks. The other{' '}
            {Math.round((1 - FOOD_BANK_SHARE) * 100)}% keeps Banana running:
            price data, hosting and payment fees. Whatever is left over after
            those costs is donated to food banks too.
          </p>
        </div>
      </section>
      <p className="plan-fine-print membership-terms">
        Prices in Canadian dollars. Taxes may apply. Premium renews monthly
        until you cancel.
      </p>
    </main>
  )
}
