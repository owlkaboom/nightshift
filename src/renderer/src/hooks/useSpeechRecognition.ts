import { useCallback, useEffect, useRef, useState } from 'react'

export type SpeechRecognitionStatus = 'idle' | 'listening' | 'processing' | 'error' | 'loading_model'

interface UseSpeechRecognitionOptions {
  /** Language for speech recognition (default: 'en-US') */
  lang?: string
  /** Whether to continuously listen (default: false) */
  continuous?: boolean
  /** Whether to return interim results while speaking (default: true) */
  interimResults?: boolean
  /** Callback when final transcript is available */
  onResult?: (transcript: string) => void
  /** Callback when interim transcript updates */
  onInterimResult?: (transcript: string) => void
  /** Callback when an error occurs */
  onError?: (error: string) => void
  /** Whisper model to use (default: 'tiny.en') */
  model?: string
}

interface UseSpeechRecognitionReturn {
  /** Current status of speech recognition */
  status: SpeechRecognitionStatus
  /** Whether currently listening */
  isListening: boolean
  /** Current transcript (interim or final) */
  transcript: string
  /** Error message if status is 'error' */
  error: string | null
  /** Whether speech recognition is supported (always true for local Whisper) */
  isSupported: boolean
  /** Whether the model is loaded */
  isModelLoaded: boolean
  /** Model loading progress (0-100) */
  modelLoadProgress: number
  /** Recording duration in milliseconds */
  recordingDuration: number
  /** Current audio level (0-1) */
  audioLevel: number
  /** Start listening for speech */
  startListening: () => void
  /** Stop listening */
  stopListening: () => void
  /** Toggle listening state */
  toggleListening: () => void
  /** Clear the current transcript */
  clearTranscript: () => void
  /** Load the Whisper model */
  loadModel: () => Promise<void>
}

// Audio recording configuration
const SAMPLE_RATE = 16000
const CHANNELS = 1
const MAX_RECORDING_DURATION_MS = 5 * 60 * 1000 // 5 minutes
const SILENCE_DETECTION_ENABLED = true
const SILENCE_THRESHOLD = 0.01 // Audio level threshold for silence
const SILENCE_DURATION_MS = 3000 // 3 seconds of silence before auto-stop

/**
 * Custom hook for speech recognition using local Whisper transcription
 * Records audio from the microphone and sends it to the main process for offline transcription
 */
