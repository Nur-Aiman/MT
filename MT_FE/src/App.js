import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import SurahList from './pages/SurahList'
import Tadabbur from './pages/Tadabbur' // Create this file/component

function App() {
  return (
    <Router>
      <div className='App'>
        <header className='App-header'></header>
        <main>
          <Routes>
            <Route path='/' element={<SurahList />} />
            <Route path='/tadabbur' element={<Tadabbur />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
