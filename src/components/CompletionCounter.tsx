import { useEffect, useState } from 'react'

interface CompletionCounterProps {
  count: number
}

const MILESTONES = [3, 5, 10]

export default function CompletionCounter({ count }: CompletionCounterProps) {
  const [showConfetti, setShowConfetti] = useState(false)
  const [prevCount, setPrevCount] = useState(count)

  useEffect(() => {
    if (count > prevCount && MILESTONES.includes(count)) {
      setShowConfetti(true)
      const timer = setTimeout(() => setShowConfetti(false), 2000)
      return () => clearTimeout(timer)
    }
    setPrevCount(count)
  }, [count, prevCount])

  const nextMilestone = MILESTONES.find((m) => m > count) ?? 10
  const progress = Math.min((count / nextMilestone) * 100, 100)
  const circumference = 2 * Math.PI * 18
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div className="relative flex items-center gap-3 px-3 py-2 rounded-xl bg-[#111] border border-[#222]">
      {/* Progress ring */}
      <div className="relative w-10 h-10 flex-shrink-0">
        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="18" fill="none" stroke="#222" strokeWidth="3" />
          <circle
            cx="20"
            cy="20"
            r="18"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
          {count}
        </span>
      </div>

      <div className="min-w-0">
        <p className="text-xs font-medium text-white">
          {count === 0 ? 'No tasks done' : `${count} done today`}
        </p>
        <p className="text-[10px] text-[#666]">
          {count < nextMilestone ? `${nextMilestone - count} to next milestone` : 'Great job!'}
        </p>
      </div>

      {/* Confetti effect */}
      {showConfetti && (
        <div className="absolute -top-2 -right-2 pointer-events-none">
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full animate-[confetti_1s_ease-out_forwards]"
              style={{
                backgroundColor: ['#FF3300', '#FFD700', '#FF6B00', '#FFF'][i % 4],
                animationDelay: `${i * 0.05}s`,
                transform: `rotate(${i * 45}deg) translateY(-8px)`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
