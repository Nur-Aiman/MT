import React, { useState, useEffect } from 'react'
import AddSurahModal from '../components/AddSurahModal'
import { HOST } from '../api'

function SurahList() {
  const [surahs, setSurahs] = useState([])
  const [checkedSurahs, setCheckedSurahs] = useState({})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [completionRate, setCompletionRate] = useState(null)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedSurah, setSelectedSurah] = useState(null)

  useEffect(() => {
    fetchSurahs()
  }, [date])

  const changeDate = (days) => {
    const newDate = new Date(date)
    newDate.setDate(newDate.getDate() + days)
    setDate(newDate.toISOString().split('T')[0])
  }

  const fetchSurahs = () => {
    fetch(`${HOST}/murajaah/getmemorizedsurah`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSurahs(data)

          fetchCompletionRate(data)
        } else {
          console.error('Expected an array but received:', data)
        }
      })
      .catch((error) => console.error('An error occurred:', error))
  }

  const fetchCompletionRate = (surahList = surahs) => {
    fetch(`${HOST}/murajaah/getmurajaahprogress?date=${date}`)
      .then((res) => res.json())
      .then((data) => {
        const newCheckedSurahs = surahList.reduce((obj, surah) => {
          obj[surah.id] = false
          return obj
        }, {})

        if (data && data.length > 0) {
          const checkedIds = data.reduce((arr, row) => {
            return arr.concat(row.surah_id)
          }, [])

          checkedIds.forEach((id) => {
            newCheckedSurahs[id] = true
          })

          setCompletionRate(data[0].completion_rate)
        } else {
          console.log('No data for this date, setting completion rate to 0')
          setCompletionRate(0)
        }

        setCheckedSurahs(newCheckedSurahs)
      })
      .catch((error) => console.error('An error occurred:', error))
  }

  const groupedSurahs = Array.isArray(surahs)
    ? surahs.reduce((groups, surah) => {
        if (!groups[surah.juz]) {
          groups[surah.juz] = []
        }
        groups[surah.juz].push(surah)
        return groups
      }, {})
    : {}

  const handleCheck = (id, event) => {
    event.stopPropagation()

    const newCheckedState = !checkedSurahs[id]
    const updatedCount = newCheckedState ? 1 : -1
    const updatedCheckedSurahsCount =
      Object.values(checkedSurahs).filter((val) => val).length + updatedCount
    const optimisticCompletionRate =
      (updatedCheckedSurahsCount / surahs.length) * 100

    setCompletionRate(optimisticCompletionRate)

    const updatedCheckedSurahs = {
      ...checkedSurahs,
      [id]: newCheckedState,
    }
    setCheckedSurahs(updatedCheckedSurahs)

    fetch(`${HOST}/murajaah/addmurajaah`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ surah_id: id }),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to update murajaah')
        }
        return res.json()
      })
      .then((data) => {
        console.log('Murajaah updated:', data)
      })
      .catch((error) => {
        console.error('An error occurred while updating murajaah:', error)
      })
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
      <h1 style={{ borderBottom: '2px solid #84a59d', paddingBottom: '10px' }}>
        Murajaah Tracker
      </h1>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => changeDate(-1)}
          style={{
            marginRight: '10px',
            padding: '10px',
            backgroundColor: '#84a59d',
            border: 'none',
            color: 'white',
            borderRadius: '5px',
          }}
        >
          Yesterday
        </button>

        <button
          onClick={() => changeDate(1)}
          style={{
            padding: '10px',
            backgroundColor: '#84a59d',
            border: 'none',
            color: 'white',
            borderRadius: '5px',
          }}
        >
          Tomorrow
        </button>
      </div>

      {completionRate !== null && (
        <p
          style={{
            backgroundColor: '#2a9d8f',
            padding: '10px',
            borderRadius: '5px',
            color: 'white',
          }}
        >
          Murajaah Progress for {date}:{' '}
          {completionRate !== null ? completionRate : 0}%
        </p>
      )}

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

      <AddSurahModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedSurah(null)
        }}
        onSurahAdded={fetchSurahs}
        initialData={selectedSurah}
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
                  <strong>
                    {surah.id}. {surah.chapter_name}
                  </strong>{' '}
                  ( Verses Memorized: {surah.verse_memorized}/
                  {surah.total_verse})
                </div>
                <button
                  onClick={(event) =>
                    !checkedSurahs[surah.id] && handleCheck(surah.id, event)
                  }
                  disabled={checkedSurahs[surah.id]}
                  style={{
                    padding: '5px 10px',
                    backgroundColor: checkedSurahs[surah.id]
                      ? '#ccc'
                      : '#84a59d',
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
