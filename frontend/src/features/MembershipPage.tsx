import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check'
import { HandHeartIcon } from '@phosphor-icons/react/dist/csr/HandHeart'
import { useAuth } from '../data/authState'
import {
  FOOD_BANK_SHARE,
  plans,
  subscribeUrl,
  type Plan,
} from '../lib/membership'
import './MembershipPage.css'

// A Stripe Payment Link (https://buy.stripe.com/...). Public by design: it only opens
// Stripe's own checkout page. Until it is set, Subscribe stays switched off.
const paymentLink = import.meta.env.VITE_STRIPE_PAYMENT_LINK as
  string | undefined

function PremiumAction() {
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

function PlanCard({ plan }: { plan: Plan }) {
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
        <PremiumAction />
      ) : user ? (
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
  return (
    <main id="main-content" tabIndex={-1} className="shell membership-page">
      <h1 className="page-title">Membership</h1>
      <p className="membership-intro">
        Banana is free to use. Premium gets you fresher prices, so you catch
        every sale the day it starts.
      </p>
      <div className="plan-grid">
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
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
