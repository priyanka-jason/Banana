import { useState, useRef, useEffect } from 'react'
import { HouseIcon } from '@phosphor-icons/react/dist/csr/House'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { MapPinIcon } from '@phosphor-icons/react/dist/csr/MapPin'
import { CrownSimpleIcon } from '@phosphor-icons/react/dist/csr/CrownSimple'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { UserCircleIcon } from '@phosphor-icons/react/dist/csr/UserCircle'
import { IdentificationCardIcon } from '@phosphor-icons/react/dist/csr/IdentificationCard'
import { CardholderIcon } from '@phosphor-icons/react/dist/csr/Cardholder'
import { BookmarkSimpleIcon } from '@phosphor-icons/react/dist/csr/BookmarkSimple'
import { SignOutIcon } from '@phosphor-icons/react/dist/csr/SignOut'
import { pageHref } from '../lib/navigation'
import type { Page } from '../types'
import { useAuth } from '../data/authState'
import './Header.css'

interface Props {
  page: Page
  params: URLSearchParams
}

export function Header({ page, params }: Props) {
  const {
    user,
    account,
    openAuthModal,
    openProfileModal,
    openMembershipsModal,
    openSavedListsModal,
    signOut,
  } = useAuth()

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const displayName =
    account?.name || user?.email?.split('@')[0] || 'My Account'

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <a
          href={pageHref('home', params)}
          className="wordmark"
          aria-label="Banana home"
        >
          Banana
        </a>
        <nav className="desktop-nav" aria-label="Main navigation">
          <a
            href={pageHref('home', params)}
            aria-current={page === 'home' ? 'page' : undefined}
          >
            Home
          </a>
          <a
            href={pageHref('items', params)}
            aria-current={page === 'items' ? 'page' : undefined}
          >
            Search
          </a>
          <a
            href={pageHref('locations', params)}
            aria-current={page === 'locations' ? 'page' : undefined}
          >
            Locations
          </a>
          <a
            href={pageHref('membership', params)}
            aria-current={page === 'membership' ? 'page' : undefined}
          >
            Membership
          </a>
        </nav>

        <div className="header-auth-control" ref={menuRef}>
          {!user ? (
            <button
              className="auth-sign-in-button"
              onClick={openAuthModal}
              aria-label="Sign in or register"
            >
              <UserCircleIcon size={22} aria-hidden="true" />
              <span>Sign in</span>
            </button>
          ) : (
            <div className="account-dropdown-wrapper">
              <button
                className={`my-account-button ${dropdownOpen ? 'is-active' : ''}`}
                onClick={() => setDropdownOpen((prev) => !prev)}
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
                aria-label="User account menu"
              >
                <UserCircleIcon size={22} aria-hidden="true" />
                <span className="my-account-label">My Account</span>
                <CaretDownIcon
                  size={15}
                  style={{
                    transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s ease',
                  }}
                  aria-hidden="true"
                />
              </button>

              {dropdownOpen && (
                <div className="account-dropdown-menu" role="menu">
                  <div className="account-dropdown-header">
                    <p className="account-user-name">{displayName}</p>
                    <p className="account-user-email">{user.email}</p>
                  </div>
                  <div className="account-dropdown-divider" />
                  <button
                    className="account-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setDropdownOpen(false)
                      openProfileModal()
                    }}
                  >
                    <IdentificationCardIcon size={20} aria-hidden="true" />
                    <span>Profile</span>
                  </button>
                  <button
                    className="account-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setDropdownOpen(false)
                      openSavedListsModal()
                    }}
                  >
                    <BookmarkSimpleIcon size={20} aria-hidden="true" />
                    <span>Saved lists</span>
                  </button>
                  <button
                    className="account-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setDropdownOpen(false)
                      openMembershipsModal()
                    }}
                  >
                    <CardholderIcon size={20} aria-hidden="true" />
                    <span>Memberships</span>
                  </button>
                  <div className="account-dropdown-divider" />
                  <button
                    className="account-menu-item sign-out"
                    role="menuitem"
                    onClick={() => {
                      setDropdownOpen(false)
                      void signOut()
                    }}
                  >
                    <SignOutIcon size={20} aria-hidden="true" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export function MobileNav({
  page,
  params,
}: {
  page: Page
  params: URLSearchParams
}) {
  const { user, openAuthModal, openProfileModal } = useAuth()

  return (
    <nav className="mobile-nav" aria-label="Main navigation">
      <a
        href={pageHref('home', params)}
        aria-current={page === 'home' ? 'page' : undefined}
      >
        <HouseIcon
          size={25}
          weight={page === 'home' ? 'fill' : 'regular'}
          aria-hidden="true"
        />
        <span>Home</span>
      </a>
      <a
        href={pageHref('items', params)}
        aria-current={page === 'items' ? 'page' : undefined}
      >
        <MagnifyingGlassIcon size={25} aria-hidden="true" />
        <span>Search</span>
      </a>
      <a
        href={pageHref('locations', params)}
        aria-current={page === 'locations' ? 'page' : undefined}
      >
        <MapPinIcon
          size={25}
          weight={page === 'locations' ? 'fill' : 'regular'}
          aria-hidden="true"
        />
        <span>Locations</span>
      </a>
      <a
        href={pageHref('membership', params)}
        aria-current={page === 'membership' ? 'page' : undefined}
      >
        <CrownSimpleIcon
          size={25}
          weight={page === 'membership' ? 'fill' : 'regular'}
          aria-hidden="true"
        />
        <span>Membership</span>
      </a>
      <button
        type="button"
        className="mobile-account-btn"
        onClick={user ? openProfileModal : openAuthModal}
      >
        <UserCircleIcon size={25} aria-hidden="true" />
        <span>{user ? 'Account' : 'Sign in'}</span>
      </button>
    </nav>
  )
}
