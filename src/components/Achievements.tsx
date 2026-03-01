import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, CheckCircle, Flame, Target, Sunrise, Zap, X } from 'lucide-react'
import type { ElementType } from 'react'

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  unlocked: boolean
  category: 'Productivity' | 'Consistency' | 'Mastery'
}

interface AchievementsProps {
  isOpen: boolean
  onClose: () => void
  achievements: Achievement[]
}

const IconMap: Record<string, ElementType> = {
  CheckCircle,
  Flame,
  Target,
  Sunrise,
  Zap,
  Trophy,
}

export default function Achievements({ isOpen, onClose, achievements }: AchievementsProps) {
  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-deep/90 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative w-full max-w-4xl max-h-[85vh] bg-surface border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
        >
          <div className="p-6 border-b border-border flex justify-between items-center bg-elevated/50">
            <div>
              <h2 className="text-xl font-semibold text-primary flex items-center gap-2">
                <Trophy className="w-5 h-5 text-accent" />
                Achievements
              </h2>
              <p className="text-secondary text-sm mt-1">Your productivity milestones.</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-secondary hover:text-primary hover:bg-elevated rounded-md transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {achievements.map((achievement) => {
                const Icon = IconMap[achievement.icon] || Trophy
                const isUnlocked = achievement.unlocked
                return (
                  <motion.div
                    key={achievement.id}
                    whileHover={isUnlocked ? { y: -2 } : {}}
                    className={`relative p-4 rounded-lg border transition-all duration-200 ${
                      isUnlocked
                        ? 'bg-elevated border-border hover:border-accent/50'
                        : 'bg-deep border-border/50 opacity-60 grayscale'
                    }`}
                  >
                    <div className="flex items-start gap-4 relative z-10">
                      <div
                        className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${
                          isUnlocked ? 'bg-accent/10 text-accent' : 'bg-surface text-dim'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className={`font-medium text-sm mb-1 ${isUnlocked ? 'text-primary' : 'text-dim'}`}>
                          {isUnlocked ? achievement.name : 'Locked'}
                        </h3>
                        <p className={`text-xs leading-relaxed ${isUnlocked ? 'text-secondary' : 'text-dim'}`}>
                          {isUnlocked ? achievement.description : 'Keep working to reveal this achievement.'}
                        </p>
                        <div className="mt-3 inline-block px-2 py-0.5 rounded bg-surface text-[10px] font-medium uppercase tracking-wider text-dim border border-border/50">
                          {achievement.category}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
