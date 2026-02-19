import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  googleToken: string | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const GOOGLE_TOKEN_KEY = 'shout_google_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [storedGoogleToken, setStoredGoogleToken] = useState<string | null>(
    () => localStorage.getItem(GOOGLE_TOKEN_KEY),
  )

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Persist Google token when available from OAuth
  useEffect(() => {
    if (session?.provider_token) {
      localStorage.setItem(GOOGLE_TOKEN_KEY, session.provider_token)
      setStoredGoogleToken(session.provider_token)
    }
  }, [session?.provider_token])

  // Use fresh provider_token if available, otherwise fall back to stored
  const googleToken = session?.provider_token ?? storedGoogleToken

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar',
        redirectTo: window.location.origin,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
  }

  async function signOut() {
    localStorage.removeItem(GOOGLE_TOKEN_KEY)
    setStoredGoogleToken(null)
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, googleToken, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
