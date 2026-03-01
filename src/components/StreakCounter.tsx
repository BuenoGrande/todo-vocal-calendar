import { motion } from 'framer-motion'
import { Flame } from 'lucide-react'

interface StreakCounterProps {
  streak: number
}

export default function StreakCounter({ streak }: StreakCounterProps) {
  const isHot = streak >= 3
  const isBlazing = streak >= 7

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-elevated border border-border">
      <motion.div
        animate={isHot ? { scale: [1, 1.1, 1], rotate: [-2, 2, -1, 0] } : {}}
        transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
      >
        <Flame
          className={`w-4 h-4 ${isBlazing ? 'text-high' : isHot ? 'text-high/80' : 'text-dim'}`}
          fill={isHot ? 'currentColor' : 'none'}
        />
      </motion.div>
      <div className="flex items-baseline gap-1">
        <span className={`font-bold text-sm ${isBlazing ? 'text-high' : 'text-primary'}`}>
          {streak}
        </span>
        <span className="text-xs font-medium text-secondary">Days</span>
      </div>
    </div>
  )
}
