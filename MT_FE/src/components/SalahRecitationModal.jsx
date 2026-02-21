import React, { useEffect, useMemo, useRef, useState } from 'react'
import { HOST } from '../api'
import './SalahRecitationModal.css'

const PRAYER_SLOTS = [
  { prayer: 'Fajr', rakaat: 1 },
  { prayer: 'Fajr', rakaat: 2 },
  { prayer: 'Dhuhr', rakaat: 1 },
  { prayer: 'Dhuhr', rakaat: 2 },
  { prayer: 'Asr', rakaat: 1 },
  { prayer: 'Asr', rakaat: 2 },
  { prayer: 'Maghrib', rakaat: 1 },
  { prayer: 'Maghrib', rakaat: 2 },
  { prayer: 'Isha', rakaat: 1 },
  { prayer: 'Isha', rakaat: 2 },
]

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const normalizeSurahId = (id) => {
  const numericId = Number(id)
  return Number.isFinite(numericId) ? String(numericId) : String(id)
}

const getRecitableVerseCount = (surah) => {
  const verseMemorized = toNumber(surah.verse_memorized, 0)
  if (verseMemorized > 0) return verseMemorized
  return toNumber(surah.total_verse, 0)
}

const getLeastReviewedSnapshotKey = (userId, date) => `salah_recitation_order:${userId}:${date}`

