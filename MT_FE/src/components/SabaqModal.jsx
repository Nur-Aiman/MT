import React, { useState, useEffect } from 'react'
import { HOST } from '../api'

const SabaqModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    chapter_number: '',
    chapter_name: '',
    page: '',
    section: '',
    verse: '',
    number_of_readings: 0,
    complete_memorization: false,
    murajaah_20_times: 0,
  })

  const [showVerses, setShowVerses] = useState(false);
  const [verses, setVerses] = useState([]);


  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prevState) => ({ ...prevState, [name]: value }))
  }

  useEffect(() => {
    if (isOpen) {
      fetch(`${HOST}/murajaah/sabaqtracker/latest`)
        .then((response) => response.json())
        .then((data) => {
          setFormData(data)
          console.log('Fetched Data: ', data)
        })
        .catch((error) => {
          console.error('Error fetching latest sabaq record', error)
        })
    }
  }, [isOpen])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const response = await fetch(`${HOST}/murajaah/sabaqtracker/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        alert(`Submitted successfully! \n\nDetails:\n
        Chapter Number: ${formData.chapter_number}\n
        Chapter Name: ${formData.chapter_name}\n
        Page: ${formData.page}\n
        Section: ${formData.section}\n
        Verse: ${formData.verse}\n
        Number of Readings: ${formData.number_of_readings}\n
        Complete Memorization: ${formData.complete_memorization}\n
        Murajaah 20 Times: ${formData.murajaah_20_times}\n`)
      } else {
        console.error('Error submitting data', data.message)
        alert(data.message || 'Error')
      }
    } catch (error) {
      console.error('Error submitting data', error)
      alert('An error occurred while submitting.')
    }
  }

  const handleBackgroundClick = (e) => {
    onClose()
  }

  const handleContentClick = (e) => {
    e.stopPropagation()
  }

  const handleViewVerseClick = async () => {
    
    if (!showVerses) { // Only fetch verses if they are about to be shown
      const verseRange = formData.verse.split('-').map(num => num.trim());
      const beginning = verseRange[0];
      const ending = verseRange[1];
      const surah = formData.chapter_number;
      const apiUrl = `http://localhost:8080/murajaah/surah/${surah}?beginning=${beginning}&ending=${ending}`;

      try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        if (response.ok) {
          setVerses(data.data.ayahs.map(ayah => `${ayah.text} - ${ayah.numberInSurah}`));
          setShowVerses(true);
        } else {
          console.error('Error fetching verses', data.message);
          alert(data.message || 'Error fetching verses');
        }
      } catch (error) {
        console.error('Error fetching verses', error);
        alert('An error occurred while fetching verses. Please fill in chapter number (eg : 73) and verse range (eg : 1 - 3)');
      }
    } else {
      setShowVerses(false);
      setVerses([]); // Clear verses if hiding them
    }
  };

  if (!isOpen) {
    return null
  }

  return (
    <div style={modalStyles} onClick={handleBackgroundClick}>
      <div style={modalContentStyles} onClick={handleContentClick}>
        <h2
          style={{ borderBottom: '2px solid #84a59d', paddingBottom: '10px' }}
        >
          Add Sabaq Record
        </h2>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button onClick={handleViewVerseClick} style={viewVerseButtonStyles}>
            {showVerses ? 'Hide Verse' : 'View Verse'}
          </button>
        </div>
        {showVerses && verses.map((verse, index) => (
          <div key={index} style={{ textAlign: 'center', marginBottom: '20px', fontSize: '25px' }}>{verse}</div>
        ))}
        <form onSubmit={handleSubmit} style={formStyles}>
          <div className='inputGroup'>
            <label style={labelStyles}>Chapter Number</label>
            <input
              name='chapter_number'
              value={formData.chapter_number || ''}
              onChange={handleChange}
              required
              style={inputStyles}
            />

            <label style={labelStyles}>Chapter Name</label>
            <input
              name='chapter_name'
              value={formData.chapter_name || ''}
              onChange={handleChange}
              required
              style={inputStyles}
            />
          </div>
          <div className='inputGroup'>
            <label style={labelStyles}>Page</label>
            <input
              name='page'
              value={formData.page || ''}
              onChange={handleChange}
              required
              style={inputStyles}
            />

            <label style={labelStyles}>Section</label>
            <input
              name='section'
              value={formData.section || ''}
              onChange={handleChange}
              required
              style={inputStyles}
            />
          </div>
          <div className='inputGroup'>
            <label style={labelStyles}>Verse</label>
            <input
              name='verse'
              value={formData.verse || ''}
              onChange={handleChange}
              required
              style={inputStyles}
            />

            <label style={labelStyles}>Number of Readings</label>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button
                type='button'
                style={incrementButtonStyles}
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    number_of_readings: Math.max(
                      prev.number_of_readings - 1,
                      0
                    ),
                  }))
                }
              >
                -
              </button>
              <input
                name='number_of_readings'
                value={formData.number_of_readings}
                readOnly
                style={{ ...inputStyles, width: '50px', textAlign: 'center' }}
              />
              <button
                type='button'
                style={incrementButtonStyles}
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    number_of_readings: prev.number_of_readings + 1,
                  }))
                }
              >
                +
              </button>
            </div>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                ...labelStyles,
                display: 'flex',
                alignItems: 'center',
                marginTop: '10px',
                marginBottom: '10px',
              }}
            >
              Complete Memorization
              <input
                type='checkbox'
                name='complete_memorization'
                style={{ width: '24px', height: '24px' }}
                checked={formData.complete_memorization}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    complete_memorization: e.target.checked,
                  })
                }
              />
            </label>

            <label style={labelStyles}>Murajaah 20 Times</label>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button
                type='button'
                style={incrementButtonStyles}
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    murajaah_20_times: Math.max(prev.murajaah_20_times - 1, 0),
                  }))
                }
              >
                -
              </button>
              <input
                name='murajaah_20_times'
                value={formData.murajaah_20_times}
                readOnly
                style={{ ...inputStyles, width: '50px', textAlign: 'center' }}
              />
              <button
                type='button'
                style={incrementButtonStyles}
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    murajaah_20_times: Math.min(prev.murajaah_20_times + 1, 20),
                  }))
                }
              >
                +
              </button>
            </div>
          </div>
          <button type='submit' style={submitButtonStyles}>
            Submit
          </button>
        </form>

        <button onClick={onClose} style={closeButtonStyles}>
          Close
        </button>
      </div>
    </div>
  )
}
const mediaQuery = '@media (max-width: 500px)'

