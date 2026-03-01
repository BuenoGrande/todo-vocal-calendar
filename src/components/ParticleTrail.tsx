import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Particle {
  id: number
  x: number
  y: number
  color: string
}

interface ParticleTrailProps {
  x: number
  y: number
  isDragging: boolean
  color?: string
}

export default function ParticleTrail({ x, y, isDragging, color = '#8B5CF6' }: ParticleTrailProps) {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    if (!isDragging) {
      setParticles([])
      return
    }
    const interval = setInterval(() => {
      setParticles((prev) => [
        ...prev.slice(-10),
        {
          id: Date.now() + Math.random(),
          x: x + (Math.random() * 16 - 8),
          y: y + (Math.random() * 16 - 8),
          color,
        },
      ])
    }, 60)
    return () => clearInterval(interval)
  }, [x, y, isDragging, color])

  if (!isDragging) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0.6, scale: 1, x: p.x, y: p.y }}
            animate={{ opacity: 0, scale: 0, y: p.y + 15 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="absolute h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: p.color, boxShadow: `0 0 6px ${p.color}` }}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
