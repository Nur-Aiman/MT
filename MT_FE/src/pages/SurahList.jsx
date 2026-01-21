import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AddSurahModal from '../components/AddSurahModal'
import SabaqModal from '../components/SabaqModal'
import LoginModal from '../components/LoginModal'
import TahajjudModal from '../components/TahajjudModal'
import { HOST } from '../api'
import moment from 'moment-timezone'

const STORAGE_KEY = 'murajaah_auth'

function SurahList() {
  const [surahs, setSurahs] = useState([])
  const [checkedSurahs, setCheckedSurahs] = useState({})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSabaqModalOpen, setIsSabaqModalOpen] = useState(false)
  const [isTahajjudModalOpen, setIsTahajjudModalOpen] = useState(false)
  const [completionRate, setCompletionRate] = useState(null)
  const [date, setDate] = useState(moment.tz('Asia/Kuala_Lumpur').format('YYYY-MM-DD'))
  const [selectedSurah, setSelectedSurah] = useState(null)
  const [weeklyProgress, setWeeklyProgress] = useState({})
  const [maxMurajaahCount, setMaxMurajaahCount] = useState(0)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)

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
          obj[surah.id] = false
          return obj
        }, {})

        if (Array.isArray(data) && data.length > 0) {
          const checkedIds = data.reduce((arr, row) => arr.concat(row.surah_id || []), [])
          checkedIds.forEach((id) => {
            newCheckedSurahs[id] = true
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

  const groupedSurahs = Array.isArray(surahs)
    ? surahs.reduce((groups, surah) => {
        if (!groups[surah.juz]) groups[surah.juz] = []
        groups[surah.juz].push(surah)
        return groups
      }, {})
    : {}
const navButtonStyle = {
  padding: '10px',
  backgroundColor: '#84a59d',
  border: 'none',
  color: 'white',
  borderRadius: '5px',
  cursor: 'pointer',
}

  const handleCheck = (id, event) => {
    event.stopPropagation()

    const newCheckedState = !checkedSurahs[id]
    const updatedCount = newCheckedState ? 1 : -1
    const updatedCheckedSurahsCount =
      Object.values(checkedSurahs).filter((val) => val).length + updatedCount
    const optimisticCompletionRate = surahs.length > 0 ? (updatedCheckedSurahsCount / surahs.length) * 100 : 0

    setCompletionRate(optimisticCompletionRate)

    const updatedCheckedSurahs = { ...checkedSurahs, [id]: newCheckedState }
    setCheckedSurahs(updatedCheckedSurahs)

    fetch(`${HOST}/murajaah/addmurajaah`, {
      method: 'POST',
      headers: withUserHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ surah_id: id }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to update murajaah')
        // ✅ your backend sends text ("Inserted Successfully"/"Updated Successfully")
        const text = await res.text()
        console.log('Murajaah updated:', text)
      })
      .catch((error) => {
        console.error('An error occurred while updating murajaah:', error)
      })
  }

  const handleLoginClick = () => {
    setIsLoginModalOpen(true)
  }

  return (
    <div
      style={{
        fontFamily: 'Arial, sans-serif',
        padding: '20px',
        backgroundColor: '#f4f7f6',
        color: '#30404d',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ borderBottom: '2px solid #84a59d', paddingBottom: '10px' }}>
          Murajaah Tracker {auth?.user ? `— ${auth.user}` : ''}
        </h1>
      </div>

      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />

      <div
  style={{
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  }}
>
  <button
    onClick={() => changeDate(-1)}
    style={navButtonStyle}
  >
    Yesterday
  </button>

  <button
    onClick={() => changeDate(1)}
    style={navButtonStyle}
  >
    Tomorrow
  </button>

  <button
    onClick={() => setIsSabaqModalOpen(true)}
    style={navButtonStyle}
  >
    Sabaq
  </button>

  {/* 🔴 LOGOUT BUTTON — pushed to the right */}
  <button
    onClick={() => {
      localStorage.removeItem(STORAGE_KEY)
      navigate('/')
    }}
    style={{
      marginLeft: 'auto',   // ✅ this pushes it right
      padding: '10px',
      backgroundColor: '#d32f2f',
      border: 'none',
      color: 'white',
      borderRadius: '5px',
      cursor: 'pointer',
      fontWeight: 'bold',
    }}
  >
    Logout
  </button>
</div>




      {/* ✅ Pass userId to modals (so you can make them user-aware too) */}
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

      {completionRate !== null && (
        <p
          style={{
            backgroundColor: '#2a9d8f',
            padding: '10px',
            borderRadius: '5px',
            color: 'white',
          }}
        >
          Murajaah Progress for {date}: {Number(completionRate || 0).toFixed(2)}%
        </p>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: '20px',
            fontSize: '14px',
          }}
        >
          <thead>
            <tr>
              {Object.entries(weeklyProgress).map(([day, progressData]) => (
                <th
                  key={day}
                  style={{
                    borderBottom: '2px solid #84a59d',
                    padding: '10px',
                    textAlign: 'center',
                  }}
                >
                  {day} ({moment(progressData.day).format('DD-MM-YYYY')})
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {Object.entries(weeklyProgress).map(([day, progressData]) => (
                <td
                  key={day}
                  style={{
                    borderBottom: '1px solid #ccc',
                    padding: '10px',
                    textAlign: 'center',
                  }}
                >
                  {parseFloat(progressData.rate || 0).toFixed(2)}%
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <button
        onClick={() => setIsModalOpen(true)}
        style={{
          marginTop: '20px',
          padding: '10px',
          backgroundColor: '#84a59d',
          border: 'none',
          color: 'white',
          borderRadius: '5px',
        }}
      >
        Add Surah
      </button>

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

      {Object.keys(groupedSurahs)
        .sort((a, b) => a - b)
        .map((juz) => (
          <div key={juz} style={{ marginTop: '20px' }}>
            <h2>Juz {juz}</h2>

            {groupedSurahs[juz].map((surah) => (
              <div
                key={surah.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '10px',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setSelectedSurah(surah)
                  setIsModalOpen(true)
                }}
              >
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 'larger' }}>
                    {surah.id}. {surah.chapter_name}
                  </strong>
                  <br />
                  (Verses Memorized: {surah.verse_memorized}/{surah.total_verse})
                  <br />
                  (Murajaah Count:{' '}
                  <span
                    style={{
                      backgroundColor:
                        Number(surah.murajaah_counter || 0) !== Number(maxMurajaahCount || 0)
                          ? 'yellow'
                          : 'inherit',
                    }}
                  >
                    {surah.murajaah_counter}
                  </span>
                  )
                </div>

                <button
                  onClick={(event) => !checkedSurahs[surah.id] && handleCheck(surah.id, event)}
                  disabled={checkedSurahs[surah.id]}
                  style={{
                    padding: '5px 10px',
                    backgroundColor: checkedSurahs[surah.id] ? '#ccc' : '#84a59d',
                    border: 'none',
                    color: 'white',
                    borderRadius: '5px',
                  }}
                >
                  {checkedSurahs[surah.id] ? '✓' : 'Check'}
                </button>
              </div>
            ))}
          </div>
        ))}
    </div>
  )
}

export default SurahList
