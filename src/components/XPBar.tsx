import { motion } from 'framer-motion'

interface XPBarProps {
  level: number
  xp: number
  xpToNextLevel: number
}

export default function XPBar({ level, xp, xpToNextLevel }: XPBarProps) {
  const progress = Math.min(100, Math.max(0, (xp / xpToNextLevel) * 100))

  return (
    <div className="flex flex-col w-48 sm:w-64">
      <div className="flex justify-between items-end mb-1.5">
        <span className="font-bold text-primary text-sm">Level {level}</span>
        <span className="text-xs text-secondary font-medium">
          {xp} / {xpToNextLevel} XP
        </span>
      </div>

      <div className="h-2 w-full bg-elevated rounded-full overflow-hidden border border-border relative">
        <motion.div
          className="absolute top-0 left-0 h-full bg-accent"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 50, damping: 15 }}
        >
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/20 to-transparent" />
          <motion.div
            className="absolute top-0 bottom-0 w-10 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            animate={{ x: ['-100%', '300%'] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
          />
        </motion.div>
      </div>
    </div>
  )
}
