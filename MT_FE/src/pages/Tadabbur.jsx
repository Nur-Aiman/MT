import React from 'react'
import { Link } from 'react-router-dom'

function Tadabbur() {
  return (
    <div className={'tadabbur-page'}>
      <section className={'tadabbur-card'} aria-labelledby={'tadabbur-title'}>
        <span className={'page-eyebrow'}>Reflection space</span>
        <div className={'tadabbur-icon'} aria-hidden={'true'}>+</div>
        <h1 id={'tadabbur-title'}>Tadabbur</h1>
        <p>Reflect and write your thoughts here. This workspace is ready for your future notes and Quran reflections.</p>
        <div className={'tadabbur-empty'} role={'status'}>
          <strong>No reflections yet</strong>
          <span>Your saved reflections will appear here when this feature is enabled.</span>
        </div>
        <Link className={'glass-button glass-button--primary'} to={'/surahList'}>
          Return to tracker
        </Link>
      </section>
    </div>
  )
}

export default Tadabbur
