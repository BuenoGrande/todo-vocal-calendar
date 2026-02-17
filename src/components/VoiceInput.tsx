import { useState, useRef, useCallback } from 'react'

interface VoiceInputProps {
  onTranscription: (text: string) => void
  disabled: boolean
  apiKey: string
}

export default function VoiceInput({ onTranscription, disabled, apiKey }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
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

        if (audioBlob.size < 1000) return

        setIsProcessing(true)
        try {
          const { transcribe } = await import('../services/whisper')
          const text = await transcribe(audioBlob, apiKey)
          if (text.trim()) onTranscription(text)
        } catch (err) {
          console.error('Transcription error:', err)
          alert(`Transcription failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
        } finally {
          setIsProcessing(false)
        }
      }

      mediaRecorder.start(250)
      setIsRecording(true)
    } catch (err) {
      console.error('Microphone access error:', err)
      alert('Could not access microphone. Please check permissions.')
    }
  }, [apiKey, onTranscription])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }, [])

  const toggleRecording = () => {
    if (isRecording) stopRecording()
    else startRecording()
  }

  return (
    <button
      onClick={toggleRecording}
      disabled={disabled || isProcessing}
      title={
        disabled
          ? 'Add OpenAI API key in settings'
          : isRecording
            ? 'Stop recording'
            : 'Start recording'
      }
      className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
        isRecording
          ? 'bg-red-500 text-white recording-pulse'
          : isProcessing
            ? 'bg-amber-500 text-white animate-pulse'
            : 'bg-indigo-500 text-white hover:bg-indigo-600'
      }`}
    >
      {isProcessing ? (
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
      )}
    </button>
  )
}
