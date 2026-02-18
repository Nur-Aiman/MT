import React, { useState, useEffect } from 'react'
import { HOST } from '../api'
import moment from 'moment-timezone'
import './TilawahModal.css'

function TilawahModal({ isOpen, onClose, userId }) {
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)
  const [progress, setProgress] = useState(null)
  const [logs, setLogs] = useState([])
  const [goalType, setGoalType] = useState('once_month')
  const [message, setMessage] = useState('')
  const [pagesCompletedToday, setPagesCompletedToday] = useState(0)
  const [calculatedMetrics, setCalculatedMetrics] = useState(null)

  const withUserHeaders = (headers = {}) => ({
    ...headers,
    'x-user-id': String(userId),
  })

  useEffect(() => {
    if (isOpen && userId) {
      fetchStatus()
      fetchProgress()
      fetchLogs()
    }
  }, [isOpen, userId])

  const fetchStatus = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${HOST}/tilawah/status`, {
        headers: withUserHeaders(),
      })
      const data = await res.json()
      setStatus(data)
      setCurrentPage(data.last_page_recited)
      setGoalType(data.goal_type || 'once_month')
    } catch (error) {
      console.error('Error fetching status:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProgress = async () => {
    try {
      const res = await fetch(`${HOST}/tilawah/progress`, {
        headers: withUserHeaders(),
      })
      const data = await res.json()
      setProgress(data)
      
      // Calculate metrics based on actual current page
      if (data && data.last_page_recited !== undefined) {
        const remainingPages = 604 - data.last_page_recited
        const dailyTarget = data.daily_target || 20
        
        let daysNeeded = 0
        if (dailyTarget > 0 && remainingPages > 0) {
          daysNeeded = Math.ceil(remainingPages / dailyTarget)
        }
        
        const estCompletionDate = moment.tz('Asia/Kuala_Lumpur').add(daysNeeded, 'days')
        
        setCalculatedMetrics({
          remainingPages,
          estimatedCompletionDate: estCompletionDate.format('YYYY-MM-DD'),
          estimatedCompletionDay: estCompletionDate.format('dddd'),
          daysNeeded
        })
      }
    } catch (error) {
      console.error('Error fetching progress:', error)
    }
  }

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${HOST}/tilawah/logs?limit=10`, {
        headers: withUserHeaders(),
      })
      const data = await res.json()
      setLogs(Array.isArray(data) ? data : [])
      
      // Calculate pages completed today
      const today = moment.tz('Asia/Kuala_Lumpur').format('YYYY-MM-DD')
      const todaysLogs = Array.isArray(data) ? data.filter(log => 
        moment(log.update_time).tz('Asia/Kuala_Lumpur').format('YYYY-MM-DD') === today
      ) : []
      
      if (todaysLogs.length > 0) {
        const minPage = Math.min(...todaysLogs.map(log => log.page_number))
        const maxPage = Math.max(...todaysLogs.map(log => log.page_number))
        const completed = Math.max(0, maxPage - minPage)
        console.log('minpage', minPage, 'maxpage', maxPage, 'completed today', completed)
        setPagesCompletedToday(completed)
      } else {
        setPagesCompletedToday(0)
      }
    } catch (error) {
      console.error('Error fetching logs:', error)
    }
  }

  const handleSavePage = async () => {
    if (currentPage < 1 || currentPage > 604) {
      setMessage('Page must be between 1 and 604')
      return
    }

    try {
      setLoading(true)
      const res = await fetch(`${HOST}/tilawah/update`, {
        method: 'POST',
        headers: withUserHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ page_number: currentPage }),
      })

      if (!res.ok) throw new Error('Failed to save page')

      setMessage('✓ Page updated successfully!')
      setTimeout(() => setMessage(''), 2000)
      
      // Refresh data
      fetchStatus()
      fetchProgress()
      fetchLogs()
    } catch (error) {
      console.error('Error saving page:', error)
      setMessage('✗ Failed to save page')
      setTimeout(() => setMessage(''), 2000)
    } finally {
      setLoading(false)
    }
  }

  const handleGoalChange = async (newGoalType) => {
    try {
      setLoading(true)
      const res = await fetch(`${HOST}/tilawah/set-khatam-goal`, {
        method: 'POST',
        headers: withUserHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ goal_type: newGoalType }),
      })

      if (!res.ok) throw new Error('Failed to set goal')

      setGoalType(newGoalType)
      setMessage('✓ Goal updated successfully!')
      setTimeout(() => setMessage(''), 2000)
      
      // Refresh data
      fetchStatus()
      fetchProgress()
    } catch (error) {
      console.error('Error setting goal:', error)
      setMessage('✗ Failed to update goal')
      setTimeout(() => setMessage(''), 2000)
    } finally {
      setLoading(false)
    }
  }

  const handleResetPage = () => {
    const confirmed = window.confirm('Are you sure you want to reset to page 1? This cannot be undone.')
    if (confirmed) {
      setCurrentPage(1)
      setMessage('✓ Reset to page 1')
      setTimeout(() => setMessage(''), 2000)
    }
  }

  if (!isOpen) return null

  return (
    <div className="tilawah-modal-overlay" onClick={onClose}>
      <div className="tilawah-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="tilawah-modal-header">
          <h2 className="tilawah-modal-title">Tilawah Tracker</h2>
          <button className="tilawah-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="tilawah-modal-body">
          {/* Current Status */}
          {status && (
            <div className="tilawah-section">
              <h3 className="tilawah-section-title">Current Status</h3>
              <div className="tilawah-status-card">
                <div className="status-row">
                  <span className="status-label">Current Page:</span>
                  <span className="status-value">{status.last_page_recited} / 604</span>
                </div>
                <div className="status-row">
                  <span className="status-label">Last Page Completed:</span>
                  <span className="status-value">
                    Page {Math.max(1, status.last_page_recited - 1)} - {moment(status.last_update_time).tz('Asia/Kuala_Lumpur').format('DD/MM/YYYY, HH:mm')}
                  </span>
                </div>
                <div className="status-row">
                  <span className="status-label">Progress:</span>
                  <div className="progress-bar-container">
                    <div 
                      className="progress-bar-fill" 
                      style={{ width: `${(status.last_page_recited / 604) * 100}%` }}
                    ></div>
                  </div>
                  <span className="progress-percentage">
                    {Math.round((status.last_page_recited / 604) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Update Page Section */}
          <div className="tilawah-section">
            <h3 className="tilawah-section-title">Update Page</h3>
            <div className="tilawah-input-group">
              <label className="tilawah-label">Current Page Number:</label>
              <div className="page-controls-container">
                <button 
                  className="page-btn page-btn-minus"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={loading || currentPage <= 1}
                >
                  −
                </button>
                <div className="page-display">
                  <span className="page-value">{currentPage}</span>
                  <span className="page-max">/ 604</span>
                </div>
                <button 
                  className="page-btn page-btn-plus"
                  onClick={() => setCurrentPage(Math.min(604, currentPage + 1))}
                  disabled={loading || currentPage >= 604}
                >
                  +
                </button>
              </div>
              <div className="button-row">
                <button 
                  className="tilawah-btn tilawah-btn-primary"
                  onClick={handleSavePage}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Page'}
                </button>
                <button 
                  className="tilawah-btn tilawah-btn-danger"
                  onClick={handleResetPage}
                  disabled={loading}
                >
                  Reset
                </button>
              </div>
            </div>
            {message && <div className="tilawah-message">{message}</div>}
          </div>

          {/* Daily Target & Completion Info */}
          {progress && calculatedMetrics && (
            <div className="tilawah-section">
              <h3 className="tilawah-section-title">Progress Information</h3>
              <div className="tilawah-info-grid">
                <div className="info-card">
                  <div className="info-label">Daily Target</div>
                  <div className="info-value">{progress.daily_target} pages</div>
                </div>
                <div className="info-card">
                  <div className="info-label">Pages Completed Today</div>
                  <div className="info-value">{pagesCompletedToday} pages</div>
                </div>
                <div className="info-card">
                  <div className="info-label">Remaining</div>
                  <div className="info-value">{calculatedMetrics.remainingPages} pages</div>
                </div>
                <div className="info-card">
                  <div className="info-label">Est. Completion</div>
                  <div className="info-value">
                    {calculatedMetrics.estimatedCompletionDate}
                    <br />
                    <span className="info-day">({calculatedMetrics.estimatedCompletionDay})</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Khatam Goal Section */}
          <div className="tilawah-section">
            <h3 className="tilawah-section-title">Khatam Goal</h3>
            <div className="tilawah-goal-options">
              <button
                className={`goal-btn ${goalType === 'once_month' ? 'goal-btn-active' : ''}`}
                onClick={() => handleGoalChange('once_month')}
                disabled={loading}
              >
                <span className="goal-title">Once a Month</span>
                <span className="goal-desc">30 days</span>
              </button>
              <button
                className={`goal-btn ${goalType === 'once_two_months' ? 'goal-btn-active' : ''}`}
                onClick={() => handleGoalChange('once_two_months')}
                disabled={loading}
              >
                <span className="goal-title">Every 2 Months</span>
                <span className="goal-desc">60 days</span>
              </button>
              <button
                className={`goal-btn ${goalType === 'free' ? 'goal-btn-active' : ''}`}
                onClick={() => handleGoalChange('free')}
                disabled={loading}
              >
                <span className="goal-title">Free Pace</span>
                <span className="goal-desc">Dynamic target</span>
              </button>
            </div>
          </div>

          {/* Recent Updates Log */}
          {logs.length > 0 && (
            <div className="tilawah-section">
              <h3 className="tilawah-section-title">Recent Updates</h3>
              <div className="tilawah-log-list">
                {logs.map((log, index) => (
                  <div key={log.id} className="log-entry">
                    <div className="log-date">
                      {moment(log.update_time).tz('Asia/Kuala_Lumpur').format('DD/MM/YYYY')}
                    </div>
                    <div className="log-content">
                      <span className="log-page">Page {log.page_number}</span>
                      <span className="log-time">
                        {moment(log.update_time).tz('Asia/Kuala_Lumpur').format('HH:mm')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="tilawah-modal-footer">
          <button className="tilawah-btn tilawah-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default TilawahModal
