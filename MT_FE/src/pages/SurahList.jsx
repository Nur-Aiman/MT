import React, { useState, useEffect } from 'react'
import AddSurahModal from '../components/AddSurahModal'
import SabaqModal from '../components/SabaqModal'
import LoginModal from '../components/LoginModal';
import TahajjudModal from '../components/TahajjudModal';
import { HOST } from '../api'
import moment from 'moment-timezone'

function SurahList() {
  const [surahs, setSurahs] = useState([])
  const [checkedSurahs, setCheckedSurahs] = useState({})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSabaqModalOpen, setIsSabaqModalOpen] = useState(false)
  const [isTahajjudModalOpen, setIsTahajjudModalOpen] = useState(false);
  const [completionRate, setCompletionRate] = useState(null)
  const [date, setDate] = useState(
    moment.tz('Asia/Kuala_Lumpur').format('YYYY-MM-DD')
  )
  const [selectedSurah, setSelectedSurah] = useState(null)
  const [weeklyProgress, setWeeklyProgress] = useState({})
  const [maxMurajaahCount, setMaxMurajaahCount] = useState(0);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    fetchSurahs()
    fetchWeeklyMurajaahProgress()
  }, [date])

  const changeDate = (days) => {
    const newDate = moment
      .tz(date, 'Asia/Kuala_Lumpur')
      .add(days, 'days')
      .format('YYYY-MM-DD')
    setDate(newDate)
  }

  const fetchSurahs = () => {
    fetch(`${HOST}/murajaah/getmemorizedsurah`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSurahs(data);
          const maxCount = Math.max(...data.map(surah => surah.murajaah_counter)); // Calculate the maximum murajaah count
          setMaxMurajaahCount(maxCount); 
          fetchCompletionRate(data);
        } else {
          console.error('Expected an array but received:', data);
        }
      })
      .catch((error) => console.error('An error occurred:', error));
  };

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

  const fetchWeeklyMurajaahProgress = () => {
    fetch(`${HOST}/murajaah/getweeklymurajaahprogress?date=${date}`)
      .then((res) => res.json())
      .then((data) => {
        setWeeklyProgress(data)
      })
      .catch((error) =>
        console.error(
          'An error occurred while fetching weekly murajaah progress:',
          error
        )
      )
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

  const handleLoginClick = () => {
    console.log('Login button clicked');
    setIsLoginModalOpen(true);
  };

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
          Murajaah Tracker
        </h1>
        {/* <button
          onClick={handleLoginClick}
          style={{
            padding: '10px',
            backgroundColor: '#84a59d',
            border: 'none',
            color: 'white',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          Login
        </button> */}
      </div>

      
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />

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

        <button
          onClick={() => setIsSabaqModalOpen(true)}
          style={{
            marginLeft: '10px',
            padding: '10px',
            backgroundColor: '#84a59d',
            border: 'none',
            color: 'white',
            borderRadius: '5px',
          }}
        >
          Sabaq
        </button>

        <button
  onClick={() => setIsTahajjudModalOpen(true)}
  style={{
    marginLeft: '10px',
    padding: '10px',
    backgroundColor: '#ffd700',
    border: 'none',
    color: 'black',
    borderRadius: '5px',
  }}
>
  Tahajjud
</button>
      </div>

      <SabaqModal
        isOpen={isSabaqModalOpen}
        onClose={() => setIsSabaqModalOpen(false)}
        // Add other props if needed...
      />

<TahajjudModal
  isOpen={isTahajjudModalOpen}
  onClose={() => setIsTahajjudModalOpen(false)}
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
          Murajaah Progress for {date}:{' '}
          {completionRate !== null ? completionRate : 0}%
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
                  {parseFloat(progressData.rate).toFixed(2)}%
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <style jsx>{`
  @media (max-width: 480px) {
    table {
      fontSize: 12px;
    }
  }
`}</style>

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
                  <strong style={{ fontSize: 'larger' }}> 
        {surah.id}. {surah.chapter_name}
      </strong>
                  <br />
                  (Verses Memorized: {surah.verse_memorized}/{surah.total_verse})
                  <br />
                  
                    (Murajaah Count: <span
                    style={{
                      backgroundColor: surah.murajaah_counter !== maxMurajaahCount ? 'yellow' : 'inherit', 
                    }}
                  > {surah.murajaah_counter}
                  </span>)
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
//comment
//comment2
//comment3
//COMMENT4

export default SurahList
