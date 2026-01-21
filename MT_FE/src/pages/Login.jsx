// src/pages/Login.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HOST } from '../api'

const STORAGE_KEY = 'murajaah_auth' // one key, easier to manage

function Login() {
  const navigate = useNavigate()

  const [selectedUser, setSelectedUser] = useState('Aiman')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // If already logged in, skip login page
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      const auth = JSON.parse(raw)
      if (auth?.user_id) navigate('/surahList')
    } catch {
      // ignore bad storage
    }
  }, [navigate])

  const pinValid = useMemo(() => /^\d{4}$/.test(pin), [pin])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')

    if (!selectedUser) return setError('Please select a user.')
    if (!pinValid) return setError('PIN must be exactly 4 digits.')

    try {
      setIsSubmitting(true)

      const res = await fetch(`${HOST}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: selectedUser, pin }),
      })

      // handle non-200 nicely
      if (!res.ok) {
        let msg = 'Login failed'
        try {
          const data = await res.json()
          msg = data?.message || msg
        } catch {}
        setError(msg)
        return
      }

      const data = await res.json()
      // Expect backend returns: { user_id: 1, user: "Aiman" }
      if (!data?.id) {
        setError('Login response missing user_id.')
        return
      }

      // ✅ Store only what you need (NO PIN)
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          user_id: data.id,
          user: data.user || selectedUser,
          logged_in_at: new Date().toISOString(),
        })
      )

      navigate('/surahList')
    } catch (err) {
      console.error(err)
      setError('Network error. Is backend running?')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={{ ...styles.blob, ...styles.blob1 }} />
      <div style={{ ...styles.blob, ...styles.blob2 }} />

      <div style={styles.shell}>
        <div style={styles.brandRow}>
          <div style={styles.logo}>M</div>
          <div>
            <div style={styles.brandTitle}>Murajaah Tracker</div>
            <div style={styles.brandSub}>Sign in to continue</div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h1 style={styles.h1}>Login</h1>
            <p style={styles.muted}>
              Choose your profile and enter your 4-digit PIN.
            </p>
          </div>

          <form onSubmit={handleLogin}>
            <div style={styles.section}>
              <div style={styles.sectionTitle}>User</div>

              <UserOption
                label="Aiman"
                selected={selectedUser === 'Aiman'}
                onSelect={() => setSelectedUser('Aiman')}
              />
              <UserOption
                label="Fithriyaani"
                selected={selectedUser === 'Fithriyaani'}
                onSelect={() => setSelectedUser('Fithriyaani')}
              />
            </div>

            <div style={styles.section}>
              <label style={styles.sectionTitle} htmlFor="pin">
                4-digit PIN
              </label>

              <div style={styles.pinWrap}>
                <span style={styles.pinIcon} aria-hidden="true">
                  🔒
                </span>
                <input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => {
                    const next = e.target.value.replace(/\D/g, '').slice(0, 4)
                    setPin(next)
                    if (error) setError('')
                  }}
                  placeholder="Enter 4-digit PIN"
                  style={styles.pinInput}
                />
                <span
                  style={{
                    ...styles.pinBadge,
                    ...(pin.length === 0
                      ? styles.pinBadgeIdle
                      : pinValid
                      ? styles.pinBadgeOk
                      : styles.pinBadgeWarn),
                  }}
                >
                  {pin.length === 0 ? '----' : `${pin.length}/4`}
                </span>
              </div>

              {error && <div style={styles.errorBox}>{error}</div>}
            </div>

            <button
              type="submit"
              disabled={!pinValid || isSubmitting}
              style={{
                ...styles.btn,
                ...(!pinValid || isSubmitting ? styles.btnDisabled : {}),
              }}
            >
              {isSubmitting ? 'Logging in…' : 'Login'}
            </button>

            <div style={styles.footerHint}>Tip: PIN accepts digits only (0–9).</div>
          </form>
        </div>
      </div>
    </div>
  )
}

function UserOption({ label, selected, onSelect }) {
  return (
    <label
      onClick={onSelect}
      style={{
        ...styles.userOption,
        ...(selected ? styles.userOptionSelected : {}),
      }}
    >
      <span
        style={{
          ...styles.radioOuter,
          ...(selected ? styles.radioOuterSelected : {}),
        }}
        aria-hidden="true"
      >
        <span
          style={{
            ...styles.radioInner,
            ...(selected ? styles.radioInnerSelected : {}),
          }}
        />
      </span>

      <span style={styles.userText}>{label}</span>

      <input
        type="radio"
        name="user"
        value={label}
        checked={selected}
        onChange={onSelect}
        style={styles.hiddenInput}
      />
    </label>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: 18,
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
    background:
      'radial-gradient(1200px 600px at 20% 10%, #e8f3f0 0%, rgba(232,243,240,0) 60%), radial-gradient(900px 500px at 80% 20%, #f1efe6 0%, rgba(241,239,230,0) 60%), #f6faf9',
    position: 'relative',
    overflow: 'hidden',
  },

  blob: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: '999px',
    filter: 'blur(40px)',
    opacity: 0.55,
    pointerEvents: 'none',
  },
  blob1: {
    top: -120,
    left: -120,
    background: '#bde7dd',
  },
  blob2: {
    bottom: -160,
    right: -160,
    background: '#ffe9b5',
  },

  shell: {
    width: '100%',
    maxWidth: 520,
    position: 'relative',
    zIndex: 1,
  },

  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    padding: '0 4px',
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 14,
    display: 'grid',
    placeItems: 'center',
    background: 'linear-gradient(135deg, #84a59d 0%, #2a9d8f 100%)',
    color: '#fff',
    fontWeight: 900,
    fontSize: 18,
    boxShadow: '0 10px 20px rgba(42,157,143,0.18)',
  },
  brandTitle: {
    fontWeight: 900,
    color: '#0f172a',
    letterSpacing: 0.2,
  },
  brandSub: {
    marginTop: 2,
    fontSize: 13,
    color: '#64748b',
  },

  card: {
    background: 'rgba(255,255,255,0.86)',
    border: '1px solid rgba(148,163,184,0.35)',
    borderRadius: 18,
    padding: 22,
    boxShadow:
      '0 18px 45px rgba(15, 23, 42, 0.10), 0 2px 8px rgba(15, 23, 42, 0.06)',
    backdropFilter: 'blur(10px)',
  },

  cardHeader: {
    marginBottom: 14,
  },
  h1: {
    margin: 0,
    fontSize: 34,
    letterSpacing: -0.4,
    color: '#0f172a',
  },
  muted: {
    margin: '6px 0 0',
    color: '#64748b',
    fontSize: 14,
    lineHeight: 1.4,
  },

  section: {
    marginTop: 16,
  },
  sectionTitle: {
    display: 'block',
    fontWeight: 800,
    color: '#0f172a',
    marginBottom: 10,
    fontSize: 14,
  },

  userOption: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 12px',
    borderRadius: 14,
    border: '1px solid rgba(148,163,184,0.45)',
    background: '#ffffff',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'transform 120ms ease, box-shadow 120ms ease, border 120ms ease',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
    marginBottom: 10,
  },
  userOptionSelected: {
    border: '1px solid rgba(42,157,143,0.55)',
    boxShadow: '0 10px 24px rgba(42,157,143,0.12)',
    transform: 'translateY(-1px)',
  },

  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 999,
    border: '2px solid rgba(100,116,139,0.5)',
    display: 'grid',
    placeItems: 'center',
  },
  radioOuterSelected: {
    border: '2px solid #2a9d8f',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: 'transparent',
  },
  radioInnerSelected: {
    background: '#2a9d8f',
  },
  userText: {
    fontWeight: 800,
    color: '#0f172a',
    fontSize: 16,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    pointerEvents: 'none',
  },

  pinWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 12px',
    borderRadius: 14,
    border: '1px solid rgba(148,163,184,0.45)',
    background: '#ffffff',
  },
  pinIcon: {
    width: 30,
    textAlign: 'center',
    fontSize: 18,
    opacity: 0.9,
  },
  pinInput: {
    width: '100%',
    border: 'none',
    outline: 'none',
    fontSize: 16,
    letterSpacing: 3,
    padding: '4px 0',
  },
  pinBadge: {
    minWidth: 54,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 900,
    padding: '6px 10px',
    borderRadius: 999,
    border: '1px solid rgba(148,163,184,0.45)',
  },
  pinBadgeIdle: {
    color: '#64748b',
    background: '#f8fafc',
  },
  pinBadgeOk: {
    color: '#0f766e',
    background: 'rgba(42,157,143,0.10)',
    border: '1px solid rgba(42,157,143,0.35)',
  },
  pinBadgeWarn: {
    color: '#92400e',
    background: 'rgba(255,215,0,0.16)',
    border: '1px solid rgba(255,215,0,0.35)',
  },

  errorBox: {
    marginTop: 10,
    color: '#b00020',
    background: 'rgba(255, 236, 236, 0.9)',
    border: '1px solid rgba(255, 180, 180, 0.9)',
    padding: '10px 12px',
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 13,
  },

  btn: {
    marginTop: 18,
    width: '100%',
    padding: '12px 14px',
    borderRadius: 14,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 900,
    fontSize: 16,
    color: '#ffffff',
    background: 'linear-gradient(135deg, #84a59d 0%, #2a9d8f 100%)',
    boxShadow: '0 14px 30px rgba(42,157,143,0.18)',
    transition: 'transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease',
  },
  btnDisabled: {
    cursor: 'not-allowed',
    opacity: 0.55,
    boxShadow: 'none',
    transform: 'none',
  },

  footerHint: {
    textAlign: 'center',
    marginTop: 12,
    color: '#64748b',
    fontSize: 12,
  },
}

export default Login
