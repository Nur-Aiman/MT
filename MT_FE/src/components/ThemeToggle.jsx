import React, { useLayoutEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

const THEME_KEY = 'murajaah_theme'

function ThemeToggle() {
  const location = useLocation()
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark')

  useLayoutEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY)

    const applyTheme = (nextTheme) => {
      document.documentElement.dataset.theme = nextTheme
      document.documentElement.style.colorScheme = nextTheme
      setTheme(nextTheme)
    }

    applyTheme(savedTheme || 'dark')
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem(THEME_KEY, nextTheme)
    document.documentElement.dataset.theme = nextTheme
    document.documentElement.style.colorScheme = nextTheme
    setTheme(nextTheme)
  }

  const nextThemeLabel = theme === 'dark' ? 'light' : 'dark'
  const isTrackerHeader = location.pathname === '/surahList'

  return (
    <button
      type={'button'}
      className={`theme-toggle${isTrackerHeader ? ' theme-toggle--tracker' : ''}`}
      onClick={toggleTheme}
      aria-label={`Switch to ${nextThemeLabel} theme`}
      title={`Switch to ${nextThemeLabel} theme`}
    >
      <span className={'theme-toggle__track'} aria-hidden={'true'}>
        <span className={'theme-toggle__thumb'}>
          {theme === 'dark' ? (
            <svg viewBox={'0 0 24 24'}>
              <path d={'M20.2 15.2A8.3 8.3 0 0 1 8.8 3.8 8.4 8.4 0 1 0 20.2 15.2Z'} />
            </svg>
          ) : (
            <svg viewBox={'0 0 24 24'}>
              <circle cx={'12'} cy={'12'} r={'4'} />
              <path d={'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'} />
            </svg>
          )}
        </span>
      </span>
      <span className={'theme-toggle__label'}>{theme === 'dark' ? 'Dark' : 'Light'}</span>
    </button>
  )
}

export default ThemeToggle
