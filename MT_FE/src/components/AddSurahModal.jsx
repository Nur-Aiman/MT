import React, { useState, useEffect } from 'react'
import { HOST } from '../api'

function AddSurahModal({ isOpen, onClose, onSurahAdded, initialData, userId }) {
  const [formData, setFormData] = useState({
    id: '',
    chapter_name: '',
    total_verse: '',
    verse_memorized: '',
    juz: '',
    note: '',
  })
  const [isSuccess, setIsSuccess] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)

  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
      setIsEditMode(true)
    } else {
      setIsEditMode(false)
    }
  }, [initialData])

  const withUserHeaders = (headers = {}) => ({
    ...headers,
    'x-user-id': String(userId),
  })

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!userId) {
      alert('User not logged in. Please login again.')
      return
    }

    const endpoint = isEditMode
      ? `${HOST}/murajaah/updatesurah/${formData.id}`
      : `${HOST}/murajaah/addsurah`
    const method = isEditMode ? 'PUT' : 'POST'

    // optional: also include user_id in body (backend accepts it too)
    const payload = { ...formData, user_id: userId }

    fetch(endpoint, {
      method,
      headers: withUserHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        // your endpoints return json (addsurah/updatesurah) in your controller
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.message || 'Request failed')
        return data
      })
      .then((data) => {
        console.log('Surah action completed:', data?.message)
        setIsSuccess(true)
      })
      .catch((error) => console.error('An error occurred:', error))
  }

  const handleDeleteSurah = () => {
    if (!userId) {
      alert('User not logged in. Please login again.')
      return
    }

    if (window.confirm(`Are you sure you want to delete surah ${formData.chapter_name}?`)) {
      fetch(`${HOST}/murajaah/deletesurah/${formData.id}`, {
        method: 'DELETE',
        headers: withUserHeaders(),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => null)
          if (!res.ok) throw new Error(data?.message || 'Delete failed')
          return data
        })
        .then((data) => {
          console.log('Surah deletion completed:', data?.message)
          onClose()
          onSurahAdded()
        })
        .catch((error) => console.error('An error occurred:', error))
    }
  }

  const handleSuccessClose = () => {
    setIsSuccess(false)
    setFormData({
      id: '',
      chapter_name: '',
      total_verse: '',
      verse_memorized: '',
      juz: '',
      note: '',
    })
    onClose()
    onSurahAdded()
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        transition: 'opacity 0.3s',
      }}
    >
      <div
        style={{
          backgroundColor: '#f7f8fa',
          padding: '20px',
          borderRadius: '12px',
          width: '80%',
          boxShadow: '0px 4px 15px rgba(0, 0, 0, 0.1)',
        }}
      >
        <h3 style={{ borderBottom: '1px solid #e1e4e8', paddingBottom: '10px' }}>
          {isEditMode ? 'Edit Surah' : 'Add Surah'}
        </h3>

        {isSuccess ? (
          <div style={successContainerStyle}>
            <i style={iconStyle}>✓</i>
            <h4 style={messageHeadingStyle}>
              Surah successfully {isEditMode ? 'edited' : 'added'}!
            </h4>
            <div style={detailsContainerStyle}>
              <div>
                <strong>Chapter Number:</strong> {formData.id}
              </div>
              <div>
                <strong>Chapter Name:</strong> {formData.chapter_name}
              </div>
              <div>
                <strong>Note:</strong> {formData.note}
              </div>
              <div>
                <strong>Total Verses:</strong> {formData.total_verse}
              </div>
              <div>
                <strong>Verses Memorized:</strong> {formData.verse_memorized}
              </div>
              <div>
                <strong>Juz:</strong> {formData.juz}
              </div>
            </div>
            <button style={buttonStyle} type="button" onClick={handleSuccessClose}>
              OK
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {[
              { name: 'id', label: 'Chapter Number', type: 'number' },
              { name: 'chapter_name', label: 'Chapter Name', type: 'text' },
              { name: 'note', label: 'Note', type: 'text' },
              { name: 'total_verse', label: 'Total Verses', type: 'number' },
              { name: 'verse_memorized', label: 'Verses Memorized', type: 'number' },
              { name: 'juz', label: 'Juz', type: 'number' },
            ].map((field) => (
              <label key={field.name} style={{ display: 'block', marginBottom: '15px' }}>
                {field.label}:{' '}
                <input
                  type={field.type}
                  name={field.name}
                  value={formData[field.name]}
                  onChange={handleInputChange}
                  required={field.name !== 'note'}
                  style={{
                    width: '95%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #e1e4e8',
                    marginTop: '5px',
                  }}
                />
              </label>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button style={buttonStyle} type="submit">
                {isEditMode ? 'Update Surah' : 'Add Surah'}
              </button>

              <button style={buttonStyle} type="button" onClick={onClose}>
                Cancel
              </button>

              {isEditMode && (
                <button style={deleteButtonStyle} type="button" onClick={handleDeleteSurah}>
                  Delete Surah
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

const deleteButtonStyle = {
  padding: '10px 15px',
  backgroundColor: '#d73a49',
  color: '#fff',
  borderRadius: '4px',
  border: 'none',
  cursor: 'pointer',
  transition: 'background-color 0.3s',
  ':hover': { backgroundColor: '#b31a28' },
  marginLeft: '10px',
}

const buttonStyle = {
  padding: '10px 15px',
  backgroundColor: '#0366d6',
  color: '#fff',
  borderRadius: '4px',
  border: 'none',
  cursor: 'pointer',
  transition: 'background-color 0.3s',
  ':hover': { backgroundColor: '#0050a0' },
}

const successContainerStyle = {
  backgroundColor: '#e6f7ff',
  padding: '20px',
  borderRadius: '8px',
  textAlign: 'center',
}

const iconStyle = {
  fontSize: '50px',
  color: '#4CAF50',
  marginBottom: '20px',
}

const messageHeadingStyle = {
  fontSize: '24px',
  margin: '10px 0',
  color: '#333',
}

const detailsContainerStyle = {
  backgroundColor: '#ffffff',
  padding: '15px',
  borderRadius: '8px',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  margin: '20px 0',
}

export default AddSurahModal
