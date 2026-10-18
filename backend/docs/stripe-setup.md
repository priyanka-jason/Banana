# Turning on Premium subscriptions (Stripe)

The code is in place: the Plans page, the `stripe-webhook` Supabase Edge Function and
migration 006. These steps connect it to a Stripe account. Do them in **test mode** first
(the "Test mode" switch in the Stripe dashboard); test mode uses fake cards and no real money.

Never paste a Stripe **secret** key (`sk_...` or `rk_...`) into the website, the repo, a chat
or Cloudflare. It only goes into Supabase's Edge Function secrets (step 5).

## 1. Database (after the PR is merged)

Run `backend/sql/migrations/006_subscriptions.sql` in the Supabase SQL Editor. It adds
`banana.subscriptions`: one row per subscriber, readable only by that person, writable only
by the webhook function.

## 2. Stripe account and product

1. Create a Stripe account at https://dashboard.stripe.com (free; Stripe takes a fee per payment).
2. **Product catalogue → Add product**: name "Banana Premium", recurring, **$4.99 CAD monthly**.

## 3. Payment Link (the Subscribe button)

1. On the product, **Create payment link**.
2. Under **After payment**, choose "Don't show confirmation page" and redirect to
   `https://banana-8qk.pages.dev/#/plans?subscribed=1`.
3. Copy the link (`https://buy.stripe.com/...`).

## 4. Customer portal (the Manage subscription link)

1. **Settings → Billing → Customer portal**: allow cancelling subscriptions and updating payment methods.
2. Turn on the **customer portal login link** and copy it (`https://billing.stripe.com/p/login/...`).

## 5. The webhook function (Supabase)

1. Stripe: **Developers → API keys → Create restricted key**. Give it **Subscriptions: Read**
   (nothing else), and copy it.
2. Supabase dashboard → **Edge Functions → Secrets**: add `STRIPE_SECRET_KEY` = that restricted key.
3. Supabase dashboard → **Edge Functions → Deploy a new function → Via editor**:
   - name it `stripe-webhook`;
   - create two files with the contents of `backend/supabase/functions/stripe-webhook/index.ts`
     and `handler.ts` (if the editor only offers one file, paste `handler.ts`'s code at the top
     of `index.ts` and delete the `import ... from './handler.ts'` line);
   - turn **off** "Enforce JWT verification" (Stripe can't log in; the function checks Stripe's
     signature instead);
   - deploy.

   (Or, with the Supabase CLI installed and logged in, from `backend/`:
   `supabase functions deploy stripe-webhook`, which reads `supabase/config.toml`.)
4. Its address is `https://wkqxnxjsvrnnpikibrfh.supabase.co/functions/v1/stripe-webhook`.

## 6. Stripe webhook endpoint

1. Stripe: **Developers → Webhooks → Add endpoint**, with the address from step 5.4.
2. Events to send: `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`.
3. Copy the endpoint's **signing secret** (`whsec_...`) and add it in Supabase **Edge Functions →
   Secrets** as `STRIPE_WEBHOOK_SECRET`.

## 7. Website settings (Cloudflare Pages)

Cloudflare dashboard → Workers & Pages → the Banana project → **Settings → Variables and
Secrets**, for Production:

| Name | Value |
|---|---|
| `VITE_STRIPE_PAYMENT_LINK` | the link from step 3 |
| `VITE_STRIPE_PORTAL_LINK` | the link from step 4 |

Both are public by design (they only open Stripe's own pages). Then redeploy (Deployments →
latest → Retry deployment), because the website reads them when it's built.

## 8. Try it

1. Sign in on the site, open **Plans**, press **Subscribe with Stripe**.
2. Pay with Stripe's test card `4242 4242 4242 4242`, any future date, any CVC.
3. You land back on Plans with "Thanks for subscribing!", and within a few seconds it shows
   **You're on Premium · renews ...** with **Manage subscription**.
4. If it doesn't: Stripe → Developers → Webhooks → the endpoint shows each delivery and the
   function's reply; Supabase → Edge Functions → stripe-webhook → Logs shows errors.

When it works in test mode, repeat steps 2-7 in live mode (live keys, live webhook, live links).

## Not covered yet

- Premium users still see the same prices as Free users. Daily vs every-3-4-days prices need
  the price data itself to be kept in two versions; that's separate work.
- Taxes: Stripe Tax can add GST/PST at checkout if you turn it on in Stripe.