const incrementButtonStyles = {
  padding: '10px 20px',
  fontSize: '20px',
  margin: '0 5px',
  backgroundColor: '#84a59d',
  color: 'white',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer',
  transition: '0.3s',
  '&:hover': {
    backgroundColor: '#6b8d85',
  },
  [mediaQuery]: {
    fontSize: '18px',
    padding: '8px 16px',
  },
}

const labelStyles = {
  fontWeight: 'bold',
  marginBottom: '5px',
  display: 'block',
  [mediaQuery]: {
    fontSize: '14px',
  },
}

const viewVerseButtonStyles = {
  marginTop: '10px',
  marginBottom: '20px', 
  padding: '10px 15px',
  backgroundColor: '#84a59d', 
  color: 'white',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer',
  fontWeight: 'bold',
  [mediaQuery]: {
    fontSize: '14px',
    padding: '8px 12px',
  },
}

const modalStyles = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
}

const modalContentStyles = {
  width: '70%',
  maxWidth: '500px',
  maxHeight: '80vh',
  overflowY: 'auto',
  backgroundColor: '#fff',
  padding: '20px',
  borderRadius: '8px',
  boxSizing: 'border-box',
  [mediaQuery]: {
    width: '90%',
  },
}

const formStyles = {
  display: 'flex',
  flexDirection: 'column',
}

const inputStyles = {
  padding: '10px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  width: '80%',
  margin: '10px',
  [mediaQuery]: {
    fontSize: '14px',
    padding: '8px',
    width: '100%',
  },
}

const checkboxLabelStyles = {
  display: 'block',
  marginBottom: '10px',
}

const closeButtonStyles = {
  marginTop: '20px',
  padding: '10px',
  backgroundColor: '#84a59d',
  border: 'none',
  color: 'white',
  borderRadius: '5px',
  cursor: 'pointer',
  [mediaQuery]: {
    fontSize: '14px',
    padding: '8px',
  },
}

const submitButtonStyles = {
  marginTop: '20px',
  padding: '10px',
  backgroundColor: '#84a59d',
  border: 'none',
  color: 'white',
  borderRadius: '5px',
  cursor: 'pointer',
  [mediaQuery]: {
    fontSize: '14px',
    padding: '8px',
  },
}

export default SabaqModal
