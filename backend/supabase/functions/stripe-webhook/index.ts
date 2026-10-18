// Supabase Edge Function: receives Stripe's payment notifications (webhooks) and
// records each person's Premium status in banana.subscriptions.
//
// Secrets (Supabase dashboard -> Edge Functions -> Secrets):
//   STRIPE_SECRET_KEY      a restricted Stripe key that can read subscriptions
//   STRIPE_WEBHOOK_SECRET  the signing secret of the Stripe webhook endpoint
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase itself and
// never leave it. Deploy with JWT verification off: Stripe can't send a Supabase
// login token, so the Stripe signature check below is what keeps others out.
import Stripe from 'npm:stripe@17.7.0'
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { accountFromCheckout, subscriptionFields } from './handler.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '')
// Trimmed: a secret pasted into the dashboard can carry a stray space or newline,
// which makes every signature check fail.
const signingSecret = (Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '').trim()
const cryptoProvider = Stripe.createSubtleCryptoProvider()
const db = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { db: { schema: 'banana' }, auth: { persistSession: false } },
)

const reply = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })

Deno.serve(async (request) => {
  if (request.method !== 'POST') return reply(405, 'POST only')
  const signature = request.headers.get('stripe-signature')
  if (!signature || !signingSecret) return reply(400, 'Missing signature')

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      await request.text(),
      signature,
      signingSecret,
      undefined,
      cryptoProvider,
    )
  } catch (error) {
    // Logs why the check failed, never the secret itself.
    console.error('signature check failed:', (error as Error).message, {
      secretLength: signingSecret.length,
      secretLooksRight: signingSecret.startsWith('whsec_'),
    })
    return reply(400, 'Invalid signature')
  }

  const now = new Date().toISOString()
  switch (event.type) {
    case 'checkout.session.completed': {
      const account = accountFromCheckout(event.data.object)
      if (!account) break
      const fields = subscriptionFields(
        await stripe.subscriptions.retrieve(account.subscriptionId),
      )
      if (!fields) break
      const { error } = await db
        .from('subscriptions')
        .upsert({ user_id: account.userId, ...fields, updated_at: now })
      // A failed write returns 500 so Stripe retries the event later.
      if (error) return reply(500, 'Could not save the subscription')
      break
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const fields = subscriptionFields(event.data.object)
      if (!fields) break
      const { error } = await db
        .from('subscriptions')
        .update({ ...fields, updated_at: now })
        .eq('stripe_subscription_id', fields.stripe_subscription_id)
      if (error) return reply(500, 'Could not update the subscription')
      break
    }
  }
  return reply(200, 'ok')
})
