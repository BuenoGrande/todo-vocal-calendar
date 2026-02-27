import { useEffect, useState, useRef } from 'react'

interface CompletionCounterProps {
  count: number
  streak: number
  onMilestone?: (message: string) => void
}

const MILESTONES: Record<number, string> = {
  1: 'First blood!',
  3: 'On a roll!',
  5: 'Halfway hero!',
  7: 'Seven strong!',
  10: 'Perfect 10!',
  15: 'Unstoppable!',
  20: 'Legendary day!',
}

const DAILY_GOAL = 5
const XP_PER_TASK = 10
const XP_PER_LEVEL = 100

const CONFETTI_COLORS = ['#FF3300', '#FFD700', '#FF6B00', '#FF4D1A', '#FF9500', '#FFB800']

export default function CompletionCounter({ count, streak, onMilestone }: CompletionCounterProps) {
  const [showConfetti, setShowConfetti] = useState(false)
  const [levelBurst, setLevelBurst] = useState(false)
  const prevCountRef = useRef(count)

  const xp = count * XP_PER_TASK
  const level = Math.floor(xp / XP_PER_LEVEL) + 1
  const xpInLevel = xp % XP_PER_LEVEL
  const xpProgress = (xpInLevel / XP_PER_LEVEL) * 100
  const dailyFilled = Math.min(count, DAILY_GOAL)

  useEffect(() => {
    const prev = prevCountRef.current
    prevCountRef.current = count

    if (count <= prev) return

    // Check milestone
    const msg = MILESTONES[count]
    if (msg) {
      setShowConfetti(true)
      onMilestone?.(msg)
      const timer = setTimeout(() => setShowConfetti(false), 2500)
      return () => clearTimeout(timer)
    }

    // Check level-up
    const prevLevel = Math.floor((prev * XP_PER_TASK) / XP_PER_LEVEL) + 1
    if (level > prevLevel) {
      setLevelBurst(true)
      const timer = setTimeout(() => setLevelBurst(false), 600)
      return () => clearTimeout(timer)
    }
  }, [count, level, onMilestone])

  return (
    <div className="relative flex items-center gap-4 px-3 py-2 rounded-xl bg-[#111] border border-white/[0.06]">
      {/* Streak */}
      <div className="flex items-center gap-1.5" title={`${streak}-day streak`}>
        <span
          className="text-base leading-none"
          style={{ animation: streak > 0 ? 'flicker 1.5s ease-in-out infinite' : undefined, display: 'inline-block' }}
        >
          🔥
        </span>
        <span className="text-xs font-bold text-white tabular-nums">{streak}</span>
      </div>

      {/* XP / Level */}
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] font-black px-1.5 py-0.5 rounded bg-[#FF3300] text-white leading-none ${levelBurst ? 'animate-[level-burst_0.5s_ease-out]' : ''}`}
        >
          Lv {level}
        </span>
        <div className="flex flex-col gap-0.5">
          <div className="w-16 h-1.5 rounded-full bg-[#1c1c1c] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${xpProgress}%`,
                background: 'linear-gradient(90deg, #FF3300, #FFD700)',
              }}
            />
          </div>
          <span className="text-[9px] text-[#666] tabular-nums leading-none">{xpInLevel}/{XP_PER_LEVEL} XP</span>
        </div>
      </div>

      {/* Daily goal segments */}
      <div className="flex items-center gap-1.5" title={`${dailyFilled}/${DAILY_GOAL} daily goal`}>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: DAILY_GOAL }).map((_, i) => (
            <div
              key={i}
              className={`w-2.5 h-5 rounded-sm transition-all duration-300 ${
                i < dailyFilled
                  ? 'bg-[#FF3300]'
                  : 'bg-[#1c1c1c]'
              }`}
            />
          ))}
        </div>
        <span className="text-[10px] font-medium text-[#666] tabular-nums">{dailyFilled}/{DAILY_GOAL}</span>
      </div>

      {/* Confetti effect */}
      {showConfetti && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 pointer-events-none">
          {Array.from({ length: 16 }).map((_, i) => {
            const angle = (i / 16) * 360
            const rad = (angle * Math.PI) / 180
            const dist = 20 + Math.random() * 25
            const x = Math.cos(rad) * dist
            const y = -Math.abs(Math.sin(rad) * dist) - 10
            const size = 4 + Math.random() * 4
            return (
              <span
                key={i}
                className="absolute rounded-full animate-[confetti-fly_1.2s_ease-out_forwards]"
                style={{
                  width: size,
                  height: size,
                  backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                  '--confetti-x': `${x}px`,
                  '--confetti-y': `${y}px`,
                  '--confetti-r': `${Math.random() * 720 - 360}deg`,
                  animationDelay: `${i * 0.04}s`,
                } as React.CSSProperties}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
