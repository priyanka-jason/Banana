import { useState } from 'react'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { MapPinIcon } from '@phosphor-icons/react/dist/csr/MapPin'
import { CheckCircleIcon } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { NavigationArrowIcon } from '@phosphor-icons/react/dist/csr/NavigationArrow'
import { TrashIcon } from '@phosphor-icons/react/dist/csr/Trash'
import { BookmarkSimpleIcon } from '@phosphor-icons/react/dist/csr/BookmarkSimple'
import { useAuth } from '../data/authState'
import './AccountModals.css'

export function ProfileModal() {
  const {
    user,
    account,
    profileModalOpen,
    closeProfileModal,
    updateProfileName,
    clearSavedLocation,
    openSavedListsModal,
  } = useAuth()

  const sourceName = account?.name || user?.email?.split('@')[0] || ''
  const [draft, setDraft] = useState<{ source: string; value: string } | null>(
    null,
  )
  const name = draft?.source === sourceName ? draft.value : sourceName
  const setName = (value: string) => setDraft({ source: sourceName, value })
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  if (!profileModalOpen || !user) return null

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    setFeedback('')
    const success = await updateProfileName(name.trim())
    setSaving(false)

    if (success) {
      setFeedback('Profile updated successfully!')
      setTimeout(() => setFeedback(''), 3000)
    } else {
      setFeedback('Failed to update profile. Please try again.')
    }
  }

  async function handleClearLocation() {
    setSaving(true)
    const success = await clearSavedLocation()
    setSaving(false)
    if (success) {
      setFeedback('Saved location cleared.')
      setTimeout(() => setFeedback(''), 3000)
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={closeProfileModal}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div
        className="account-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close-btn"
          onClick={closeProfileModal}
          aria-label="Close profile"
        >
          <XIcon size={20} />
        </button>

        <div className="account-modal-header">
          <h2 id="profile-modal-title">Your Profile</h2>
          <p className="account-modal-subtitle">
            Manage your account details and location preferences.
          </p>
        </div>

        {feedback && (
          <div className="account-alert success">
            <CheckCircleIcon size={18} />
            <span>{feedback}</span>
          </div>
        )}

        <form onSubmit={handleSaveName} className="account-form">
          <div className="form-group">
            <label htmlFor="profile-name">Full Name</label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="profile-email">Email Address</label>
            <input
              id="profile-email"
              type="email"
              value={user.email || ''}
              disabled
              className="disabled-input"
            />
            <span className="form-field-hint">
              Authenticated via{' '}
              {user.app_metadata?.provider === 'google'
                ? 'Google SSO'
                : 'Email'}
            </span>
          </div>

          <div className="account-section">
            <div className="section-title-row">
              <MapPinIcon size={20} className="section-icon" />
              <h3>Saved Location Data</h3>
            </div>

            {account?.use_location && account.latitude && account.longitude ? (
              <div className="location-info-card">
                <div className="location-card-content">
                  <span className="location-card-badge">
                    Location Sharing Active
                  </span>
                  <p className="location-card-label">
                    {account.location_label || 'Your current location'}
                  </p>
                  <p className="location-card-coords">
                    {account.latitude.toFixed(4)}° N,{' '}
                    {account.longitude.toFixed(4)}° W
                  </p>
                </div>
                <button
                  type="button"
                  className="clear-location-btn"
                  onClick={handleClearLocation}
                  disabled={saving}
                  title="Remove saved location from profile"
                >
                  <TrashIcon size={18} />
                  <span>Remove</span>
                </button>
              </div>
            ) : (
              <div className="location-empty-card">
                <NavigationArrowIcon size={22} />
                <div>
                  <p className="location-empty-title">No location saved yet</p>
                  <p className="location-empty-desc">
                    Go to the <strong>Locations</strong> tab and click "Use my
                    location" to allow sharing and save your position to your
                    account.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="account-section">
            <button
              type="button"
              className="account-link-btn"
              onClick={() => {
                closeProfileModal()
                openSavedListsModal()
              }}
            >
              <BookmarkSimpleIcon size={20} aria-hidden="true" />
              Saved lists
            </button>
          </div>

          <div className="account-actions">
            <button
              type="submit"
              className="account-save-btn"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
