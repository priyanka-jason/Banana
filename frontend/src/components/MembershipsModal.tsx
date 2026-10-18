import { useState } from 'react'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { CheckCircleIcon } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/csr/ShieldCheck'
import { CardholderIcon } from '@phosphor-icons/react/dist/csr/Cardholder'
import { useAuth } from '../data/AuthContext'
import './AccountModals.css'

interface MembershipProgram {
  id: string
  name: string
  store: string
  color: string
  description: string
}

const MEMBERSHIPS: MembershipProgram[] = [
  {
    id: 'pc-optimum',
    name: 'PC Optimum™',
    store: 'No Frills & Real Canadian Superstore',
    color: '#d32f2f',
    description: 'Earn points and unlock member-only flyer discounts across Loblaws banner stores.',
  },
  {
    id: 'more-rewards',
    name: 'More Rewards®',
    store: 'Save-On-Foods',
    color: '#006837',
    description: 'Special member price deals and points on every item at Save-On-Foods.',
  },
  {
    id: 'walmart-rewards',
    name: 'Walmart Rewards',
    store: 'Walmart Canada',
    color: '#0071ce',
    description: 'Earn digital rewards on Rollback offers and everyday low prices.',
  },
]

export function MembershipsModal() {
  const { user, membershipsModalOpen, closeMembershipsModal } = useAuth()

  const [activePrograms, setActivePrograms] = useState<Record<string, boolean>>({
    'pc-optimum': true,
    'more-rewards': true,
    'walmart-rewards': false,
  })

  const [feedback, setFeedback] = useState('')

  if (!membershipsModalOpen || !user) return null

  function toggleProgram(id: string) {
    setActivePrograms((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      return next
    })
    setFeedback('Membership preferences updated!')
    setTimeout(() => setFeedback(''), 2500)
  }

  return (
    <div
      className="modal-backdrop"
      onClick={closeMembershipsModal}
      role="dialog"
      aria-modal="true"
      aria-labelledby="memberships-modal-title"
    >
      <div
        className="account-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close-btn"
          onClick={closeMembershipsModal}
          aria-label="Close memberships"
        >
          <XIcon size={20} />
        </button>

        <div className="account-modal-header">
          <div className="memberships-header-title">
            <CardholderIcon size={28} className="header-icon" />
            <h2 id="memberships-modal-title">My Memberships</h2>
          </div>
          <p className="account-modal-subtitle">
            Link your store loyalty programs to unlock member prices and tailored local offer alerts.
          </p>
        </div>

        {feedback && (
          <div className="account-alert success">
            <CheckCircleIcon size={18} />
            <span>{feedback}</span>
          </div>
        )}

        <div className="banana-perk-banner">
          <ShieldCheckIcon size={26} className="perk-icon" />
          <div>
            <span className="perk-badge">Banana Pro Account Active</span>
            <p className="perk-title">Free Member Benefits Included</p>
            <p className="perk-desc">
              Your account grants access to real-time price comparisons and saved location search across all major Vancouver grocery stores.
            </p>
          </div>
        </div>

        <div className="memberships-list">
          <h3>Store Loyalty Programs</h3>
          {MEMBERSHIPS.map((prog) => {
            const isLinked = Boolean(activePrograms[prog.id])
            return (
              <div key={prog.id} className="membership-card">
                <div
                  className="membership-color-strip"
                  style={{ background: prog.color }}
                />
                <div className="membership-body">
                  <div className="membership-title-row">
                    <h4>{prog.name}</h4>
                    <span
                      className={`membership-status-pill ${
                        isLinked ? 'active' : 'inactive'
                      }`}
                    >
                      {isLinked ? 'Active' : 'Not Linked'}
                    </span>
                  </div>
                  <p className="membership-store">{prog.store}</p>
                  <p className="membership-desc">{prog.description}</p>
                </div>
                <button
                  type="button"
                  className={`membership-toggle-btn ${
                    isLinked ? 'is-linked' : ''
                  }`}
                  onClick={() => toggleProgram(prog.id)}
                >
                  {isLinked ? 'Linked' : '+ Link Program'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
