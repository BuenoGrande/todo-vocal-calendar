import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Circle } from 'lucide-react'

export interface DailyObjective {
  id: string
  name: string
  progress: number
  target: number
  completed: boolean
}

interface DailyGoalsProps {
  isOpen: boolean
  objectives: DailyObjective[]
}

export default function DailyGoals({ isOpen, objectives }: DailyGoalsProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
          className="absolute top-full right-6 mt-2 w-80 bg-surface border border-border rounded-xl shadow-2xl z-40 overflow-hidden origin-top-right"
        >
          <div className="p-4 border-b border-border bg-elevated/50">
            <h3 className="font-semibold text-primary text-sm">Daily Goals</h3>
          </div>

          <div className="p-4">
            <ul className="space-y-4">
              {objectives.map((obj) => (
                <li key={obj.id} className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {obj.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    ) : (
                      <Circle className="w-4 h-4 text-dim" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${obj.completed ? 'text-dim line-through' : 'text-primary'}`}>
                      {obj.name}
                    </p>
                    <div className="mt-2 h-1.5 w-full bg-elevated rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-accent"
                        initial={{ width: 0 }}
                        animate={{ width: `${(obj.progress / obj.target) * 100}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-medium text-secondary shrink-0 mt-0.5">
                    {obj.progress}/{obj.target}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
