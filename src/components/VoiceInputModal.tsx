import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, Square } from 'lucide-react'

interface VoiceInputModalProps {
  isOpen: boolean
  onClose: () => void
  onTranscription: (text: string) => void
}

export default function VoiceInputModal({ isOpen, onClose, onTranscription }: VoiceInputModalProps) {
  const [phase, setPhase] = useState<'idle' | 'listening' | 'processing'>('idle')
  const [seconds, setSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-start recording when opened
  useEffect(() => {
    if (isOpen && phase === 'idle') {
      startRecording()
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isOpen])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []
      setSeconds(0)

      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })

        if (audioBlob.size < 1000) {
          setPhase('idle')
          onClose()
          return
        }

        setPhase('processing')
        try {
          const { transcribe } = await import('../services/whisper')
          const text = await transcribe(audioBlob)
          if (text.trim()) {
            onTranscription(text)
          }
        } catch (err) {
          console.error('Transcription error:', err)
        } finally {
          setPhase('idle')
          setSeconds(0)
          onClose()
        }
      }

      mediaRecorder.start(250)
      setPhase('listening')
    } catch (err) {
      console.error('Microphone access error:', err)
      onClose()
    }
  }, [onTranscription, onClose])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const handleStop = () => {
    if (phase === 'listening') {
      stopRecording()
    }
  }

  const handleCancel = () => {
    if (phase === 'listening') {
      // Discard the recording
      if (mediaRecorderRef.current?.state === 'recording') {
        const stream = mediaRecorderRef.current.stream
        mediaRecorderRef.current.ondataavailable = null
        mediaRecorderRef.current.onstop = () => {
          stream.getTracks().forEach((track) => track.stop())
        }
        mediaRecorderRef.current.stop()
      }
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      setPhase('idle')
      setSeconds(0)
      onClose()
    }
  }

  if (!isOpen) return null

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-surface border border-border rounded-xl shadow-lg">
        {phase === 'listening' && (
          <>
            <div className="w-2.5 h-2.5 rounded-full bg-critical animate-pulse shrink-0" />
            <span className="text-sm text-primary font-medium tabular-nums">{formatTime(seconds)}</span>
            <span className="text-sm text-secondary">Recording...</span>
            <button
              onClick={handleStop}
              className="ml-2 flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-xs font-semibold rounded-md hover:bg-accent-glow transition-colors cursor-pointer"
            >
              <Square className="w-3 h-3 fill-current" />
              Done
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-xs text-dim hover:text-primary transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </>
        )}
        {phase === 'processing' && (
          <>
            <svg className="w-4 h-4 animate-spin text-accent shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm text-secondary">Parsing tasks...</span>
          </>
        )}
        {phase === 'idle' && (
          <>
            <Mic className="w-4 h-4 text-secondary" />
            <span className="text-sm text-secondary">Starting microphone...</span>
          </>
        )}
      </div>
    </div>
  )
}
