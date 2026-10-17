import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HOST } from '../api'

const STORAGE_KEY = 'murajaah_auth'

function Login() {
  const navigate = useNavigate()
  const [selectedUser, setSelectedUser] = useState('Aiman')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      const auth = JSON.parse(raw)
      if (auth?.user_id) navigate('/surahList')
    } catch {
      // Ignore invalid local storage from an earlier session.
    }
  }, [navigate])

  const pinValid = useMemo(() => /^\d{4}$/.test(pin), [pin])

  const handleLogin = async (event) => {
    event.preventDefault()
    setError('')

    if (!selectedUser) return setError('Please select a user.')
    if (!pinValid) return setError('PIN must be exactly 4 digits.')

    try {
      setIsSubmitting(true)
      const response = await fetch(`${HOST}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: selectedUser, pin }),
      })

      if (!response.ok) {
        let message = 'Login failed'
        try {
          const data = await response.json()
          message = data?.message || message
        } catch {
          // Keep the fallback message when the response is not JSON.
        }
        setError(message)
        return
      }

      const data = await response.json()
      if (!data?.id) {
        setError('Login response missing user_id.')
        return
      }

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          user_id: data.id,
          user: data.user || selectedUser,
          logged_in_at: new Date().toISOString(),
        })
      )
      navigate('/surahList')
    } catch (loginError) {
      console.error(loginError)
      setError('Network error. Is backend running?')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={'login-page'}>
      <div className={'ambient-orb ambient-orb--one'} aria-hidden={'true'} />
      <div className={'ambient-orb ambient-orb--two'} aria-hidden={'true'} />

      <main className={'login-shell'}>
        <header className={'login-brand'}>
          <div className={'login-brand__mark'} aria-hidden={'true'}>M</div>
          <div>
            <span className={'page-eyebrow'}>Personal Quran companion</span>
            <div className={'login-brand__name'}>Murajaah Tracker</div>
          </div>
        </header>

        <section className={'login-card'} aria-labelledby={'login-title'}>
          <div className={'login-card__header'}>
            <span className={'login-card__kicker'}>Welcome back</span>
            <h1 id={'login-title'}>Continue your practice</h1>
            <p>Choose your profile and enter your four-digit PIN.</p>
          </div>

          <form className={'login-form'} onSubmit={handleLogin}>
            <fieldset className={'login-fieldset'}>
              <legend>Choose a profile</legend>
              <div className={'profile-options'}>
                <UserOption
                  label={'Aiman'}
                  selected={selectedUser === 'Aiman'}
                  onSelect={() => setSelectedUser('Aiman')}
                />
                <UserOption
                  label={'Fithriyaani'}
                  selected={selectedUser === 'Fithriyaani'}
                  onSelect={() => setSelectedUser('Fithriyaani')}
                />
              </div>
            </fieldset>

            <div className={'login-field'}>
              <label htmlFor={'pin'}>4-digit PIN</label>
              <div className={`pin-control ${error ? 'pin-control--error' : ''}`}>
                <svg className={'pin-control__icon'} viewBox={'0 0 24 24'} aria-hidden={'true'}>
                  <rect x={'5'} y={'10'} width={'14'} height={'10'} rx={'3'} />
                  <path d={'M8 10V7a4 4 0 0 1 8 0v3'} />
                </svg>
                <input
                  id={'pin'}
                  type={'password'}
                  inputMode={'numeric'}
                  pattern={'[0-9]*'}
                  maxLength={4}
                  value={pin}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'login-error' : 'pin-help'}
                  onChange={(event) => {
                    setPin(event.target.value.replace(/\D/g, '').slice(0, 4))
                    if (error) setError('')
                  }}
                  placeholder={'Enter PIN'}
                  autoComplete={'current-password'}
                />
                <span className={`pin-progress ${pinValid ? 'pin-progress--valid' : ''}`}>
                  {pin.length}/4
                </span>
              </div>
              <span id={'pin-help'} className={'field-hint'}>Digits only. Your PIN is never stored in this browser.</span>
              {error && <div id={'login-error'} className={'form-message form-message--error'} role={'alert'}>{error}</div>}
            </div>

            <button className={'login-submit'} type={'submit'} disabled={!pinValid || isSubmitting}>
              {isSubmitting && <span className={'button-spinner'} aria-hidden={'true'} />}
              {isSubmitting ? 'Signing in...' : 'Sign in securely'}
            </button>
          </form>
        </section>

        <p className={'login-footnote'}>A calm space for consistent memorisation and review.</p>
      </main>
    </div>
  )
}

function UserOption({ label, selected, onSelect }) {
  return (
    <label className={`profile-option ${selected ? 'profile-option--selected' : ''}`}>
      <input
        type={'radio'}
        name={'user'}
        value={label}
        checked={selected}
        onChange={onSelect}
      />
      <span className={'profile-option__avatar'} aria-hidden={'true'}>{label.charAt(0)}</span>
      <span className={'profile-option__copy'}>
        <strong>{label}</strong>
        <span>{selected ? 'Selected profile' : 'Tap to select'}</span>
      </span>
      <span className={'profile-option__check'} aria-hidden={'true'}>
        <svg viewBox={'0 0 24 24'}><path d={'m6.5 12.5 3.5 3.5 7.5-8'} /></svg>
      </span>
    </label>
  )
}

export default Login