function SalahRecitationModal({
  isOpen,
  onClose,
  surahs = [],
  checkedSurahs = {},
  date,
  userId,
  onMurajaahUpdated,
}) {
  const [orderMode, setOrderMode] = useState('least_reviewed')
  const [rotationOffset, setRotationOffset] = useState(0)
  const [countOverrides, setCountOverrides] = useState({})
  const [savingById, setSavingById] = useState({})
  const [locallyCheckedById, setLocallyCheckedById] = useState({})
  const [hasPendingMurajaahUpdate, setHasPendingMurajaahUpdate] = useState(false)
  const [leastReviewedOrder, setLeastReviewedOrder] = useState([])
  const inFlightCheckRef = useRef({})
  const effectiveDate = date || new Date().toISOString().slice(0, 10)

  const normalizedCheckedSurahs = useMemo(() => {
    const normalized = {}
    Object.entries(checkedSurahs || {}).forEach(([id, isChecked]) => {
      normalized[normalizeSurahId(id)] = !!isChecked
    })
    return normalized
  }, [checkedSurahs])

  useEffect(() => {
    if (!isOpen) return
    setRotationOffset(0)
    setCountOverrides({})
    setSavingById({})
    setLocallyCheckedById({})
    setHasPendingMurajaahUpdate(false)
  }, [isOpen])

  useEffect(() => {
    if (isOpen || !hasPendingMurajaahUpdate || typeof onMurajaahUpdated !== 'function') return
    onMurajaahUpdated()
    setHasPendingMurajaahUpdate(false)
  }, [isOpen, hasPendingMurajaahUpdate, onMurajaahUpdated])

  const withUserHeaders = (headers = {}) => ({
    ...headers,
    'x-user-id': String(userId),
  })

  const baselineMurajaahCountById = useMemo(() => {
    const map = new Map()
    surahs.forEach((surah) => {
      map.set(normalizeSurahId(surah.id), toNumber(surah.murajaah_counter, 0))
    })
    return map
  }, [surahs])

  const memorizedSurahs = useMemo(() => {
    if (!Array.isArray(surahs)) return []
    const uniqueById = Array.from(
      new Map(surahs.map((surah) => [normalizeSurahId(surah.id), surah])).values()
    )
    return uniqueById.filter((surah) => getRecitableVerseCount(surah) > 0)
  }, [surahs])

  const baselineLeastReviewedSurahs = useMemo(
    () =>
      [...memorizedSurahs].sort((a, b) => {
        const aCount = baselineMurajaahCountById.get(normalizeSurahId(a.id)) ?? 0
        const bCount = baselineMurajaahCountById.get(normalizeSurahId(b.id)) ?? 0
        const counterDelta = aCount - bCount
        if (counterDelta !== 0) return counterDelta
        return toNumber(a.id) - toNumber(b.id)
      }),
    [memorizedSurahs, baselineMurajaahCountById]
  )

  useEffect(() => {
    if (!isOpen || !userId) return

    const currentIds = baselineLeastReviewedSurahs.map((surah) => normalizeSurahId(surah.id))
    const currentIdSet = new Set(currentIds)
    const snapshotKey = getLeastReviewedSnapshotKey(userId, effectiveDate)
    let storedIds = []

    try {
      const parsed = JSON.parse(localStorage.getItem(snapshotKey) || '[]')
      if (Array.isArray(parsed)) {
        storedIds = parsed.map((id) => normalizeSurahId(id)).filter((id) => currentIdSet.has(id))
      }
    } catch {
      storedIds = []
    }

    const storedIdSet = new Set(storedIds)
    const missingIds = currentIds.filter((id) => !storedIdSet.has(id))
    const finalOrder = [...storedIds, ...missingIds]

    setLeastReviewedOrder(finalOrder)

    try {
      localStorage.setItem(snapshotKey, JSON.stringify(finalOrder))
    } catch (error) {
      console.error('Unable to persist Salah Recitation order snapshot:', error)
    }
  }, [isOpen, userId, effectiveDate, baselineLeastReviewedSurahs])

  const getMurajaahCount = (surah) => {
    const idKey = normalizeSurahId(surah.id)
    if (Object.prototype.hasOwnProperty.call(countOverrides, idKey)) {
      return toNumber(countOverrides[idKey], 0)
    }
    return baselineMurajaahCountById.get(idKey) ?? 0
  }

  const isCheckedToday = (surahId) => {
    const idKey = normalizeSurahId(surahId)
    return !!normalizedCheckedSurahs[idKey] || !!locallyCheckedById[idKey]
  }

  const recitableSurahs = useMemo(() => {
    if (!memorizedSurahs.length) return []

    if (orderMode === 'surah_order') {
      return [...memorizedSurahs].sort((a, b) => toNumber(a.id) - toNumber(b.id))
    }

    if (!leastReviewedOrder.length) {
      return baselineLeastReviewedSurahs
    }

    const orderIndexById = new Map(leastReviewedOrder.map((id, index) => [id, index]))

    return [...memorizedSurahs].sort((a, b) => {
      const aId = normalizeSurahId(a.id)
      const bId = normalizeSurahId(b.id)
      const aIndex = orderIndexById.get(aId)
      const bIndex = orderIndexById.get(bId)

      if (aIndex != null && bIndex != null && aIndex !== bIndex) return aIndex - bIndex
      if (aIndex != null && bIndex == null) return -1
      if (aIndex == null && bIndex != null) return 1
      return toNumber(a.id) - toNumber(b.id)
    })
  }, [memorizedSurahs, orderMode, leastReviewedOrder, baselineLeastReviewedSurahs])

  const assignmentPlan = useMemo(() => {
    if (!recitableSurahs.length) return []

    const startIndex =
      ((rotationOffset % recitableSurahs.length) + recitableSurahs.length) % recitableSurahs.length

    return PRAYER_SLOTS.map((slot, idx) => {
      const surah = recitableSurahs[(startIndex + idx) % recitableSurahs.length]
      return {
        ...slot,
        surah,
      }
    })
  }, [recitableSurahs, rotationOffset])

  const handleMurajaahCheck = async (surahId) => {
    if (!userId) return

    const idKey = normalizeSurahId(surahId)
    if (isCheckedToday(surahId) || savingById[idKey] || inFlightCheckRef.current[idKey]) return
    inFlightCheckRef.current[idKey] = true

    setSavingById((prev) => ({ ...prev, [idKey]: true }))
    try {
      const progressResponse = await fetch(`${HOST}/murajaah/getmurajaahprogress?date=${effectiveDate}`, {
        headers: withUserHeaders(),
      })
      const progressData = await progressResponse.json().catch(() => [])

      const checkedIdsFromDb = Array.isArray(progressData)
        ? progressData.reduce((arr, row) => arr.concat(row.surah_id || []), [])
        : []
      const alreadyCheckedInDb = checkedIdsFromDb.some(
        (checkedId) => normalizeSurahId(checkedId) === idKey
      )

      if (alreadyCheckedInDb) {
        setLocallyCheckedById((prev) => ({ ...prev, [idKey]: true }))
        return
      }

      const response = await fetch(`${HOST}/murajaah/addmurajaah`, {
        method: 'POST',
        headers: withUserHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ surah_id: surahId }),
      })

      if (!response.ok) {
        throw new Error('Failed to update murajaah count')
      }

      const payload = await response.json().catch(() => ({}))
      if (payload?.already_marked) {
        setLocallyCheckedById((prev) => ({ ...prev, [idKey]: true }))
        return
      }

      setCountOverrides((prev) => {
        const currentValue = Object.prototype.hasOwnProperty.call(prev, idKey)
          ? toNumber(prev[idKey], 0)
          : baselineMurajaahCountById.get(idKey) ?? 0
        return { ...prev, [idKey]: currentValue + 1 }
      })

      setLocallyCheckedById((prev) => ({ ...prev, [idKey]: true }))
      setHasPendingMurajaahUpdate(true)
    } catch (error) {
      console.error('Error updating murajaah from Salah Recitation:', error)
    } finally {
      setSavingById((prev) => ({ ...prev, [idKey]: false }))
      delete inFlightCheckRef.current[idKey]
    }
  }

  if (!isOpen) return null

  return (
    <div className="salah-modal-overlay" onClick={onClose}>
      <div className="salah-modal-content" onClick={(event) => event.stopPropagation()}>
        <div className="salah-modal-header">
          <h2 className="salah-modal-title">Salah Recitation</h2>
          <button className="salah-modal-close" onClick={onClose} aria-label="Close">
            x
          </button>
        </div>

        <div className="salah-modal-body">
          {/* <p className="salah-modal-subtitle">
            Suggested recitation after Al-Fatihah for the first 2 rakaat of each fard prayer.
          </p> */}

          <div className="salah-controls">
            <label className="salah-control-label" htmlFor="salah-order">
              Order
            </label>
            <select
              id="salah-order"
              className="salah-control-select"
              value={orderMode}
              onChange={(event) => {
                setOrderMode(event.target.value)
                setRotationOffset(0)
              }}
            >
              <option value="least_reviewed">Least revised first</option>
              <option value="surah_order">Surah order</option>
            </select>
          </div>

          {recitableSurahs.length > 0 ? (
            <>
              {/* <div className="salah-summary">
                Using {recitableSurahs.length} memorized surah entries, sorted by murajaah count from lowest to
                highest.
              </div> */}
              <div className="salah-plan-table-wrapper">
                <table className="salah-plan-table">
                  <thead>
                    <tr>
                      <th>Prayer</th>
                      <th>Recitation</th>
                      <th>Murajaah Count</th>
                      <th>Murajaah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignmentPlan.map((item, index) => {
                      const isDoneToday = isCheckedToday(item.surah.id)
                      const isSaving = !!savingById[normalizeSurahId(item.surah.id)]

                      return (
                        <tr key={`${item.prayer}-${item.rakaat}-${index}`}>
                          <td>{`${item.prayer}-R${item.rakaat}`}</td>
                          <td>
                            {item.surah.chapter_name} ({item.surah.id})
                          </td>
                          <td>{getMurajaahCount(item.surah)}</td>
                          <td>
                            <button
                              type="button"
                              className={`salah-murajaah-btn ${isDoneToday ? 'checked' : ''}`}
                              onClick={() => handleMurajaahCheck(item.surah.id)}
                              disabled={isSaving || !userId || isDoneToday}
                              aria-label={`Mark murajaah for ${item.surah.chapter_name}`}
                            >
                              {isSaving ? (
                                '...'
                              ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                              )}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="salah-empty-state">
              No memorized verses found yet. Update your memorized surah list first, then open this planner
              again.
            </div>
          )}
        </div>

        <div className="salah-modal-footer">
          <button type="button" className="salah-close-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default SalahRecitationModal
