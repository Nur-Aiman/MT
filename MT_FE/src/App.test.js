import { render, screen } from '@testing-library/react'
import App from './App'

beforeEach(() => {
  localStorage.clear()
  window.location.hash = '#/'
  window.matchMedia = window.matchMedia || (() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

test('renders the login route and theme control', () => {
  render(<App />)

  expect(screen.getByRole('heading', { name: /continue your practice/i })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: /aiman/i })).toBeChecked()
  expect(screen.getByRole('button', { name: /switch to dark theme/i })).toBeInTheDocument()
})
