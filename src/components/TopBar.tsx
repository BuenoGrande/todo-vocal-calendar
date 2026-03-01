import { Mic, Trophy, Target } from 'lucide-react'
import XPBar from './XPBar'
import StreakCounter from './StreakCounter'
import GoogleCalendarButton from './GoogleCalendarButton'

interface TopBarProps {
  level: number
  xp: number
  xpToNextLevel: number
  streak: number
  onNewTask: () => void
  onOpenAchievements: () => void
  onToggleGoals: () => void
}

export default function TopBar({
  level,
  xp,
  xpToNextLevel,
  streak,
  onNewTask,
  onOpenAchievements,
  onToggleGoals,
}: TopBarProps) {
  return (
    <header className="h-16 w-full bg-surface border-b border-border flex items-center justify-between px-6 shrink-0 z-30 relative">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-accent flex items-center justify-center" style={{ boxShadow: '0 0 15px -3px rgba(139,92,246,0.4)' }}>
            <span className="font-bold text-white text-lg leading-none">S</span>
          </div>
          <h1 className="font-bold text-xl tracking-wide text-primary hidden sm:block">SHOUT</h1>
        </div>

        <div className="h-6 w-px bg-border hidden md:block" />

        <XPBar level={level} xp={xp} xpToNextLevel={xpToNextLevel} />
      </div>

      <div className="flex items-center gap-4">
        <StreakCounter streak={streak} />

        <div className="h-6 w-px bg-border hidden sm:block" />

        <GoogleCalendarButton />

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleGoals}
            className="w-9 h-9 rounded-md bg-elevated border border-border hover:border-accent hover:text-accent flex items-center justify-center transition-colors text-secondary cursor-pointer"
            title="Daily Goals"
          >
            <Target className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenAchievements}
            className="w-9 h-9 rounded-md bg-elevated border border-border hover:border-accent hover:text-accent flex items-center justify-center transition-colors text-secondary cursor-pointer"
            title="Achievements"
          >
            <Trophy className="w-4 h-4" />
          </button>

          <button
            onClick={onNewTask}
            className="ml-2 px-4 h-9 rounded-md bg-accent text-white hover:bg-accent-glow flex items-center gap-2 transition-colors font-medium text-sm shadow-sm cursor-pointer"
          >
            <Mic className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>
    </header>
  )
}