export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const { onResult, onInterimResult, onError, model = 'tiny.en' } = options

  const [status, setStatus] = useState<SpeechRecognitionStatus>('idle')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isModelLoaded, setIsModelLoaded] = useState(false)
  const [modelLoadProgress, setModelLoadProgress] = useState(0)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)

  // Refs for audio handling
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const isRecordingRef = useRef(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const recordingStartTimeRef = useRef<number>(0)
  const recordingTimerRef = useRef<number | null>(null)
  const silenceTimerRef = useRef<number | null>(null)
  const lastSoundTimeRef = useRef<number>(0)

  // Store callbacks in refs to avoid recreating on callback changes
  const onResultRef = useRef(onResult)
  const onInterimResultRef = useRef(onInterimResult)
  const onErrorRef = useRef(onError)

  // Keep refs up to date
  useEffect(() => {
    onResultRef.current = onResult
    onInterimResultRef.current = onInterimResult
    onErrorRef.current = onError
  }, [onResult, onInterimResult, onError])

  // Check model status on mount and subscribe to load progress
  useEffect(() => {
    const checkModelStatus = async () => {
      try {
        const status = await window.api.getWhisperStatus()
        setIsModelLoaded(status.isReady)
        setModelLoadProgress(status.progress)
        if (status.isLoading) {
          setStatus('loading_model')
        }
      } catch (err) {
        console.error('Failed to check Whisper status:', err)
      }
    }

    checkModelStatus()

    // Subscribe to model load progress
    const unsubscribe = window.api.onWhisperLoadProgress(({ progress }) => {
      setModelLoadProgress(progress)
      if (progress >= 100) {
        setIsModelLoaded(true)
        setStatus((prev) => (prev === 'loading_model' ? 'idle' : prev))
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  /**
   * Load the Whisper model
   */
  const loadModel = useCallback(async () => {
    if (isModelLoaded) return

    setStatus('loading_model')
    setError(null)

    try {
      const result = await window.api.loadWhisperModel(model)
      if (!result.success) {
        throw new Error(result.error || 'Failed to load model')
      }
      setIsModelLoaded(true)
      setStatus('idle')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load model'
      setError(errorMessage)
      setStatus('error')
      onErrorRef.current?.(errorMessage)
    }
  }, [isModelLoaded, model])

  /**
   * Convert audio blob to base64 WAV format
   */
  const convertToWavBase64 = useCallback(async (audioBlob: Blob): Promise<string> => {
    // Create an AudioContext to decode and re-encode the audio
    const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE })

    // Decode the audio blob
    const arrayBuffer = await audioBlob.arrayBuffer()
    console.log(`[SpeechRecognition] Decoding ${arrayBuffer.byteLength} bytes of WebM audio`)
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    // Get mono audio data
    const audioData = audioBuffer.getChannelData(0)
    const audioDurationSeconds = audioData.length / SAMPLE_RATE
    console.log(`[SpeechRecognition] Decoded audio: ${audioDurationSeconds.toFixed(2)}s (${audioData.length} samples at ${SAMPLE_RATE}Hz)`)

    // Create WAV file
    const wavBuffer = createWavBuffer(audioData, SAMPLE_RATE)

    // Convert to base64
    const base64 = btoa(
      Array.from(new Uint8Array(wavBuffer))
        .map((b) => String.fromCharCode(b))
        .join('')
    )

    await audioContext.close()
    return base64
  }, [])

  /**
   * Create a WAV buffer from audio samples
   */
  const createWavBuffer = (samples: Float32Array, sampleRate: number): ArrayBuffer => {
    const buffer = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(buffer)

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }

    writeString(0, 'RIFF')
    view.setUint32(4, 36 + samples.length * 2, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true) // Subchunk1Size
    view.setUint16(20, 1, true) // AudioFormat (PCM)
    view.setUint16(22, CHANNELS, true) // NumChannels
    view.setUint32(24, sampleRate, true) // SampleRate
    view.setUint32(28, sampleRate * CHANNELS * 2, true) // ByteRate
    view.setUint16(32, CHANNELS * 2, true) // BlockAlign
    view.setUint16(34, 16, true) // BitsPerSample
    writeString(36, 'data')
    view.setUint32(40, samples.length * 2, true) // Subchunk2Size

    // Write samples
    const offset = 44
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]))
      view.setInt16(offset + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
    }

    return buffer
  }

  /**
   * Process recorded audio and send for transcription
   */
  const processAudio = useCallback(async () => {
    if (audioChunksRef.current.length === 0) {
      setStatus('idle')
      return
    }

    setStatus('processing')

    try {
      // Combine audio chunks
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      const recordingDurationMs = Date.now() - recordingStartTimeRef.current
      console.log(`[SpeechRecognition] Processing ${audioChunksRef.current.length} chunks, total blob size: ${audioBlob.size} bytes, recording duration: ${(recordingDurationMs / 1000).toFixed(2)}s`)
      audioChunksRef.current = []

      // Convert to WAV base64
      const audioBase64 = await convertToWavBase64(audioBlob)
      console.log(`[SpeechRecognition] Converted to WAV, base64 length: ${audioBase64.length}`)

      // Send to main process for transcription
      const result = await window.api.transcribeAudio(audioBase64)

      if (!result.success) {
        throw new Error(result.error || 'Transcription failed')
      }

      const transcribedText = result.result?.text || ''
      console.log(`[SpeechRecognition] Transcription result: ${transcribedText.length} characters`)
      setTranscript(transcribedText)
      onResultRef.current?.(transcribedText)
      setStatus('idle')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transcription failed'
      setError(errorMessage)
      setStatus('error')
      onErrorRef.current?.(errorMessage)
    }
  }, [convertToWavBase64])

  /**
   * Monitor audio levels and detect silence
   */
  const monitorAudioLevels = useCallback(() => {
    if (!analyserRef.current) return

    const analyser = analyserRef.current
    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    const checkAudioLevel = () => {
      if (!isRecordingRef.current) return

      analyser.getByteTimeDomainData(dataArray)

      // Calculate RMS (root mean square) for audio level
      let sum = 0
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128
        sum += normalized * normalized
      }
      const rms = Math.sqrt(sum / dataArray.length)
      setAudioLevel(rms)

      // Silence detection
      if (SILENCE_DETECTION_ENABLED && rms > SILENCE_THRESHOLD) {
        lastSoundTimeRef.current = Date.now()
        // Clear silence timer if sound detected
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current)
          silenceTimerRef.current = null
        }
      } else if (SILENCE_DETECTION_ENABLED && !silenceTimerRef.current) {
        // Start silence timer if not already started
        const timeSinceLastSound = Date.now() - lastSoundTimeRef.current
        if (timeSinceLastSound > SILENCE_DURATION_MS) {
          // Already silent for long enough
          console.log('[SpeechRecognition] Auto-stopping due to silence')
          stopListening()
          return
        } else {
          // Schedule auto-stop after remaining silence duration
          const remainingTime = SILENCE_DURATION_MS - timeSinceLastSound
          silenceTimerRef.current = window.setTimeout(() => {
            if (isRecordingRef.current) {
              console.log('[SpeechRecognition] Auto-stopping due to silence')
              stopListening()
            }
          }, remainingTime)
        }
      }

      // Continue monitoring
      requestAnimationFrame(checkAudioLevel)
    }

    checkAudioLevel()
  }, [])

  /**
   * Update recording duration timer
   */
  const updateRecordingDuration = useCallback(() => {
    if (!isRecordingRef.current) return

    const elapsed = Date.now() - recordingStartTimeRef.current
    setRecordingDuration(elapsed)

    // Check if max duration reached
    if (elapsed >= MAX_RECORDING_DURATION_MS) {
      console.log('[SpeechRecognition] Max recording duration reached')
      stopListening()
      return
    }

    // Continue updating
    recordingTimerRef.current = window.setTimeout(updateRecordingDuration, 100)
  }, [])

  /**
   * Start listening for speech
   */
  const startListening = useCallback(async () => {
    if (isRecordingRef.current || status === 'listening') return

    // Load model if not loaded
    if (!isModelLoaded) {
      await loadModel()
      if (!isModelLoaded) return
    }

    // Reset state
    audioChunksRef.current = []
    setTranscript('')
    setError(null)
    setRecordingDuration(0)
    setAudioLevel(0)
    recordingStartTimeRef.current = Date.now()
    lastSoundTimeRef.current = Date.now()

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: CHANNELS,
          echoCancellation: true,
          noiseSuppression: true
        }
      })

      streamRef.current = stream

      // Set up audio analysis for level monitoring
      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE })
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)

      audioContextRef.current = audioContext
      analyserRef.current = analyser

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
      })

      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        isRecordingRef.current = false
        processAudio()
      }

      mediaRecorder.onerror = (event) => {
        const errorMessage = 'Recording error occurred'
        console.error('MediaRecorder error:', event)
        setError(errorMessage)
        setStatus('error')
        onErrorRef.current?.(errorMessage)
      }

      // Start recording
      mediaRecorder.start(1000) // Collect data every second
      isRecordingRef.current = true
      setStatus('listening')

      // Start audio level monitoring
      monitorAudioLevels()

      // Start recording duration timer
      updateRecordingDuration()
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message.includes('Permission denied')
            ? 'Microphone access denied. Please allow microphone access in your system settings.'
            : err.message
          : 'Failed to start recording'
      setError(errorMessage)
      setStatus('error')
      onErrorRef.current?.(errorMessage)
    }
  }, [status, isModelLoaded, loadModel, processAudio])

  /**
   * Stop listening
   */
  const stopListening = useCallback(() => {
    if (!isRecordingRef.current || !mediaRecorderRef.current) return

    // Clear timers
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }

    // Stop the media recorder (will trigger onstop which processes audio)
    mediaRecorderRef.current.stop()

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    analyserRef.current = null

    // Reset audio level
    setAudioLevel(0)
  }, [])

  /**
   * Toggle listening state
   */
  const toggleListening = useCallback(async () => {
    if (status === 'listening') {
      stopListening()
    } else if (status === 'idle' || status === 'error') {
      await startListening()
    }
  }, [status, startListening, stopListening])

  /**
   * Clear the current transcript
   */
  const clearTranscript = useCallback(() => {
    setTranscript('')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear all timers
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current)
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
      }

      // Stop recording
      if (mediaRecorderRef.current && isRecordingRef.current) {
        mediaRecorderRef.current.stop()
      }

      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }

      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  return {
    status,
    isListening: status === 'listening',
    transcript,
    error,
    isSupported: true, // Local Whisper is always supported
    isModelLoaded,
    modelLoadProgress,
    recordingDuration,
    audioLevel,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
    loadModel
  }
}
