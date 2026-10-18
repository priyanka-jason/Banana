import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://wkqxnxjsvrnnpikibrfh.supabase.co'
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrcXhueGpzdnJubnBpa2licmZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNjc4MjksImV4cCI6MjEwNzg0MzgyOX0.HLI_rOYsA1JQChB06UcaBosoaQmLsnBKppoieyAwd3c'

export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
)

export interface UserAccountRecord {
  id: string
  email?: string
  name?: string
  use_location: boolean
  location_label?: string
  latitude?: number
  longitude?: number
  created_at?: string
  updated_at?: string
}

export async function fetchUserAccount(
  userId: string,
): Promise<UserAccountRecord | null> {
  try {
    const { data, error } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.warn('Error fetching user account profile:', error.message)
      return null
    }
    return data as UserAccountRecord | null
  } catch (err) {
    console.warn('Exception fetching user account:', err)
    return null
  }
}

export async function upsertUserAccount(
  account: Partial<UserAccountRecord> & { id: string },
): Promise<UserAccountRecord | null> {
  try {
    const payload = {
      ...account,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase
      .from('user_accounts')
      .upsert(payload)
      .select()
      .maybeSingle()

    if (error) {
      console.warn('Error updating user account:', error.message)
      return null
    }
    return data as UserAccountRecord | null
  } catch (err) {
    console.warn('Exception updating user account:', err)
    return null
  }
}
