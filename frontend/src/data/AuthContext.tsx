import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  supabase,
  fetchUserAccount,
  upsertUserAccount,
  type UserAccountRecord,
} from '../lib/supabaseClient'
import type { SearchOrigin } from '../data/storeLocations'

interface AuthContextType {
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

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [account, setAccount] = useState<UserAccountRecord | null>(null)
  const [loading, setLoading] = useState(true)

  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [membershipsModalOpen, setMembershipsModalOpen] = useState(false)

  // Initialize Auth & Subscribe to changes
  useEffect(() => {
    let mounted = true

    async function syncUserAccount(authUser: User | null) {
      if (!authUser) {
        if (mounted) setAccount(null)
        return
      }

      // Try fetching existing account row
      let dbAccount = await fetchUserAccount(authUser.id)

      if (!dbAccount) {
        // Create initial account row for user
        const initialName =
          authUser.user_metadata?.full_name ||
          authUser.user_metadata?.name ||
          authUser.email?.split('@')[0] ||
          'User'

        dbAccount = await upsertUserAccount({
          id: authUser.id,
          email: authUser.email || '',
          name: initialName,
          use_location: false,
        })
      }

      if (mounted && dbAccount) {
        setAccount(dbAccount)
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null
      if (mounted) {
        setUser(currentUser)
        setLoading(false)
      }
      if (currentUser) {
        void syncUserAccount(currentUser)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null
      if (mounted) {
        setUser(currentUser)
        setLoading(false)
      }
      if (currentUser) {
        void syncUserAccount(currentUser)
      } else {
        if (mounted) setAccount(null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      })
      if (error) return { error: error.message }
      return { error: null }
    } catch (err: any) {
      return { error: err.message || 'Failed to sign in with Google' }
    }
  }

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      })
      if (error) return { error: error.message }
      if (data.user) {
        setUser(data.user)
        setAuthModalOpen(false)
      }
      return { error: null }
    } catch (err: any) {
      return { error: err.message || 'Failed to sign in' }
    }
  }

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          data: {
            full_name: name,
            name: name,
          },
        },
      })
      if (error) return { error: error.message }
      if (data.user) {
        setUser(data.user)
        // Upsert account
        const acc = await upsertUserAccount({
          id: data.user.id,
          email: data.user.email || email,
          name: name || 'User',
          use_location: false,
        })
        if (acc) setAccount(acc)
        setAuthModalOpen(false)
      }
      return { error: null }
    } catch (err: any) {
      return { error: err.message || 'Failed to sign up' }
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setAccount(null)
    setProfileModalOpen(false)
    setMembershipsModalOpen(false)
  }

  const updateProfileName = async (newName: string): Promise<boolean> => {
    if (!user) return false
    const updated = await upsertUserAccount({
      id: user.id,
      email: user.email || account?.email || '',
      name: newName,
      use_location: account?.use_location ?? false,
      location_label: account?.location_label,
      latitude: account?.latitude,
      longitude: account?.longitude,
    })
    if (updated) {
      setAccount(updated)
      return true
    }
    return false
  }

  const saveLocationToAccount = async (
    origin: SearchOrigin,
  ): Promise<boolean> => {
    if (!user) return false
    const updated = await upsertUserAccount({
      id: user.id,
      email: user.email || account?.email || '',
      name: account?.name || user.email?.split('@')[0] || 'User',
      use_location: true,
      location_label: origin.label,
      latitude: origin.latitude,
      longitude: origin.longitude,
    })
    if (updated) {
      setAccount(updated)
      return true
    }
    return false
  }

  const clearSavedLocation = async (): Promise<boolean> => {
    if (!user) return false
    const updated = await upsertUserAccount({
      id: user.id,
      email: user.email || account?.email || '',
      name: account?.name || user.email?.split('@')[0] || 'User',
      use_location: false,
      location_label: undefined,
      latitude: undefined,
      longitude: undefined,
    })
    if (updated) {
      setAccount(updated)
      return true
    }
    return false
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        account,
        loading,
        authModalOpen,
        profileModalOpen,
        membershipsModalOpen,
        openAuthModal: () => setAuthModalOpen(true),
        closeAuthModal: () => setAuthModalOpen(false),
        openProfileModal: () => setProfileModalOpen(true),
        closeProfileModal: () => setProfileModalOpen(false),
        openMembershipsModal: () => setMembershipsModalOpen(true),
        closeMembershipsModal: () => setMembershipsModalOpen(false),
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut: handleSignOut,
        updateProfileName,
        saveLocationToAccount,
        clearSavedLocation,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
