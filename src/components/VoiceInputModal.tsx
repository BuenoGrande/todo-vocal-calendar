import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, X } from 'lucide-react'

interface VoiceInputModalProps {
  isOpen: boolean
  onClose: () => void
  onTranscription: (text: string) => void
}

export default function VoiceInputModal({ isOpen, onClose, onTranscription }: VoiceInputModalProps) {
  const [phase, setPhase] = useState<'idle' | 'listening' | 'processing'>('idle')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })

        if (audioBlob.size < 1000) {
          setPhase('idle')
          return
        }

        setPhase('processing')
        try {
          const { transcribe } = await import('../services/whisper')
          const text = await transcribe(audioBlob)
          if (text.trim()) {
            onTranscription(text)
            onClose()
          }
        } catch (err) {
          console.error('Transcription error:', err)
        } finally {
          setPhase('idle')
        }
      }

      mediaRecorder.start(250)
      setPhase('listening')
    } catch (err) {
      console.error('Microphone access error:', err)
    }
  }, [onTranscription, onClose])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const handleMicClick = () => {
    if (phase === 'listening') {
      stopRecording()
    } else if (phase === 'idle') {
      startRecording()
    }
  }

  const handleClose = () => {
    if (phase === 'listening') stopRecording()
    setPhase('idle')
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-deep/80 backdrop-blur-sm"
          onClick={handleClose}
        />

        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: -20 }}
          className="relative z-10 bg-surface border border-border rounded-2xl p-8 flex flex-col items-center shadow-2xl w-full max-w-md"
        >
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-1.5 text-secondary hover:text-primary hover:bg-elevated rounded-md transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div
            className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mb-6 relative cursor-pointer"
            onClick={handleMicClick}
          >
            {phase === 'listening' && (
              <motion.div
                className="absolute inset-0 rounded-full bg-accent/30"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
            )}
            {phase === 'processing' ? (
              <svg className="w-8 h-8 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <Mic className={`w-8 h-8 relative z-10 ${phase === 'listening' ? 'text-accent' : 'text-secondary'}`} />
            )}
          </div>

          {/* Audio waveform */}
          <div className="flex items-center gap-1.5 h-12 mb-4">
            {[...Array(7)].map((_, i) => (
              <motion.div
                key={i}
                className="w-1.5 bg-accent rounded-full"
                animate={{
                  height: phase === 'listening' ? ['20%', '100%', '20%'] : '20%',
                  opacity: phase === 'processing' ? 0.5 : phase === 'listening' ? 1 : 0.3,
                }}
                transition={{
                  repeat: Infinity,
                  duration: 0.5 + Math.random() * 0.5,
                  delay: i * 0.1,
                }}
              />
            ))}
          </div>

          <p className="text-secondary font-medium text-sm">
            {phase === 'idle' && 'Tap the microphone to start'}
            {phase === 'listening' && 'Listening... Tap to stop'}
            {phase === 'processing' && 'Parsing tasks...'}
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
