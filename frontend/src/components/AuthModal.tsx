import { useState } from 'react'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { WarningIcon } from '@phosphor-icons/react/dist/csr/Warning'
import { CheckCircleIcon } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { useAuth } from '../data/AuthContext'
import './AuthModal.css'

export function AuthModal() {
  const {
    authModalOpen,
    closeAuthModal,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
  } = useAuth()

  const [tab, setTab] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')

  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  if (!authModalOpen) return null

  async function handleGoogleSignIn() {
    setErrorMsg('')
    setSuccessMsg('')
    setGoogleLoading(true)
    const { error } = await signInWithGoogle()
    setGoogleLoading(false)
    if (error) {
      setErrorMsg(error)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please fill in all required fields.')
      return
    }

    if (tab === 'signup' && !name.trim()) {
      setErrorMsg('Please enter your full name.')
      return
    }

    setLoading(true)
    if (tab === 'signin') {
      const { error } = await signInWithEmail(email.trim(), password)
      setLoading(false)
      if (error) {
        setErrorMsg(error)
      } else {
        closeAuthModal()
      }
    } else {
      const { error } = await signUpWithEmail(email.trim(), password, name.trim())
      setLoading(false)
      if (error) {
        setErrorMsg(error)
      } else {
        setSuccessMsg('Account created successfully!')
        setTimeout(() => closeAuthModal(), 1200)
      }
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={closeAuthModal}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        className="auth-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close-btn"
          onClick={closeAuthModal}
          aria-label="Close dialog"
        >
          <XIcon size={20} />
        </button>

        <div className="auth-header">
          <h2 id="auth-modal-title">Welcome to Banana</h2>
          <p className="auth-subtitle">
            Sign in to manage your location preferences and custom memberships.
          </p>
        </div>

        {errorMsg && (
          <div className="auth-alert error">
            <WarningIcon size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="auth-alert success">
            <CheckCircleIcon size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="sso-section">
          <button
            type="button"
            className="google-sso-btn"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
          >
            <svg
              className="google-logo"
              width="20"
              height="20"
              viewBox="0 0 24 24"
            >
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>
              {googleLoading ? 'Connecting to Google…' : 'Continue with Google'}
            </span>
          </button>
        </div>

        <div className="auth-divider">
          <span>or continue with email</span>
        </div>

        <div className="auth-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'signin'}
            className={`auth-tab ${tab === 'signin' ? 'is-active' : ''}`}
            onClick={() => {
              setTab('signin')
              setErrorMsg('')
            }}
          >
            Sign In
          </button>
          <button
            role="tab"
            aria-selected={tab === 'signup'}
            className={`auth-tab ${tab === 'signup' ? 'is-active' : ''}`}
            onClick={() => {
              setTab('signup')
              setErrorMsg('')
            }}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {tab === 'signup' && (
            <div className="form-group">
              <label htmlFor="auth-name">Full Name</label>
              <input
                id="auth-name"
                type="text"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={tab === 'signup'}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="auth-email">Email Address</label>
            <input
              id="auth-email"
              type="email"
              placeholder="jane@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading || googleLoading}
          >
            {loading
              ? 'Processing…'
              : tab === 'signin'
                ? 'Sign In'
                : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
