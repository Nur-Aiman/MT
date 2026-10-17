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
const YOUTUBE_IFRAME_API_URL = 'https://www.youtube.com/iframe_api'
const GAPLESS_INITIAL_SEGMENTS = 4
const GAPLESS_SCHEDULE_AHEAD_SECONDS = 30
const GAPLESS_CROSSFADE_SECONDS = 0.018
const GAPLESS_SILENCE_THRESHOLD = 0.003
const GAPLESS_EDGE_PADDING_SECONDS = 0.018

let youtubeIframeApiPromise = null

const getYouTubeVideoId = (value) => {
  const normalized = String(value ?? '').trim()
  if (!normalized) return null

  try {
    const url = new URL(normalized)
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '')
    const pathParts = url.pathname.split('/').filter(Boolean)
    let videoId = null

    if (hostname === 'youtu.be') {
      videoId = pathParts[0]
    } else if (
      hostname === 'youtube.com' ||
      hostname.endsWith('.youtube.com') ||
      hostname === 'youtube-nocookie.com' ||
      hostname.endsWith('.youtube-nocookie.com')
    ) {
      if (url.pathname === '/watch') {
        videoId = url.searchParams.get('v')
      } else if (['embed', 'shorts', 'live', 'v'].includes(pathParts[0])) {
        videoId = pathParts[1]
      }
    }

    return /^[A-Za-z0-9_-]{11}$/.test(videoId || '') ? videoId : null
  } catch {
    return null
  }
}

const getTrimmedAudioRegion = (buffer) => {
  const channelData = Array.from(
    { length: buffer.numberOfChannels },
    (_, channel) => buffer.getChannelData(channel)
  )
  const blockSize = 128
  const hasAudioInRange = (start, end) => {
    for (const samples of channelData) {
      for (let index = start; index < end; index += 1) {
        if (Math.abs(samples[index]) >= GAPLESS_SILENCE_THRESHOLD) return true
      }
    }
    return false
  }

  let firstAudioBlock = -1
  for (let start = 0; start < buffer.length; start += blockSize) {
    if (hasAudioInRange(start, Math.min(buffer.length, start + blockSize))) {
      firstAudioBlock = start
      break
    }
  }

  if (firstAudioBlock < 0) {
    return { buffer, offset: 0, duration: buffer.duration }
  }

  let lastAudioBlock = firstAudioBlock
  for (let end = buffer.length; end > firstAudioBlock; end -= blockSize) {
    const start = Math.max(firstAudioBlock, end - blockSize)
    if (hasAudioInRange(start, end)) {
      lastAudioBlock = start
      break
    }
  }

  let firstFrame = firstAudioBlock
  const firstBlockEnd = Math.min(buffer.length, firstAudioBlock + blockSize)
  while (firstFrame < firstBlockEnd && !hasAudioInRange(firstFrame, firstFrame + 1)) {
    firstFrame += 1
  }

  let lastFrame = Math.min(buffer.length - 1, lastAudioBlock + blockSize - 1)
  while (lastFrame > firstFrame && !hasAudioInRange(lastFrame, lastFrame + 1)) {
    lastFrame -= 1
  }

  const paddingFrames = Math.floor(buffer.sampleRate * GAPLESS_EDGE_PADDING_SECONDS)
  const startFrame = Math.max(0, firstFrame - paddingFrames)
  const endFrame = Math.min(buffer.length, lastFrame + paddingFrames + 1)
  const duration = (endFrame - startFrame) / buffer.sampleRate

  if (duration < 0.1) {
    return { buffer, offset: 0, duration: buffer.duration }
  }

  return {
    buffer,
    offset: startFrame / buffer.sampleRate,
    duration,
  }
}

const loadYouTubeIframeApi = () => {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (youtubeIframeApiPromise) return youtubeIframeApiPromise

  youtubeIframeApiPromise = new Promise((resolve, reject) => {
    let settled = false
    const existingReadyHandler = window.onYouTubeIframeAPIReady
    const timeoutId = window.setTimeout(() => {
      if (settled) return
      settled = true
      youtubeIframeApiPromise = null
      reject(new Error('YouTube player took too long to load'))
    }, 15000)

    window.onYouTubeIframeAPIReady = () => {
      if (typeof existingReadyHandler === 'function') existingReadyHandler()
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      resolve(window.YT)
    }

    let script = document.querySelector(`script[src='${YOUTUBE_IFRAME_API_URL}']`)
    if (!script) {
      script = document.createElement('script')
      script.src = YOUTUBE_IFRAME_API_URL
      script.async = true
      document.head.appendChild(script)
    }

    script.addEventListener(
      'error',
      () => {
        if (settled) return
        settled = true
        window.clearTimeout(timeoutId)
        youtubeIframeApiPromise = null
        reject(new Error('Unable to load the YouTube player'))
      },
      { once: true }
    )
  })

  return youtubeIframeApiPromise
}

