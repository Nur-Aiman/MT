import React, { useState, useEffect } from 'react';
import { HOST } from '../api';
import moment from 'moment';

const TahajjudModal = ({ isOpen, onClose }) => {
  const [tahajjudData, setTahajjudData] = useState({
    highestStreak: 'Loading...',
    currentStreak: 'Loading...',
    totalInCurrentMonth: 'Loading...',
    totalInCurrentYear: 'Loading...',
  });
  const [history, setHistory] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [currentWeekRange, setCurrentWeekRange] = useState({ start: '', end: '' });
  const [weekDays, setWeekDays] = useState([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isTodayCompleted, setIsTodayCompleted] = useState(false);

  

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  };

  const updateWeekDaysAndRange = (offset) => {
    const startOfWeek = moment().startOf('isoWeek').subtract(offset * 7, 'days');
    const endOfWeek = moment(startOfWeek).endOf('isoWeek');
    const days = [];

    for (let i = 0; i < 7; i++) {
      days.push(startOfWeek.clone().add(i, 'days').format('YYYY-MM-DD'));
    }

    setWeekDays(days.reverse());
    setCurrentWeekRange({
      start: startOfWeek.format('YYYY-MM-DD'),
      end: endOfWeek.format('YYYY-MM-DD')
    });
  };

  const checkTodayCompletion = () => {
    const todayFormatted = moment().format('YYYY-MM-DD');
    fetch(`${HOST}/murajaah/tahajjud/check_today_completion`)
      .then(response => response.json())
      .then(({ isCompleted }) => {
        setIsTodayCompleted(isCompleted);
      })
      .catch(error => {
        console.error('Error checking today\'s completion:', error);
      });
  };

  const checkIfTodayIsCompleted = (historyRecords) => {
    const todayFormatted = moment().format('YYYY-MM-DD');
    const isRecorded = historyRecords.some(record =>
      record.dates.map(date => moment(date).format('YYYY-MM-DD')).includes(todayFormatted)
    );
    setIsCompleted(isRecorded);
  };
  

  const fetchHistory = (offset) => {
    return fetch(`${HOST}/murajaah/tahajjud/history/${offset}`) // Note the return here
      .then(response => response.json())
      .then(data => {
        setHistory(data.historyRecords);
        checkIfTodayIsCompleted(data.historyRecords);
        checkTodayCompletion();
      })
      .catch(error => {
        console.error('Error fetching Tahajjud history:', error);
      });
  };
  


  

  const fetchTahajjudRecords = () => {
    fetch(`${HOST}/murajaah/view_tahajjud_records`)
      .then(response => response.json())
      .then(data => {
        setTahajjudData({
          highestStreak: data.highestStreak,
          currentStreak: data.currentStreak,
          totalInCurrentMonth: data.totalInCurrentMonth,
          totalInCurrentYear: data.totalInCurrentYear,
        });
      })
      .catch(error => {
        console.error('Error fetching Tahajjud records:', error);
      });
  };
  

  useEffect(() => {
    if (isOpen) {
      checkTodayCompletion();
      fetchTahajjudRecords();
      updateWeekDaysAndRange(weekOffset);
      fetchHistory(weekOffset);
    }
  }, [isOpen, weekOffset]);
  

  

  const handlePrevWeek = () => {
    const newOffset = weekOffset + 1;
    setWeekOffset(newOffset);
    updateWeekDaysAndRange(newOffset);
    fetchHistory(newOffset).then(() => {
      checkIfTodayIsCompleted(history);
    });
  };
  
  const handleNextWeek = () => {
    const newOffset = Math.max(0, weekOffset - 1);
    setWeekOffset(newOffset);
    updateWeekDaysAndRange(newOffset);
    fetchHistory(newOffset).then(() => {
      checkIfTodayIsCompleted(history);
    });
  };
  

  const checkRecordedTahajjud = (day) => {
    const formattedDay = moment(day).format('YYYY-MM-DD');
    return history.some(record =>
      record.dates.map(date => moment(date).format('YYYY-MM-DD')).includes(formattedDay)
    );
  };

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.toLocaleString('default', { month: 'short' });
  const formattedDate = currentDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const dayOfWeek = currentDate.toLocaleDateString('en-GB', { weekday: 'long' });

  const handleTahajjudCompletion = () => {
    const currentDateStr = moment().format('YYYY-MM-DD');
    fetch(`${HOST}/murajaah/tahajjud/record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ currentDate: currentDateStr }),
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      console.log('Tahajjud recorded successfully:', data);
      setIsCompleted(true);
      // Refresh the history to reflect the new state
      fetchHistory(weekOffset);
      fetchTahajjudRecords();
    })
    .catch(error => {
      console.error('Error recording Tahajjud:', error);
    });
  };

  if (!isOpen) return null;

  const buttonStyle = {
    fontSize: '1rem',
    fontWeight: 'bold',
    padding: '10px 20px',
    borderRadius: '5px',
    margin: '0 10px', // added margin for spacing
    cursor: 'pointer',
    transition: 'background-color 0.3s',
  };
  
  // Set the style for the container of navigation buttons
  const navigationContainerStyle = {
    display: 'flex',
    justifyContent: 'space-between', // This will place the buttons at opposite ends
    alignItems: 'center',
    marginTop: '20px',
  };
  
  // Set the style for the history section header
  const historyHeaderStyle = {
    backgroundColor: '#7E30E1',
    color: '#F3F8FF',
    padding: '10px',
    borderRadius: '5px',
    textAlign: 'center',
    fontSize: '1.25rem',
    fontWeight: 'bold',
    marginTop: '20px', // added margin-top for spacing
  };

  return (
    <div
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      zIndex: 1000,
    }}
    onClick={onClose}
  >
    <div
      style={{
        backgroundColor: '#fafbfc',
        padding: '28px',
        borderRadius: '14px',
        maxWidth: '540px',
        width: '90%',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
        zIndex: 1001,
        fontFamily: 'Merriweather, serif',
      }}
      onClick={e => e.stopPropagation()}
    >
        <h2 style={{ color: '#3a8a7d', fontFamily: 'Merriweather, serif', fontSize: '24px', fontWeight: 600, marginTop: 0, borderBottom: '2px solid #6fa599', paddingBottom: '14px', marginBottom: '20px' }}>Tahajjud Tracker</h2>
        <p style={{ fontFamily: 'Merriweather, serif', color: '#2d5a55', marginBottom: '12px' }}><strong>Highest Streak:</strong> {tahajjudData.highestStreak}</p>
        <p style={{ fontFamily: 'Merriweather, serif', color: '#2d5a55', marginBottom: '12px' }}><strong>Current Streak:</strong> {tahajjudData.currentStreak}</p>
        {/* <p>Total in Month {currentMonth}: {tahajjudData.totalInCurrentMonth}</p>
        <p>Total in {currentYear}: {tahajjudData.totalInCurrentYear}</p> */}
        <div style={{
  display: 'flex',
  justifyContent: 'space-between', // This will create space between the text and the button
  alignItems: 'center',
  marginTop: '20px'
}}>
  <p style={{ margin: 0 }}>
    Tahajjud completion status for {formattedDate} ({dayOfWeek}):
  </p>
  <button
          onClick={!isCompleted ? handleTahajjudCompletion : undefined}
          style={{
            marginTop: '10px',
            padding: '11px 16px',
            backgroundColor: isCompleted ? '#a8a8a8' : '#6fa599',
            border: 'none',
            color: '#fff',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 600,
            fontFamily: 'Merriweather, serif',
            cursor: isCompleted ? 'default' : 'pointer',
            transition: 'background-color 0.3s',
          }}
          disabled={isCompleted}
        >
          {isCompleted ? 'Completed' : 'Complete'}
        </button>
</div>

       {/* Tahajjud history week navigation */}
       <div
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '20px',
  }}
>
  <button
    onClick={handlePrevWeek}
    style={{
      padding: '11px 16px',
      backgroundColor: '#6fa599',
      border: 'none',
      color: 'white',
      borderRadius: '6px',
      fontWeight: 600,
      fontFamily: 'Merriweather, serif',
      cursor: 'pointer',
      transition: 'background-color 0.3s',
    }}
  >
    Prev Week
  </button>
  <button
    onClick={handleNextWeek}
    style={{
      padding: '11px 16px',
      backgroundColor: '#6fa599',
      border: 'none',
      color: 'white',
      borderRadius: '6px',
      fontWeight: 600,
      fontFamily: 'Merriweather, serif',
      cursor: weekOffset === 0 ? 'not-allowed' : 'pointer',
      transition: 'background-color 0.3s',
      opacity: weekOffset === 0 ? 0.6 : 1,
    }}
    disabled={weekOffset === 0}
  >
    Next Week
  </button>
</div>


        {/* Tahajjud history records */}
        <div className="tahajjud-history" style={{ marginTop: '20px' }}>
  <h3 style={{ color: '#3a8a7d', fontFamily: 'Merriweather, serif', fontSize: '18px', fontWeight: 600, marginBottom: '16px', borderBottom: '1px solid #d0d4d9', paddingBottom: '10px' }}>Week of {formatDate(currentWeekRange.start)} to {formatDate(currentWeekRange.end)}</h3>
  {weekDays.map((day, index) => (
    <div key={index} className="day-record" style={{ marginBottom: '12px', padding: '10px 12px', backgroundColor: '#f8fbfa', borderRadius: '6px', borderLeft: checkRecordedTahajjud(day) ? '3px solid #6fa599' : '3px solid #d0d4d9' }}>
      <span style={{ fontFamily: 'Merriweather, serif', color: '#2d5a55', fontWeight: 500 }}>{formatDate(day)}: </span>
      {checkRecordedTahajjud(day) ? (
        <span style={{ color: '#6fa599', fontWeight: 700, marginLeft: '8px' }}>✓ Completed</span>
      ) : (
        <span style={{ color: '#888', fontSize: '13px', marginLeft: '8px' }}>No record</span>
      )}
    </div>
  ))}
</div>
      </div>
    </div>
  );
};

export default TahajjudModal;
