import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface LevelUpCelebrationProps {
  isOpen: boolean
  level: number
  onClose: () => void
}

export default function LevelUpCelebration({ isOpen, level, onClose }: LevelUpCelebrationProps) {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(onClose, 3500)
      return () => clearTimeout(timer)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-deep/80 backdrop-blur-sm pointer-events-auto"
          onClick={onClose}
        />

        {/* Particles */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          {[...Array(24)].map((_, i) => {
            const angle = (i / 24) * Math.PI * 2
            const distance = 200 + Math.random() * 150
            return (
              <motion.div
                key={i}
                initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                animate={{
                  x: Math.cos(angle) * distance,
                  y: Math.sin(angle) * distance,
                  scale: Math.random() * 1.5 + 0.5,
                  opacity: 0,
                }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                className="absolute w-2 h-2 bg-accent rounded-full"
                style={{ boxShadow: '0 0 15px -3px rgba(139,92,246,0.4)' }}
              />
            )
          })}
        </div>

        <div className="relative z-10 flex flex-col items-center">
          <motion.h2
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 15, stiffness: 100 }}
            className="text-5xl md:text-7xl font-bold text-white tracking-tight mb-8 drop-shadow-lg"
          >
            Level Up!
          </motion.h2>

          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', damping: 12, delay: 0.1 }}
            className="w-24 h-24 rounded-2xl bg-accent flex items-center justify-center relative overflow-hidden"
            style={{ boxShadow: '0 0 15px -3px rgba(139,92,246,0.4)' }}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent" />
            <span className="text-4xl font-bold text-white relative z-10">{level}</span>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  )
}
