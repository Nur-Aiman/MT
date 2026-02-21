import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import AddSurahModal from '../components/AddSurahModal'
import SabaqModal from '../components/SabaqModal'
import LoginModal from '../components/LoginModal'
import TahajjudModal from '../components/TahajjudModal'
import TilawahModal from '../components/TilawahModal'
import SalahRecitationModal from '../components/SalahRecitationModal'
import { HOST } from '../api'
import moment from 'moment-timezone'
import './SurahList.css'

const STORAGE_KEY = 'murajaah_auth'

function SurahList() {
  const [surahs, setSurahs] = useState([])
  const [checkedSurahs, setCheckedSurahs] = useState({})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSabaqModalOpen, setIsSabaqModalOpen] = useState(false)
  const [isTahajjudModalOpen, setIsTahajjudModalOpen] = useState(false)
  const [isTilawahModalOpen, setIsTilawahModalOpen] = useState(false)
  const [isSalahRecitationModalOpen, setIsSalahRecitationModalOpen] = useState(false)
  const [completionRate, setCompletionRate] = useState(null)
  const [date, setDate] = useState(moment.tz('Asia/Kuala_Lumpur').format('YYYY-MM-DD'))
  const [selectedSurah, setSelectedSurah] = useState(null)
  const [weeklyProgress, setWeeklyProgress] = useState({})
  const [maxMurajaahCount, setMaxMurajaahCount] = useState(0)
  const [savingMurajaahById, setSavingMurajaahById] = useState({})
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [expandedParents, setExpandedParents] = useState({})
  const inFlightMurajaahRef = useRef({})

  const navigate = useNavigate()

  // ✅ get auth once (memo)
  const auth = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    } catch {
      return {}
    }
  }, [])

  const userId = auth?.user_id

  // ✅ protect route: if not logged in, go back to login page
  useEffect(() => {
    if (!userId) navigate('/')
  }, [userId, navigate])

  // helper to attach header
  const withUserHeaders = (headers = {}) => ({
    ...headers,
    'x-user-id': String(userId),
  })

  const normalizeSurahId = (id) => {
    const numericId = Number(id)
    return Number.isFinite(numericId) ? String(numericId) : String(id)
  }

  const isSurahCheckedToday = (id) => {
    const key = normalizeSurahId(id)
    return !!checkedSurahs[key]
  }

  const isMurajaahSaving = (id) => {
    const key = normalizeSurahId(id)
    return !!savingMurajaahById[key]
  }

  useEffect(() => {
    if (!userId) return
    fetchSurahs()
    fetchWeeklyMurajaahProgress()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, userId])

  const changeDate = (days) => {
    const newDate = moment.tz(date, 'Asia/Kuala_Lumpur').add(days, 'days').format('YYYY-MM-DD')
    setDate(newDate)
  }

  const handleLogout = () => {
  localStorage.removeItem(STORAGE_KEY)
  navigate('/')
}

  const fetchSurahs = () => {
    fetch(`${HOST}/murajaah/getmemorizedsurah`, {
      headers: withUserHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) {
          console.error('Expected an array but received:', data)
          return
        }

        setSurahs(data)

        const maxCount =
          data.length > 0 ? Math.max(...data.map((s) => Number(s.murajaah_counter || 0))) : 0
        setMaxMurajaahCount(maxCount)

        fetchCompletionRate(data)
      })
      .catch((error) => console.error('An error occurred:', error))
  }

  const fetchCompletionRate = (surahList = surahs) => {
    fetch(`${HOST}/murajaah/getmurajaahprogress?date=${date}`, {
      headers: withUserHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        const newCheckedSurahs = surahList.reduce((obj, surah) => {
          obj[normalizeSurahId(surah.id)] = false
          return obj
        }, {})

        if (Array.isArray(data) && data.length > 0) {
          const checkedIds = data.reduce((arr, row) => arr.concat(row.surah_id || []), [])
          checkedIds.forEach((id) => {
            newCheckedSurahs[normalizeSurahId(id)] = true
          })
          setCompletionRate(Number(data[0].completion_rate || 0))
        } else {
          setCompletionRate(0)
        }

        setCheckedSurahs(newCheckedSurahs)
      })
      .catch((error) => console.error('An error occurred:', error))
  }

  const fetchWeeklyMurajaahProgress = () => {
    fetch(`${HOST}/murajaah/getweeklymurajaahprogress?date=${date}`, {
      headers: withUserHeaders(),
    })
      .then((res) => res.json())
      .then((data) => setWeeklyProgress(data || {}))
      .catch((error) =>
        console.error('An error occurred while fetching weekly murajaah progress:', error)
      )
  }

  // ✅ Organize surahs by Juz and handle hierarchy
  const groupedSurahs = useMemo(() => {
    if (!Array.isArray(surahs)) return {}

    const groups = {}

    // Separate parents and subsections
    const parents = surahs.filter(s => !s.parent_id)
    const subsections = surahs.filter(s => s.parent_id)

    // Create map of subsections by parent_id for quick lookup
    const subsectionMap = subsections.reduce((map, surah) => {
      if (!map[surah.parent_id]) map[surah.parent_id] = []
      map[surah.parent_id].push(surah)
      return map
    }, {})

    // Sort subsections by id
    Object.keys(subsectionMap).forEach(parentId => {
      subsectionMap[parentId].sort((a, b) => parseFloat(a.id) - parseFloat(b.id))
    })

    // Build juz groups with hierarchy info
    parents.forEach(surah => {
      if (!groups[surah.juz]) groups[surah.juz] = []
      groups[surah.juz].push({
        ...surah,
        subsections: subsectionMap[surah.id] || []
      })
    })

    // Sort surahs within each juz
    Object.keys(groups).forEach(juz => {
      groups[juz].sort((a, b) => parseFloat(a.id) - parseFloat(b.id))
    })

    return groups
  }, [surahs])

  const handleCheck = (id, event) => {
    event.stopPropagation()
    const idKey = normalizeSurahId(id)
    if (isSurahCheckedToday(idKey) || isMurajaahSaving(idKey) || inFlightMurajaahRef.current[idKey]) return
    inFlightMurajaahRef.current[idKey] = true

    setSavingMurajaahById((prev) => ({ ...prev, [idKey]: true }))

    fetch(`${HOST}/murajaah/getmurajaahprogress?date=${date}`, {
      headers: withUserHeaders(),
    })
      .then((res) => res.json())
      .then((progressData) => {
        const checkedIdsFromDb = Array.isArray(progressData)
          ? progressData.reduce((arr, row) => arr.concat(row.surah_id || []), [])
          : []

        const alreadyCheckedInDb = checkedIdsFromDb.some(
          (checkedId) => normalizeSurahId(checkedId) === idKey
        )

        if (alreadyCheckedInDb) {
          setCheckedSurahs((prev) => ({ ...prev, [idKey]: true }))
          return
        }

        return fetch(`${HOST}/murajaah/addmurajaah`, {
          method: 'POST',
          headers: withUserHeaders({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ surah_id: id }),
        }).then(async (res) => {
          if (!res.ok) throw new Error('Failed to update murajaah')
          const payload = await res.json().catch(() => ({}))
          setCheckedSurahs((prev) => ({ ...prev, [idKey]: true }))
          if (!payload?.already_marked) {
            fetchSurahs()
          }
        })
      })
      .catch((error) => {
        console.error('An error occurred while updating murajaah:', error)
      })
      .finally(() => {
        setSavingMurajaahById((prev) => ({ ...prev, [idKey]: false }))
        delete inFlightMurajaahRef.current[idKey]
      })
  }

  // Toggle parent expand/collapse
  const toggleParentExpand = (parentId, event) => {
    event.stopPropagation()
    setExpandedParents(prev => ({
      ...prev,
      [parentId]: !prev[parentId]
    }))
  }

  const handleLoginClick = () => {
    setIsLoginModalOpen(true)
  }

  return (
    <div className="surah-list-container">
      <div className="surah-list-header">
        <h1 className="surah-list-title">
          Murajaah Tracker {auth?.user ? `— ${auth.user}` : ''}
        </h1>
      </div>

      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />

      <div className="nav-controls">
        {/* <button className="nav-btn" onClick={() => changeDate(-1)}>
          Yesterday
        </button> */}

        {/* <button className="nav-btn" onClick={() => changeDate(1)}>
          Tomorrow
        </button> */}
        <button className="nav-btn" onClick={() => setIsModalOpen(true)}>
          Add Memorized Surah
      </button>

        <button className="nav-btn" onClick={() => setIsTilawahModalOpen(true)}>
          Tilawah
        </button>

        <button className="nav-btn" onClick={() => setIsSabaqModalOpen(true)}>
          Sabaq
        </button>

        <button className="nav-btn" onClick={() => setIsSalahRecitationModalOpen(true)}>
          Salah Recitation
        </button>

        <button className="nav-btn logout-btn" onClick={() => {
          localStorage.removeItem(STORAGE_KEY)
          navigate('/')
        }}>
          Logout
        </button>
      </div>

      {/* ✅ Pass userId to modals (so you can make them user-aware too) */}
      <TilawahModal
        isOpen={isTilawahModalOpen}
        onClose={() => setIsTilawahModalOpen(false)}
        userId={userId}
      />

      <SabaqModal
        isOpen={isSabaqModalOpen}
        onClose={() => setIsSabaqModalOpen(false)}
        userId={userId}
      />

      <TahajjudModal
        isOpen={isTahajjudModalOpen}
        onClose={() => setIsTahajjudModalOpen(false)}
        userId={userId}
      />

      <SalahRecitationModal
        isOpen={isSalahRecitationModalOpen}
        onClose={() => setIsSalahRecitationModalOpen(false)}
        surahs={surahs}
        checkedSurahs={checkedSurahs}
        date={date}
        userId={userId}
        onMurajaahUpdated={fetchSurahs}
      />

      {/* {completionRate !== null && (
        <div className="progress-card">
          <div className="progress-label">Murajaah Progress for {date}</div>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${completionRate}%` }}></div>
          </div>
          <div className="progress-value">{Number(completionRate || 0).toFixed(2)}%</div>
        </div>
      )} */}

      {/* <div className="weekly-progress-wrapper">
        <h2 className="section-subheading">Weekly Overview</h2>
        <table className="weekly-table">
          <thead>
            <tr>
              {Object.entries(weeklyProgress).map(([day, progressData]) => (
                <th key={day}>
                  <div className="table-day">{day}</div>
                  <div className="table-date">{moment(progressData.day).format('DD-MM')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {Object.entries(weeklyProgress).map(([day, progressData]) => (
                <td key={day}>
                  <div className="table-progress-value">{parseFloat(progressData.rate || 0).toFixed(2)}%</div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div> */}

      

      {/* ✅ Pass userId so AddSurahModal can send x-user-id */}
      <AddSurahModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedSurah(null)
        }}
        onSurahAdded={fetchSurahs}
        initialData={selectedSurah}
        userId={userId}
      />

      <div className="surahs-container">
        {Object.keys(groupedSurahs)
          .sort((a, b) => a - b)
          .map((juz) => (
            <section key={juz} className="juz-section">
              <h2 className="juz-heading">Juz {juz}</h2>
              <div className="surahs-grid">
                {groupedSurahs[juz].map((surah, index) => {
                  const isParent = surah.subsections && surah.subsections.length > 0
                  const isExpanded = expandedParents[surah.id]
                  const subsectionCount = surah.subsections ? surah.subsections.length : 0
                  const completedSubsections = surah.subsections 
                    ? surah.subsections.filter(s => isSurahCheckedToday(s.id)).length 
                    : 0

                  return (
                    <div key={surah.id}>
                      {/* Parent Card */}
                      <div
                        className={`surah-card ${isParent ? 'surah-card--parent' : ''} ${
                          isExpanded ? 'surah-card--expanded' : ''
                        }`}
                        style={{ animationDelay: `${index * 0.05}s` }}
                        onClick={() => {
                          if (isParent) {
                            // Toggle expand/collapse for parent surahs
                            setExpandedParents(prev => ({
                              ...prev,
                              [surah.id]: !prev[surah.id]
                            }))
                          } else {
                            // Open modal for non-parent surahs
                            setSelectedSurah(surah)
                            setIsModalOpen(true)
                          }
                        }}
                      >
                        <div className="surah-content">
                          {isParent && (
                            <button
                              className={`expand-btn ${isExpanded ? 'expand-btn--open' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpandedParents(prev => ({
                                  ...prev,
                                  [surah.id]: !prev[surah.id]
                                }))
                              }}
                              aria-label={isExpanded ? 'Collapse' : 'Expand'}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                              </svg>
                            </button>
                          )}
                          <div className="surah-number">{surah.parent_id ? surah.id : Math.floor(surah.id)}</div>
                          <div className="surah-details">
                            <h3 className="surah-name">{surah.chapter_name}</h3>
                            <div className="surah-meta">
                              <span className="meta-item">
                                <span className="meta-label">Verses:</span>
                                {isParent && surah.subsections?.length > 0
                                  ? `${surah.subsections[surah.subsections.length - 1].verse_memorized}/${surah.total_verse}`
                                  : `${surah.verse_memorized}/${surah.total_verse}`}
                              </span>
                              <span className="meta-divider">·</span>
                              {!isParent && (
                                <span className="meta-item">
                                  <span className="meta-label">Murajaah:</span>
                                  <span
                                    className={
                                      Number(surah.murajaah_counter || 0) !== Number(maxMurajaahCount || 0)
                                        ? 'murajaah-count-behind'
                                        : 'murajaah-count'
                                    }
                                  >
                                    {surah.murajaah_counter}
                                  </span>
                                </span>
                              )}
                              {/* {isParent && (
                                <>
                                  <span className="meta-divider">·</span>
                                  <span className="meta-item subsection-status">
                                    {completedSubsections}/{subsectionCount} subsections
                                  </span>
                                </>
                              )} */}
                            </div>
                          </div>
                        </div>

                        {!isParent && (
                          <button
                            className={`check-btn ${isSurahCheckedToday(surah.id) ? 'checked' : ''}`}
                            onClick={(event) =>
                              !isSurahCheckedToday(surah.id) &&
                              !isMurajaahSaving(surah.id) &&
                              handleCheck(surah.id, event)
                            }
                            disabled={isSurahCheckedToday(surah.id) || isMurajaahSaving(surah.id)}
                          >
                            {isSurahCheckedToday(surah.id) ? (
                              <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            ) : (
                              <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Subsections (expanded) */}
                      {isParent && isExpanded && (
                        <div className="subsections-container">
                          {surah.subsections.map((subsection, subIndex) => (
                            <div
                              key={subsection.id}
                              className="surah-card surah-card--subsection"
                              style={{ animationDelay: `${(index + subIndex + 1) * 0.05}s` }}
                              onClick={() => {
                                setSelectedSurah(subsection)
                                setIsModalOpen(true)
                              }}
                            >
                              <div className="surah-content">
                                <div className="surah-number subsection-number">{subsection.id}</div>
                                <div className="surah-details">
                                  <h3 className="surah-name">{subsection.chapter_name}</h3>
                                  <div className="surah-meta">
                                    <span className="meta-item">
                                      <span className="meta-label">Verses:</span>
                                      {subsection.verse_memorized}/{subsection.total_verse}
                                    </span>
                                    <span className="meta-divider">·</span>
                                    <span className="meta-item">
                                      <span className="meta-label">Murajaah:</span>
                                      <span
                                        className={
                                          Number(subsection.murajaah_counter || 0) !== Number(maxMurajaahCount || 0)
                                            ? 'murajaah-count-behind'
                                            : 'murajaah-count'
                                        }
                                      >
                                        {subsection.murajaah_counter}
                                      </span>
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <button
                                className={`check-btn ${isSurahCheckedToday(subsection.id) ? 'checked' : ''}`}
                                onClick={(event) =>
                                  !isSurahCheckedToday(subsection.id) &&
                                  !isMurajaahSaving(subsection.id) &&
                                  handleCheck(subsection.id, event)
                                }
                                disabled={isSurahCheckedToday(subsection.id) || isMurajaahSaving(subsection.id)}
                              >
                                {isSurahCheckedToday(subsection.id) ? (
                                  <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                  </svg>
                                ) : (
                                  <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                  </svg>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
      </div>
    </div>
  )
}

export default SurahList

