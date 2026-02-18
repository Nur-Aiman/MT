import React, { useState, useEffect } from 'react'
import { HOST } from '../api'

function AddSurahModal({ isOpen, onClose, onSurahAdded, initialData, userId }) {
  const [formData, setFormData] = useState({
    id: '',
    parent_id: null,
    chapter_name: '',
    total_verse: '',
    verse_memorized: '',
    juz: '',
    note: '',
  })
  const [isSuccess, setIsSuccess] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isSubsectionMode, setIsSubsectionMode] = useState(false)
  const [allSurahs, setAllSurahs] = useState([])

  useEffect(() => {
    if (initialData) {
      setFormData({
        id: initialData.id || '',
        parent_id: initialData.parent_id || null,
        chapter_name: initialData.chapter_name || '',
        total_verse: initialData.total_verse || '',
        verse_memorized: initialData.verse_memorized || '',
        juz: initialData.juz || '',
        note: initialData.note || '',
      })
      // If initialData has parent_id and we have subsections available, we're in edit mode
      setIsEditMode(true)
      setIsSubsectionMode(!!initialData.parent_id)
    } else {
      setIsEditMode(false)
      setIsSubsectionMode(false)
      resetFormData()
    }
  }, [initialData])

  // Fetch all surahs to calculate next subsection ID
  useEffect(() => {
    if (!userId || !isOpen) return
    
    fetch(`${HOST}/murajaah/getmemorizedsurah`, {
      headers: { 'x-user-id': String(userId) },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAllSurahs(data)
        }
      })
      .catch((error) => console.error('Failed to fetch surahs:', error))
  }, [isOpen, userId])

  const resetFormData = () => {
    setFormData({
      id: '',
      parent_id: null,
      chapter_name: '',
      total_verse: '',
      verse_memorized: '',
      juz: '',
      note: '',
    })
  }

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

  // ✅ Generate next subsection ID based on parent
  const generateNextSubsectionId = (parentId) => {
    if (!parentId) return null
    
    // Find all subsections of this parent
    const parentSubsections = allSurahs.filter(
      (s) => Number(s.parent_id) === Number(parentId)
    )
    
    if (parentSubsections.length === 0) {
      return parseFloat(parentId) + 0.1
    }
    
    // Get the highest subsection number
    const maxSubsection = Math.max(
      ...parentSubsections.map((s) => parseFloat(s.id))
    )
    
    return Math.round((maxSubsection + 0.1) * 10) / 10
  }

  const handleToggleMode = () => {
    if (isEditMode) return // Don't allow mode toggle in edit mode
    
    if (!isSubsectionMode) {
      // Switching to subsection mode - prompt for parent surah
      const parentId = prompt('Enter parent surah ID (e.g., 2 for Al-Baqarah):')
      if (parentId) {
        const nextId = generateNextSubsectionId(parseFloat(parentId))
        setFormData((prev) => ({
          ...prev,
          parent_id: parseFloat(parentId),
          id: String(nextId),
          juz: parseFloat(parentId), // Subsections inherit parent's juz
        }))
        setIsSubsectionMode(true)
      }
    } else {
      // Switching back to normal mode
      resetFormData()
      setIsSubsectionMode(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!userId) {
      alert('User not logged in. Please login again.')
      return
    }

    // Validation
    if (isSubsectionMode && !formData.parent_id) {
      alert('Parent Surah ID is required for subsections')
      return
    }

    const endpoint = isEditMode
      ? `${HOST}/murajaah/updatesurah/${formData.id}`
      : `${HOST}/murajaah/addsurah`
    const method = isEditMode ? 'PUT' : 'POST'

    const payload = {
      ...formData,
      user_id: userId,
      id: parseFloat(formData.id), // Ensure ID is numeric
      parent_id: formData.parent_id ? parseFloat(formData.parent_id) : null,
    }

    fetch(endpoint, {
      method,
      headers: withUserHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
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

    if (window.confirm(`Are you sure you want to delete ${formData.chapter_name}?`)) {
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
          console.log('Deletion completed:', data?.message)
          onClose()
          onSurahAdded()
        })
        .catch((error) => console.error('An error occurred:', error))
    }
  }

  const handleSuccessClose = () => {
    setIsSuccess(false)
    resetFormData()
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
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fafbfc',
          padding: '28px',
          borderRadius: '14px',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
          zIndex: 1001,
          position: 'relative',
          fontFamily: 'Merriweather, serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #6fa599', paddingBottom: '14px', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: '#3a8a7d', fontFamily: 'Merriweather, serif', fontSize: '22px', fontWeight: 600 }}>
            {isEditMode 
              ? `Edit ${formData.parent_id ? 'Subsection' : 'Surah'}`
              : `Add ${isSubsectionMode ? 'Subsection' : 'Surah'}`
            }
          </h3>
          {!isEditMode && (
            <button
              onClick={handleToggleMode}
              style={{
                padding: '8px 14px',
                backgroundColor: '#6fa599',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                transition: 'background-color 0.3s',
              }}
            >
              {isSubsectionMode ? 'Add Surah Instead' : 'Add Subsection'}
            </button>
          )}
        </div>

        {isSuccess ? (
          <div style={successContainerStyle}>
            <i style={iconStyle}>✓</i>
            <h4 style={messageHeadingStyle}>
              {formData.chapter_name} successfully {isEditMode ? 'updated' : 'added'}!
            </h4>
            <div style={detailsContainerStyle}>
              <div>
                <strong>ID:</strong> {formData.id}
              </div>
              {formData.parent_id && (
                <div>
                  <strong>Parent ID:</strong> {formData.parent_id}
                </div>
              )}
              <div>
                <strong>Chapter Name:</strong> {formData.chapter_name}
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
              {formData.note && (
                <div>
                  <strong>Note:</strong> {formData.note}
                </div>
              )}
            </div>
            <button style={buttonStyle} type="button" onClick={handleSuccessClose}>
              OK
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {isSubsectionMode && formData.parent_id && (
              <div style={{ backgroundColor: '#e8f4f8', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>
                <strong>Parent Surah ID:</strong> {formData.parent_id}
                <br />
                {/* <strong>Next Subsection ID:</strong> {formData.id} */}
              </div>
            )}

            {[
              { name: 'id', label: isSubsectionMode ? 'Subsection ID' : 'Chapter Number', type: 'number', step: '0.1', readOnly: isSubsectionMode },
              { name: 'chapter_name', label: 'Chapter Name', type: 'text' },
              { name: 'total_verse', label: 'Total Verses', type: 'number' },
              { name: 'verse_memorized', label: 'Verses Memorized', type: 'number' },
              { name: 'juz', label: 'Juz', type: 'number', readOnly: isSubsectionMode },
              { name: 'note', label: 'Note (optional)', type: 'text' },
            ].map((field) => (
              <label key={field.name} style={{ display: 'block', marginBottom: '16px' }}>
                <span style={{ fontWeight: 600, color: '#2d5a55', display: 'block', marginBottom: '6px', fontFamily: 'Merriweather, serif' }}>{field.label}</span>
                <input
                  type={field.type}
                  name={field.name}
                  value={formData[field.name]}
                  onChange={handleInputChange}
                  step={field.step}
                  readOnly={field.readOnly}
                  required={field.name !== 'note'}
                  style={{
                    width: '100%',
                    padding: '11px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d0d4d9',
                    boxSizing: 'border-box',
                    backgroundColor: field.readOnly ? '#f0f4f3' : '#fff',
                    cursor: field.readOnly ? 'not-allowed' : 'text',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#6fa599'}
                  onBlur={(e) => e.target.style.borderColor = '#d0d4d9'}
                />
              </label>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
              <button style={buttonStyle} type="submit">
                {isEditMode ? 'Update' : 'Add'}
              </button>

              <button style={buttonStyle} type="button" onClick={onClose}>
                Cancel
              </button>

              {isEditMode && (
                <button style={deleteButtonStyle} type="button" onClick={handleDeleteSurah}>
                  Delete
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
  padding: '11px 18px',
  backgroundColor: '#e63946',
  color: '#fff',
  borderRadius: '6px',
  border: 'none',
  cursor: 'pointer',
  transition: 'background-color 0.3s',
  marginLeft: '10px',
  fontWeight: 600,
  fontFamily: 'Merriweather, serif',
}

const buttonStyle = {
  padding: '11px 18px',
  backgroundColor: '#3a8a7d',
  color: '#fff',
  borderRadius: '6px',
  border: 'none',
  cursor: 'pointer',
  transition: 'background-color 0.3s',
  fontWeight: 600,
  fontFamily: 'Merriweather, serif',
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
