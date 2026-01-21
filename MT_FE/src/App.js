import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import SurahList from './pages/SurahList'
import Tadabbur from './pages/Tadabbur' 
import Login from './pages/Login'

function App() {
  return (
    <Router>
      <div className='App'>
        <header className='App-header'></header>
        <main>
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