function SurahList() {
  const [surahs, setSurahs] = useState([])
  const [surahsStatus, setSurahsStatus] = useState('loading')
  const [surahsError, setSurahsError] = useState('')
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
  const [expandedJuz, setExpandedJuz] = useState({})
  const [expandedParents, setExpandedParents] = useState({})
  const [activeAudioId, setActiveAudioId] = useState(null)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [isAudioRepeating, setIsAudioRepeating] = useState(false)
  const [loadingAudioId, setLoadingAudioId] = useState(null)
  const [audioError, setAudioError] = useState(null)
  const inFlightMurajaahRef = useRef({})
  const audioRefs = useRef([null, null])
  const activeAudioSlotRef = useRef(0)
  const audioPlaylistRef = useRef([])
  const currentAudioIndexRef = useRef(0)
  const audioRequestRef = useRef(0)
  const audioBySurahCacheRef = useRef(new Map())
  const audioPlaybackEngineRef = useRef(null)
  const gaplessCompletionHandlerRef = useRef(null)
  const gaplessErrorHandlerRef = useRef(null)
  const gaplessAudioRef = useRef({
    context: null,
    masterGain: null,
    sources: new Set(),
    abortControllers: new Set(),
    timer: null,
    generation: 0,
    busyGeneration: null,
    playlist: [],
    initialSegments: [],
    nextIndex: 0,
    nextStartTime: 0,
    finished: true,
  })
  const activeAudioIdRef = useRef(null)
  const activeAudioSourceRef = useRef(null)
  const activeYouTubeVideoIdRef = useRef(null)
  const youtubePlayerHostRef = useRef(null)
  const youtubePlayerRef = useRef(null)
  const youtubePlayerPromiseRef = useRef(null)
  const youtubeEndedHandlerRef = useRef(null)

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

  const getSurahAudioRange = (surah, siblingSurahs = []) => {
    const chapterNumber = Math.floor(Number(surah.parent_id || surah.id))
    let verseStart = 1
    let verseEnd = Number(surah.verse_memorized || 0)

    if (!surah.parent_id && surah.subsections?.length > 0) {
      const latestSubsection = surah.subsections[surah.subsections.length - 1]
      verseEnd = Number(latestSubsection.verse_memorized || 0)
    }

    if (surah.parent_id) {
      const subsectionIndex = siblingSurahs.findIndex(
        (item) => normalizeSurahId(item.id) === normalizeSurahId(surah.id)
      )

      if (subsectionIndex > 0) {
        verseStart = Number(siblingSurahs[subsectionIndex - 1].verse_memorized || 0) + 1
      }
    }

    verseStart = Math.floor(verseStart)
    verseEnd = Math.floor(verseEnd)

    if (
      !Number.isFinite(chapterNumber) ||
      !Number.isFinite(verseStart) ||
      !Number.isFinite(verseEnd) ||
      chapterNumber < 1 ||
      verseStart < 1 ||
      verseEnd < verseStart
    ) {
      return null
    }

    return { chapterNumber, verseStart, verseEnd }
  }

  const fetchSurahAudioPlaylist = async ({ chapterNumber, verseStart, verseEnd }) => {
    let ayahs = audioBySurahCacheRef.current.get(chapterNumber)

    if (!ayahs) {
      const response = await fetch(`https://staticquran.vercel.app/api/v1/surah/${chapterNumber}`)
      if (!response.ok) throw new Error('Unable to fetch recitation audio')

      const data = await response.json()
      ayahs = data?.data?.ayah
      if (!Array.isArray(ayahs)) throw new Error('Invalid recitation audio response')

      audioBySurahCacheRef.current.set(chapterNumber, ayahs)
    }

    const playlist = ayahs
      .filter((ayah) => {
        const verseNumber = Number(ayah.sequence?.surah)
        return verseNumber >= verseStart && verseNumber <= verseEnd
      })
      .map((ayah) => ayah.recitation?.audio)
      .filter(Boolean)

    if (playlist.length === 0) throw new Error('No recitation audio found for these verses')
    return playlist
  }

  const clearAudioElement = (audio) => {
    if (!audio) return
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  }

  const preloadAudioElement = (audio, url) => {
    if (!audio || !url) {
      clearAudioElement(audio)
      return
    }

    audio.src = url
    audio.preload = 'auto'
    audio.load()
  }

  const prepareAudioSlots = (playlist, startIndex = 0, activeSlot = 0) => {
    activeAudioSlotRef.current = activeSlot
    preloadAudioElement(audioRefs.current[activeSlot], playlist[startIndex])

    const bufferedSlot = activeSlot === 0 ? 1 : 0
    preloadAudioElement(audioRefs.current[bufferedSlot], playlist[startIndex + 1])
  }

  const ensureGaplessAudioContext = () => {
    const state = gaplessAudioRef.current
    if (state.context?.state === 'closed') {
      state.context = null
      state.masterGain = null
    }

    if (!state.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) throw new Error('Continuous audio is not supported by this browser')

      state.context = new AudioContextClass()
      state.masterGain = state.context.createGain()
      state.masterGain.connect(state.context.destination)
    }

    return state.context
  }

  const decodeGaplessSegment = async (url, context) => {
    const state = gaplessAudioRef.current
    const controller = new AbortController()
    state.abortControllers.add(controller)

    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) throw new Error('Unable to buffer recitation audio')

      const encodedAudio = await response.arrayBuffer()
      const buffer = await context.decodeAudioData(encodedAudio)
      return { url, ...getTrimmedAudioRegion(buffer) }
    } finally {
      state.abortControllers.delete(controller)
    }
  }

  const stopGaplessPlayback = ({ clearInitialSegments = false } = {}) => {
    const state = gaplessAudioRef.current
    state.generation += 1

    if (state.timer) {
      window.clearInterval(state.timer)
      state.timer = null
    }

    state.abortControllers.forEach((controller) => controller.abort())
    state.abortControllers.clear()

    const activeSources = [...state.sources]
    state.sources.clear()
    activeSources.forEach(({ source, gain }) => {
      source.onended = null
      try {
        source.stop()
      } catch {
        // A source that already ended cannot be stopped again.
      }
      source.disconnect()
      gain.disconnect()
    })

    state.busyGeneration = null
    state.playlist = []
    state.nextIndex = 0
    state.nextStartTime = 0
    state.finished = true
    if (clearInitialSegments) state.initialSegments = []
  }

  const scheduleGaplessSegment = (segment, index, generation) => {
    const state = gaplessAudioRef.current
    const context = state.context
    if (!context || generation !== state.generation) return

    const startTime = Math.max(state.nextStartTime, context.currentTime + 0.06)
    const endTime = startTime + segment.duration
    const fadeDuration = Math.min(0.008, segment.duration / 4)
    const source = context.createBufferSource()
    const segmentGain = context.createGain()
    const entry = { source, gain: segmentGain }

    source.buffer = segment.buffer
    source.connect(segmentGain)
    segmentGain.connect(state.masterGain)
    segmentGain.gain.setValueAtTime(0, startTime)
    segmentGain.gain.linearRampToValueAtTime(1, startTime + fadeDuration)
    segmentGain.gain.setValueAtTime(1, Math.max(startTime + fadeDuration, endTime - fadeDuration))
    segmentGain.gain.linearRampToValueAtTime(0, endTime)

    source.onended = () => {
      state.sources.delete(entry)
      source.disconnect()
      segmentGain.disconnect()

      if (
        generation === state.generation &&
        index === state.playlist.length - 1 &&
        state.nextIndex >= state.playlist.length
      ) {
        if (state.timer) {
          window.clearInterval(state.timer)
          state.timer = null
        }
        state.finished = true
        gaplessCompletionHandlerRef.current?.()
      }
    }

    state.sources.add(entry)
    source.start(startTime, segment.offset, segment.duration)
    state.nextStartTime = endTime - GAPLESS_CROSSFADE_SECONDS
  }

  const fillGaplessSchedule = async (generation) => {
    const state = gaplessAudioRef.current
    const context = state.context
    if (
      !context ||
      generation !== state.generation ||
      state.busyGeneration === generation
    ) {
      return
    }

    state.busyGeneration = generation
    try {
      while (
        generation === state.generation &&
        state.nextIndex < state.playlist.length &&
        state.nextStartTime < context.currentTime + GAPLESS_SCHEDULE_AHEAD_SECONDS
      ) {
        const index = state.nextIndex
        const segment = await decodeGaplessSegment(state.playlist[index], context)
        if (generation !== state.generation) return

        scheduleGaplessSegment(segment, index, generation)
        state.nextIndex = index + 1
      }
    } catch (error) {
      if (generation === state.generation) {
        gaplessErrorHandlerRef.current?.(error)
      }
    } finally {
      if (state.busyGeneration === generation) state.busyGeneration = null
    }
  }

  const startGaplessPlayback = async (playlist, requestId) => {
    const state = gaplessAudioRef.current
    const reusableInitialSegments = state.initialSegments
    stopGaplessPlayback()

    const generation = state.generation
    const context = ensureGaplessAudioContext()
    if (context.state === 'suspended') await context.resume()

    state.playlist = playlist
    state.finished = false
    const initialCount = Math.min(GAPLESS_INITIAL_SEGMENTS, playlist.length)
    const initialUrls = playlist.slice(0, initialCount)
    const canReuseInitialSegments =
      reusableInitialSegments.length === initialUrls.length &&
      reusableInitialSegments.every((segment, index) => segment.url === initialUrls[index])

    const initialSegments = canReuseInitialSegments
      ? reusableInitialSegments
      : await Promise.all(initialUrls.map((url) => decodeGaplessSegment(url, context)))

    if (
      generation !== state.generation ||
      requestId !== audioRequestRef.current
    ) {
      return false
    }

    state.initialSegments = initialSegments
    state.nextStartTime = context.currentTime + 0.08
    state.nextIndex = 0
    initialSegments.forEach((segment, index) => {
      scheduleGaplessSegment(segment, index, generation)
      state.nextIndex = index + 1
    })

    state.timer = window.setInterval(() => {
      fillGaplessSchedule(generation)
    }, 2000)
    fillGaplessSchedule(generation)
    return true
  }

  const stopYouTubePlayback = () => {
    try {
      youtubePlayerRef.current?.stopVideo()
    } catch {
      // The iframe may still be initializing. The request guard prevents it
      // from starting an older selection once initialization completes.
    }
  }

  const handleCloseAudioPlayer = () => {
    // Invalidate any pending playlist or YouTube request before clearing the
    // active selection so an older async request cannot restart playback.
    audioRequestRef.current += 1
    audioRefs.current.forEach(clearAudioElement)
    stopGaplessPlayback({ clearInitialSegments: true })
    stopYouTubePlayback()

    audioPlaylistRef.current = []
    currentAudioIndexRef.current = 0
    activeAudioSlotRef.current = 0
    audioPlaybackEngineRef.current = null
    activeAudioIdRef.current = null
    activeAudioSourceRef.current = null
    activeYouTubeVideoIdRef.current = null

    setActiveAudioId(null)
    setIsAudioPlaying(false)
    setIsAudioRepeating(false)
    setLoadingAudioId(null)
    setAudioError(null)
  }

  const getYouTubePlayer = async () => {
    if (youtubePlayerRef.current?.loadVideoById) return youtubePlayerRef.current
    if (youtubePlayerPromiseRef.current) return youtubePlayerPromiseRef.current

    youtubePlayerPromiseRef.current = (async () => {
      const YT = await loadYouTubeIframeApi()
      const host = youtubePlayerHostRef.current
      if (!host) throw new Error('YouTube player is unavailable')

      host.replaceChildren()
      const mount = document.createElement('div')
      host.appendChild(mount)

      return new Promise((resolve, reject) => {
        try {
          const player = new YT.Player(mount, {
            width: '1',
            height: '1',
            playerVars: {
              autoplay: 0,
              controls: 0,
              disablekb: 1,
              origin: window.location.origin,
              playsinline: 1,
              rel: 0,
            },
            events: {
              onReady: (event) => {
                youtubePlayerRef.current = event.target
                resolve(event.target)
              },
              onStateChange: (event) => {
                if (activeAudioSourceRef.current !== 'youtube') return

                const currentId = activeAudioIdRef.current
                if (event.data === YT.PlayerState.PLAYING) {
                  setLoadingAudioId(null)
                  setIsAudioPlaying(true)
                  setAudioError(null)
                } else if (
                  event.data === YT.PlayerState.PAUSED ||
                  event.data === YT.PlayerState.CUED
                ) {
                  setLoadingAudioId(null)
                  setIsAudioPlaying(false)
                } else if (event.data === YT.PlayerState.ENDED) {
                  setLoadingAudioId(null)
                  setIsAudioPlaying(false)
                  youtubeEndedHandlerRef.current?.()
                } else if (event.data === YT.PlayerState.BUFFERING && currentId) {
                  setLoadingAudioId(currentId)
                }
              },
              onError: (event) => {
                if (activeAudioSourceRef.current !== 'youtube') return

                const failedVideoId = event.target?.getVideoData?.().video_id
                if (
                  failedVideoId &&
                  activeYouTubeVideoIdRef.current &&
                  failedVideoId !== activeYouTubeVideoIdRef.current
                ) {
                  return
                }

                const failedId = activeAudioIdRef.current
                activeAudioIdRef.current = null
                activeAudioSourceRef.current = null
                activeYouTubeVideoIdRef.current = null
                audioPlaybackEngineRef.current = null
                setActiveAudioId(null)
                setLoadingAudioId(null)
                setIsAudioPlaying(false)
                setAudioError({
                  id: failedId,
                  message: 'This YouTube recitation cannot be played here.',
                })
              },
            },
          })

          youtubePlayerRef.current = player
        } catch (error) {
          reject(error)
        }
      })
    })()

    try {
      return await youtubePlayerPromiseRef.current
    } catch (error) {
      youtubePlayerPromiseRef.current = null
      youtubePlayerRef.current = null
      throw error
    }
  }

  const handleSurahAudioToggle = async (surah, siblingSurahs = []) => {
    const idKey = normalizeSurahId(surah.id)
    const range = getSurahAudioRange(surah, siblingSurahs)
    const favouriteYouTubeLink = String(surah.favourite_recitation_video ?? '').trim()
    const youtubeVideoId = getYouTubeVideoId(favouriteYouTubeLink)
    const selectedSource = youtubeVideoId ? 'youtube' : 'verses'
    const isSameSelection =
      activeAudioId === idKey &&
      activeAudioSourceRef.current === selectedSource &&
      (selectedSource !== 'youtube' || activeYouTubeVideoIdRef.current === youtubeVideoId)

    if (!range) return

    if (favouriteYouTubeLink && !youtubeVideoId) {
      audioRequestRef.current += 1
      audioRefs.current.forEach((audio) => audio?.pause())
      stopGaplessPlayback()
      stopYouTubePlayback()
      audioPlaybackEngineRef.current = null
      activeAudioIdRef.current = null
      activeAudioSourceRef.current = null
      activeYouTubeVideoIdRef.current = null
      setActiveAudioId(null)
      setIsAudioPlaying(false)
      setLoadingAudioId(null)
      setAudioError({
        id: idKey,
        message: 'Favourite recitation must link to a specific YouTube video.',
      })
      return
    }

    if (isSameSelection && loadingAudioId !== idKey) {
      if (selectedSource === 'youtube') {
        try {
          const player = await getYouTubePlayer()
          if (isAudioPlaying) {
            player.pauseVideo()
            setIsAudioPlaying(false)
          } else {
            if (player.getPlayerState?.() === window.YT?.PlayerState?.ENDED) {
              player.seekTo(0, true)
            }
            player.playVideo()
            setIsAudioPlaying(true)
            setAudioError(null)
          }
        } catch (error) {
          console.error('Unable to control YouTube recitation:', error)
          setAudioError({ id: idKey, message: 'Unable to play YouTube recitation.' })
        }
        return
      }

      if (audioPlaybackEngineRef.current === 'gapless') {
        const state = gaplessAudioRef.current
        const context = state.context
        if (!context) return

        try {
          if (isAudioPlaying) {
            await context.suspend()
            setIsAudioPlaying(false)
          } else if (state.finished) {
            setLoadingAudioId(idKey)
            const started = await startGaplessPlayback(
              audioPlaylistRef.current,
              audioRequestRef.current
            )
            if (started) {
              setIsAudioPlaying(true)
              setAudioError(null)
            }
            setLoadingAudioId(null)
          } else {
            await context.resume()
            setIsAudioPlaying(true)
            setAudioError(null)
          }
        } catch (error) {
          console.error('Unable to control continuous Surah audio:', error)
          setLoadingAudioId(null)
          setAudioError({ id: idKey, message: 'Unable to play audio. Try again.' })
        }
        return
      }

      const activeAudio = audioRefs.current[activeAudioSlotRef.current]
      if (!activeAudio) return

      if (isAudioPlaying) {
        activeAudio.pause()
        setIsAudioPlaying(false)
        return
      }

      if (activeAudio.ended && audioPlaylistRef.current.length > 0) {
        currentAudioIndexRef.current = 0
        prepareAudioSlots(
          audioPlaylistRef.current,
          0,
          activeAudioSlotRef.current
        )
      }

      try {
        await audioRefs.current[activeAudioSlotRef.current].play()
        setIsAudioPlaying(true)
        setAudioError(null)
      } catch (error) {
        console.error('Unable to resume Surah audio:', error)
        setAudioError({ id: idKey, message: 'Unable to play audio. Try again.' })
      }
      return
    }

    const requestId = audioRequestRef.current + 1
    audioRequestRef.current = requestId
    audioRefs.current.forEach((audio) => audio?.pause())
    stopGaplessPlayback()
    stopYouTubePlayback()
    audioPlaybackEngineRef.current = null
    activeAudioIdRef.current = idKey
    activeAudioSourceRef.current = selectedSource
    activeYouTubeVideoIdRef.current = youtubeVideoId
    setActiveAudioId(idKey)
    setIsAudioPlaying(false)
    setLoadingAudioId(idKey)
    setAudioError(null)

    if (selectedSource === 'youtube') {
      audioPlaybackEngineRef.current = 'youtube'
      audioPlaylistRef.current = []
      currentAudioIndexRef.current = 0

      try {
        const player = await getYouTubePlayer()
        if (requestId !== audioRequestRef.current) return

        player.loadVideoById(youtubeVideoId)
        player.playVideo()
        setIsAudioPlaying(true)
      } catch (error) {
        if (requestId !== audioRequestRef.current) return
        console.error('Unable to play YouTube recitation:', error)
        activeAudioIdRef.current = null
        activeAudioSourceRef.current = null
        activeYouTubeVideoIdRef.current = null
        audioPlaybackEngineRef.current = null
        setActiveAudioId(null)
        setIsAudioPlaying(false)
        setAudioError({
          id: idKey,
          message: error.message || 'Unable to play YouTube recitation.',
        })
      } finally {
        if (requestId === audioRequestRef.current) setLoadingAudioId(null)
      }
      return
    }

    try {
      const playlist = await fetchSurahAudioPlaylist(range)
      if (requestId !== audioRequestRef.current || !audioRefs.current[0]) return

      audioPlaylistRef.current = playlist
      currentAudioIndexRef.current = 0

      try {
        audioPlaybackEngineRef.current = 'gapless'
        const started = await startGaplessPlayback(playlist, requestId)
        if (requestId !== audioRequestRef.current) {
          stopGaplessPlayback()
          return
        }

        if (started) {
          audioPlaybackEngineRef.current = 'gapless'
          setIsAudioPlaying(true)
          return
        }
      } catch (gaplessError) {
        if (requestId !== audioRequestRef.current) return
        console.warn('Continuous audio unavailable; using compatibility playback:', gaplessError)
        audioPlaybackEngineRef.current = null
        stopGaplessPlayback()
      }

      audioPlaybackEngineRef.current = 'html'
      prepareAudioSlots(playlist)
      await audioRefs.current[0].play()

      if (requestId === audioRequestRef.current) {
        setIsAudioPlaying(true)
      }
    } catch (error) {
      if (requestId !== audioRequestRef.current) return
      console.error('Unable to play Surah audio:', error)
      audioRefs.current.forEach(clearAudioElement)
      audioPlaylistRef.current = []
      currentAudioIndexRef.current = 0
      activeAudioIdRef.current = null
      activeAudioSourceRef.current = null
      activeYouTubeVideoIdRef.current = null
      audioPlaybackEngineRef.current = null
      setActiveAudioId(null)
      setIsAudioPlaying(false)
      setAudioError({ id: idKey, message: error.message || 'Unable to play audio. Try again.' })
    } finally {
      if (requestId === audioRequestRef.current) {
        setLoadingAudioId(null)
      }
    }
  }

  const handleSurahAudioEnded = (endedSlot) => {
    if (
      activeAudioSourceRef.current !== 'verses' ||
      audioPlaybackEngineRef.current !== 'html' ||
      endedSlot !== activeAudioSlotRef.current
    ) {
      return
    }

    const nextIndex = currentAudioIndexRef.current + 1
    if (nextIndex >= audioPlaylistRef.current.length) {
      if (isAudioRepeating && audioPlaylistRef.current.length > 0) {
        currentAudioIndexRef.current = 0
        prepareAudioSlots(audioPlaylistRef.current, 0, endedSlot)

        audioRefs.current[endedSlot].play().catch((error) => {
          console.error('Unable to repeat Surah audio:', error)
          setIsAudioPlaying(false)
          setAudioError({
            id: activeAudioId,
            message: 'Unable to repeat this recitation.',
          })
        })
      } else if (nextAudioSelection) {
        handleSurahAudioToggle(
          nextAudioSelection.surah,
          nextAudioSelection.siblingSurahs
        )
      } else {
        setIsAudioPlaying(false)
      }
      return
    }

    const nextSlot = endedSlot === 0 ? 1 : 0
    const nextAudio = audioRefs.current[nextSlot]
    if (!nextAudio) return

    currentAudioIndexRef.current = nextIndex
    activeAudioSlotRef.current = nextSlot

    const playPromise = nextAudio.play()

    // The element that just finished is immediately reused to buffer the
    // following Ayah while the already-buffered next Ayah begins playback.
    preloadAudioElement(
      audioRefs.current[endedSlot],
      audioPlaylistRef.current[nextIndex + 1]
    )

    playPromise.catch((error) => {
      console.error('Unable to play the next Ayah:', error)
      audioRefs.current.forEach(clearAudioElement)
      audioPlaylistRef.current = []
      currentAudioIndexRef.current = 0
      activeAudioIdRef.current = null
      activeAudioSourceRef.current = null
      activeYouTubeVideoIdRef.current = null
      audioPlaybackEngineRef.current = null
      setActiveAudioId(null)
      setIsAudioPlaying(false)
      setAudioError({
        id: activeAudioId,
        message: 'Audio stopped before the Surah range was complete.',
      })
    })
  }

  useEffect(() => {
    const hasYouTubeRecitation = surahs.some((surah) =>
      getYouTubeVideoId(surah.favourite_recitation_video)
    )
    if (!hasYouTubeRecitation) return

    getYouTubePlayer().catch((error) => {
      console.error('Unable to prepare YouTube recitation player:', error)
    })
    // The player instance is cached; this only needs to react to fetched data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surahs])

  useEffect(() => {
    const audioElements = [...audioRefs.current]
    const gaplessState = gaplessAudioRef.current

    return () => {
      audioRequestRef.current += 1
      audioElements.forEach((audio) => {
        if (!audio) return
        audio.pause()
        audio.removeAttribute('src')
      })
      stopGaplessPlayback({ clearInitialSegments: true })
      gaplessState.context?.close().catch(() => {})
      gaplessState.context = null
      gaplessState.masterGain = null
      try {
        youtubePlayerRef.current?.destroy()
      } catch {
        // The iframe may have already removed itself.
      }
      youtubePlayerRef.current = null
      youtubePlayerPromiseRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    setSurahsStatus('loading')
    setSurahsError('')

    return fetch(`${HOST}/murajaah/getmemorizedsurah`, {
      headers: withUserHeaders(),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Unable to load your memorised Surahs.')
        return res.json()
      })
      .then((data) => {
        if (!Array.isArray(data)) {
          throw new Error('The Surah list returned an unexpected response.')
        }

        setSurahs(data)
        setSurahsStatus('success')

        const maxCount =
          data.length > 0 ? Math.max(...data.map((s) => Number(s.murajaah_counter || 0))) : 0
        setMaxMurajaahCount(maxCount)

        fetchCompletionRate(data)
      })
      .catch((error) => {
        console.error('An error occurred:', error)
        setSurahsError(error.message || 'Unable to load your memorised Surahs.')
        setSurahsStatus('error')
      })
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

  const audioQueue = useMemo(
    () =>
      Object.keys(groupedSurahs)
        .sort((a, b) => Number(a) - Number(b))
        .flatMap((juz) =>
          groupedSurahs[juz].flatMap((surah) =>
            surah.subsections?.length > 0
              ? surah.subsections.map((subsection) => ({
                  surah: subsection,
                  siblingSurahs: surah.subsections,
                }))
              : [{ surah, siblingSurahs: [] }]
          )
        ),
    [groupedSurahs]
  )

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

  const renderAudioButton = (surah, siblingSurahs = []) => {
    const idKey = normalizeSurahId(surah.id)
    const range = getSurahAudioRange(surah, siblingSurahs)
    const isActive = activeAudioId === idKey
    const isLoading = loadingAudioId === idKey
    const isPlaying = isActive && isAudioPlaying
    const errorMessage = audioError?.id === idKey ? audioError.message : ''
    const rangeLabel = range
      ? `verses ${range.verseStart} to ${range.verseEnd}`
      : 'the memorized verses'

    const actionLabel = isLoading
      ? `Loading ${surah.chapter_name} audio`
      : isPlaying
        ? `Pause ${surah.chapter_name}`
        : `Play ${surah.chapter_name}, ${rangeLabel}`

    return (
      <button
        type="button"
        className={`surah-audio-btn ${isPlaying ? 'surah-audio-btn--playing' : ''} ${
          errorMessage ? 'surah-audio-btn--error' : ''
        }`}
        onClick={(event) => {
          event.stopPropagation()
          handleSurahAudioToggle(surah, siblingSurahs)
        }}
        disabled={!range || isLoading}
        aria-label={errorMessage ? `${errorMessage} Retry ${actionLabel}` : actionLabel}
        aria-pressed={isPlaying}
        title={errorMessage || actionLabel}
      >
        {isLoading ? (
          <span className="surah-audio-spinner" aria-hidden="true" />
        ) : isPlaying ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5.5v13l10-6.5z" />
          </svg>
        )}
      </button>
    )
  }

  const activeAudioSelection = (() => {
    if (!activeAudioId) return null

    for (const juzSurahs of Object.values(groupedSurahs)) {
      for (const surah of juzSurahs) {
        if (normalizeSurahId(surah.id) === activeAudioId) {
          return { surah, siblingSurahs: surah.subsections || [] }
        }

        const subsection = surah.subsections?.find(
          (item) => normalizeSurahId(item.id) === activeAudioId
        )
        if (subsection) {
          return { surah: subsection, siblingSurahs: surah.subsections }
        }
      }
    }

    return null
  })()

  const activeAudioSurah = activeAudioSelection?.surah
  const activeAudioRange = activeAudioSurah
    ? getSurahAudioRange(activeAudioSurah, activeAudioSelection.siblingSurahs)
    : null
  const activeAudioQueueIndex = audioQueue.findIndex(
    ({ surah }) => normalizeSurahId(surah.id) === activeAudioId
  )

  let previousAudioSelection =
    activeAudioQueueIndex > 0 ? audioQueue[activeAudioQueueIndex - 1] : null
  let nextAudioSelection =
    activeAudioQueueIndex >= 0 && activeAudioQueueIndex < audioQueue.length - 1
      ? audioQueue[activeAudioQueueIndex + 1]
      : null

  // A parent with subsections is not duplicated in the automatic queue.
  // When its combined audio is selected directly, navigation skips over
  // those already-covered subsections.
  if (activeAudioQueueIndex === -1 && activeAudioSurah?.subsections?.length > 0) {
    const firstSubsectionId = normalizeSurahId(activeAudioSurah.subsections[0].id)
    const lastSubsectionId = normalizeSurahId(
      activeAudioSurah.subsections[activeAudioSurah.subsections.length - 1].id
    )
    const firstSubsectionIndex = audioQueue.findIndex(
      ({ surah }) => normalizeSurahId(surah.id) === firstSubsectionId
    )
    const lastSubsectionIndex = audioQueue.findIndex(
      ({ surah }) => normalizeSurahId(surah.id) === lastSubsectionId
    )

    previousAudioSelection =
      firstSubsectionIndex > 0 ? audioQueue[firstSubsectionIndex - 1] : null
    nextAudioSelection =
      lastSubsectionIndex >= 0 && lastSubsectionIndex < audioQueue.length - 1
        ? audioQueue[lastSubsectionIndex + 1]
        : null
  }

  youtubeEndedHandlerRef.current = () => {
    if (activeAudioSourceRef.current !== 'youtube') return

    if (isAudioRepeating) {
      const player = youtubePlayerRef.current
      if (!player) {
        setIsAudioPlaying(false)
        return
      }

      player.seekTo(0, true)
      player.playVideo()
      setIsAudioPlaying(true)
      return
    }

    if (nextAudioSelection) {
      handleSurahAudioToggle(
        nextAudioSelection.surah,
        nextAudioSelection.siblingSurahs
      )
    } else {
      setIsAudioPlaying(false)
    }
  }

  gaplessCompletionHandlerRef.current = () => {
    if (
      activeAudioSourceRef.current !== 'verses' ||
      audioPlaybackEngineRef.current !== 'gapless'
    ) {
      return
    }

    if (isAudioRepeating && audioPlaylistRef.current.length > 0) {
      const requestId = audioRequestRef.current
      const currentId = activeAudioIdRef.current
      setLoadingAudioId(currentId)
      startGaplessPlayback(audioPlaylistRef.current, requestId)
        .then((started) => {
          if (started && requestId === audioRequestRef.current) {
            setIsAudioPlaying(true)
            setLoadingAudioId(null)
          }
        })
        .catch((error) => gaplessErrorHandlerRef.current?.(error))
      return
    }

    if (nextAudioSelection) {
      handleSurahAudioToggle(
        nextAudioSelection.surah,
        nextAudioSelection.siblingSurahs
      )
    } else {
      setIsAudioPlaying(false)
    }
  }

  gaplessErrorHandlerRef.current = (error) => {
    if (audioPlaybackEngineRef.current !== 'gapless') return

    const failedId = activeAudioIdRef.current
    console.error('Continuous Surah audio stopped:', error)
    stopGaplessPlayback()
    audioPlaybackEngineRef.current = null
    activeAudioIdRef.current = null
    activeAudioSourceRef.current = null
    activeYouTubeVideoIdRef.current = null
    setActiveAudioId(null)
    setLoadingAudioId(null)
    setIsAudioPlaying(false)
    setAudioError({
      id: failedId,
      message: 'Audio stopped while buffering the next verse. Try again.',
    })
  }

  const isFloatingAudioLoading =
    !!activeAudioId && loadingAudioId === activeAudioId
  const activeUsesYouTube = Boolean(
    getYouTubeVideoId(activeAudioSurah?.favourite_recitation_video)
  )
  const floatingAudioStatus = isFloatingAudioLoading
    ? 'Loading recitation'
    : isAudioPlaying
      ? 'Now playing'
      : 'Paused'

  return (
    <div
      className={`surah-list-container ${
        activeAudioSurah ? 'surah-list-container--audio-active' : ''
      }`}
    >
      <div
        ref={youtubePlayerHostRef}
        className={'surah-youtube-player'}
        aria-hidden={true}
      />
      {[0, 1].map((slot) => (
        <audio
          key={slot}
          ref={(element) => {
            audioRefs.current[slot] = element
          }}
          className="surah-audio-element"
          onEnded={() => handleSurahAudioEnded(slot)}
          preload="auto"
          crossOrigin="anonymous"
        />
      ))}
      <div className="surah-list-header">
        <div className="surah-list-header__inner">
          <div className="surah-list-header__copy">
            <span className="page-eyebrow">Memorisation workspace</span>
        <h1 className="surah-list-title">
          Murajaah Tracker {auth?.user ? `— ${auth.user}` : ''}
        </h1>
            <p className="surah-list-subtitle">Keep your daily review, recitation, and new memorisation in one calm space.</p>
          </div>
          <div className="surah-list-date" aria-label={`Selected date ${date}`}>
            <span>Today</span>
            <strong>{moment.tz(date, 'Asia/Kuala_Lumpur').format('D MMM YYYY')}</strong>
          </div>
        </div>
      </div>

      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />

      <nav className="nav-controls" aria-label="Tracker tools">
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


        <button className="nav-btn" onClick={() => setIsSalahRecitationModalOpen(true)}>
          Salah Recitation
        </button>

        <button className="nav-btn" onClick={() => setIsSabaqModalOpen(true)}>
          Sabaq
        </button>

        <button className="nav-btn" onClick={() => setIsTahajjudModalOpen(true)}>
          Tahajjud
        </button>

        <button className="nav-btn logout-btn" onClick={() => {
          localStorage.removeItem(STORAGE_KEY)
          navigate('/')
        }}>
          Logout
        </button>
      </nav>

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

      {surahsStatus === 'loading' && surahs.length === 0 && (
        <div className="surah-state" role="status" aria-live="polite">
          <span className="state-spinner" aria-hidden="true" />
          <div>
            <strong>Loading your memorisation plan</strong>
            <p>Preparing Surahs and today’s review status...</p>
          </div>
        </div>
      )}

      {surahsStatus === 'error' && (
        <div className="surah-state surah-state--error" role="alert">
          <div>
            <strong>We could not load your Surahs</strong>
            <p>{surahsError}</p>
          </div>
          <button type="button" onClick={fetchSurahs}>Try again</button>
        </div>
      )}

      {surahsStatus === 'success' && surahs.length === 0 && (
        <div className="surah-state surah-state--empty" role="status">
          <div className="surah-state__icon" aria-hidden="true">+</div>
          <div>
            <strong>Your memorisation list is empty</strong>
            <p>Add your first memorised Surah to begin tracking Murajaah.</p>
          </div>
          <button type="button" onClick={() => setIsModalOpen(true)}>Add a Surah</button>
        </div>
      )}

      <div className={`surahs-container ${surahs.length === 0 ? 'surahs-container--empty' : ''}`}>
        {Object.keys(groupedSurahs)
          .sort((a, b) => a - b)
          .map((juz) => {
            const isJuzExpanded = !!expandedJuz[juz]
            const surahListId = `juz-${juz}-surahs`

            return (
            <section key={juz} className="juz-section">
              <h2 className="juz-heading">
                <button
                  type="button"
                  className="juz-toggle"
                  onClick={() => {
                    setExpandedJuz((prev) => ({
                      ...prev,
                      [juz]: !prev[juz],
                    }))
                  }}
                  aria-expanded={isJuzExpanded}
                  aria-controls={surahListId}
                >
                  <span>Juz {juz}</span>
                  <svg
                    className={`juz-chevron ${isJuzExpanded ? 'juz-chevron--open' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
              </h2>
              {isJuzExpanded && (
              <div id={surahListId} className="surahs-grid">
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

                        <div className="surah-actions">
                          {renderAudioButton(surah, surah.subsections || [])}
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

                              <div className="surah-actions">
                                {renderAudioButton(subsection, surah.subsections)}
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
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              )}
            </section>
            )
          })}
      </div>

      {activeAudioSurah && (
        <aside
          className="floating-audio-card"
          aria-label="Current Quran recitation"
          aria-live="polite"
        >
          <button
            type="button"
            className="floating-audio-close"
            onClick={handleCloseAudioPlayer}
            aria-label="Close audio player and stop recitation"
            title="Close player"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          <div
            className={`floating-audio-artwork ${
              isAudioPlaying ? 'floating-audio-artwork--playing' : ''
            }`}
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 9v6h4l5 4V5L9 9H5z" />
              <path className="floating-audio-wave" d="M17 9.5a4 4 0 0 1 0 5" />
              <path className="floating-audio-wave" d="M19.5 7a7 7 0 0 1 0 10" />
            </svg>
          </div>

          <div className="floating-audio-info">
            <span className="floating-audio-status">
              <span
                className={`floating-audio-status-dot ${
                  isAudioPlaying ? 'floating-audio-status-dot--playing' : ''
                }`}
                aria-hidden="true"
              />
              {floatingAudioStatus}
            </span>
            <strong className="floating-audio-title">{activeAudioSurah.chapter_name}</strong>
            {activeAudioRange && (
              <span className="floating-audio-range">
                Verses {activeAudioRange.verseStart}–{activeAudioRange.verseEnd}
                {activeUsesYouTube ? ' (YouTube)' : ''}
              </span>
            )}
          </div>

          <div className="floating-audio-controls">
            <button
              type="button"
              className="floating-audio-skip"
              onClick={() =>
                previousAudioSelection &&
                handleSurahAudioToggle(
                  previousAudioSelection.surah,
                  previousAudioSelection.siblingSurahs
                )
              }
              disabled={!previousAudioSelection || isFloatingAudioLoading}
              aria-label={
                previousAudioSelection
                  ? `Play previous: ${previousAudioSelection.surah.chapter_name}`
                  : 'No previous Surah'
              }
              title="Previous"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="5" y="5" width="2" height="14" rx="1" />
                <path d="M19 5.5v13L8.5 12z" />
              </svg>
            </button>

            <button
              type="button"
              className={`floating-audio-toggle ${
                isAudioPlaying ? 'floating-audio-toggle--playing' : ''
              }`}
              onClick={() =>
                handleSurahAudioToggle(
                  activeAudioSurah,
                  activeAudioSelection.siblingSurahs
                )
              }
              disabled={isFloatingAudioLoading}
              aria-label={
                isFloatingAudioLoading
                  ? `Loading ${activeAudioSurah.chapter_name} audio`
                  : isAudioPlaying
                    ? `Pause ${activeAudioSurah.chapter_name}`
                    : `Play ${activeAudioSurah.chapter_name}`
              }
            >
              {isFloatingAudioLoading ? (
                <span className="floating-audio-spinner" aria-hidden="true" />
              ) : isAudioPlaying ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5.5v13l10-6.5z" />
                </svg>
              )}
            </button>

            <button
              type="button"
              className="floating-audio-skip"
              onClick={() =>
                nextAudioSelection &&
                handleSurahAudioToggle(
                  nextAudioSelection.surah,
                  nextAudioSelection.siblingSurahs
                )
              }
              disabled={!nextAudioSelection || isFloatingAudioLoading}
              aria-label={
                nextAudioSelection
                  ? `Play next: ${nextAudioSelection.surah.chapter_name}`
                  : 'No next Surah'
              }
              title="Next"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 5.5v13L15.5 12z" />
                <rect x="17" y="5" width="2" height="14" rx="1" />
              </svg>
            </button>

            <button
              type="button"
              className={`floating-audio-skip floating-audio-repeat ${
                isAudioRepeating ? 'floating-audio-repeat--active' : ''
              }`}
              onClick={() => setIsAudioRepeating((repeating) => !repeating)}
              aria-label={
                isAudioRepeating
                  ? 'Turn off repeat for the current Surah'
                  : 'Repeat the current Surah continuously'
              }
              aria-pressed={isAudioRepeating}
              title={isAudioRepeating ? 'Repeat on' : 'Repeat off'}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M17 2l4 4-4 4" />
                <path d="M3 11V9a3 3 0 0 1 3-3h18" />
                <path d="M7 22l-4-4 4-4" />
                <path d="M21 13v2a3 3 0 0 1-3 3H3" />
              </svg>
            </button>
          </div>
        </aside>
      )}
    </div>
  )
}

export default SurahList

