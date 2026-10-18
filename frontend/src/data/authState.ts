import { createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'
import type { UserAccountRecord } from '../lib/supabaseClient'
import type { SearchOrigin } from './storeLocations'
export interface AuthContextType {
  user: User | null
  account: UserAccountRecord | null
  loading: boolean
  authModalOpen: boolean
  profileModalOpen: boolean
  membershipsModalOpen: boolean
  openAuthModal: () => void
  closeAuthModal: () => void
  openProfileModal: () => void
  closeProfileModal: () => void
  openMembershipsModal: () => void
  closeMembershipsModal: () => void
  signInWithGoogle: () => Promise<{ error: string | null }>
  signInWithEmail: (e: string, p: string) => Promise<{ error: string | null }>
  signUpWithEmail: (
    e: string,
    p: string,
    n: string,
  ) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  updateProfileName: (newName: string) => Promise<boolean>
  saveLocationToAccount: (origin: SearchOrigin) => Promise<boolean>
  clearSavedLocation: () => Promise<boolean>
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
