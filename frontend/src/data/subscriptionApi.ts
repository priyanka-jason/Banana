import { supabase } from '../lib/supabaseClient'
import type { SubscriptionRow } from '../lib/membership'

/** The signed-in person's own subscription row, or null (none yet, or not readable). */
export async function fetchMySubscription(): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .schema('banana')
    .from('subscriptions')
    .select('status,current_period_end,cancel_at_period_end')
    .maybeSingle()
  return error ? null : (data as SubscriptionRow | null)
}
