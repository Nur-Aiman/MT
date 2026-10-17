import React from 'react'
import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import SurahList from './pages/SurahList'
import Tadabbur from './pages/Tadabbur' 
import Login from './pages/Login'
import ThemeToggle from './components/ThemeToggle'
import './styles/liquid-glass.css'

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className='app-shell'>
        <a className='skip-link' href='#main-content'>Skip to content</a>
        <ThemeToggle />
        <main id='main-content'>
          <Routes>
            <Route path='/surahList' element={<SurahList />} />
            <Route path='/tadabbur' element={<Tadabbur />} />
            <Route path='/' element={<Login />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
