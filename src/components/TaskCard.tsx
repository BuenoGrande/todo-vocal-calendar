import { useState } from 'react'
import { motion } from 'framer-motion'
import { Clock, GripVertical, Check, ChevronDown } from 'lucide-react'
import type { TodoItem } from '../types'

interface TaskCardProps {
  todo: TodoItem
  rank?: number
  compact?: boolean
  showCheckbox?: boolean
  isDragging?: boolean
  onComplete?: () => void
  onDurationChange?: (duration: number) => void
  dragHandleProps?: Record<string, unknown>
}

const DURATION_OPTIONS = [5, 15, 30, 45, 60, 90, 120, 180, 240]

function formatDuration(mins: number): string {
  if (mins >= 60) {
    const h = mins / 60
    return h === Math.floor(h) ? `${h}h` : `${h.toFixed(1)}h`
  }
  return `${mins}m`
}

function getRankConfig(rank?: number) {
  if (rank === 1)
    return {
      border: 'border-l-critical',
      text: 'text-primary',
      badge: 'bg-critical/10 text-critical',
      hover: 'hover:border-critical',
      rankBg: 'bg-critical',
      rankText: 'text-white',
    }
  if (rank === 2)
    return {
      border: 'border-l-high',
      text: 'text-primary',
      badge: 'bg-high/10 text-high',
      hover: 'hover:border-high',
      rankBg: 'bg-high',
      rankText: 'text-white',
    }
  if (rank === 3)
    return {
      border: 'border-l-medium',
      text: 'text-primary',
      badge: 'bg-medium/10 text-medium',
      hover: 'hover:border-medium',
      rankBg: 'bg-medium',
      rankText: 'text-white',
    }
  return {
    border: 'border-l-low',
    text: 'text-secondary',
    badge: 'bg-low/10 text-low',
    hover: 'hover:border-border-hover',
    rankBg: 'bg-elevated',
    rankText: 'text-dim',
  }
}

export default function TaskCard({
  todo,
  rank,
  compact = false,
  showCheckbox = false,
  isDragging,
  onComplete,
  onDurationChange,
  dragHandleProps,
}: TaskCardProps) {
  const [showDurationDropdown, setShowDurationDropdown] = useState(false)
  const config = getRankConfig(rank)

  const handleDurationSelect = (duration: number) => {
    onDurationChange?.(duration)
    setShowDurationDropdown(false)
  }

  return (
    <motion.div
      whileHover={!isDragging ? { y: -2 } : {}}
      className={`
        relative rounded-lg border border-border border-l-4 ${config.border} bg-surface
        ${!isDragging ? config.hover : ''}
        ${isDragging ? 'opacity-50 scale-95 shadow-xl' : 'opacity-100 shadow-sm'}
        transition-all duration-200
        ${compact ? 'p-3' : 'p-4'}
        flex items-start gap-3
      `}
    >
      {/* Checkbox */}
      {showCheckbox && onComplete && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onComplete()
          }}
          className="mt-0.5 h-5 w-5 rounded border-2 border-border hover:border-success hover:bg-success/10 flex items-center justify-center transition-all shrink-0 group cursor-pointer"
          title="Complete Task"
        >
          <Check className="w-3 h-3 text-transparent group-hover:text-success transition-colors" />
        </button>
      )}

      {/* Rank Badge */}
      {rank !== undefined && (
        <div
          className={`mt-0.5 ${rank <= 3 ? 'h-6 w-6' : 'h-5 w-5'} rounded ${config.rankBg} flex items-center justify-center shrink-0`}
        >
          <span className={`${rank <= 3 ? 'text-xs font-bold' : 'text-[10px] font-medium'} ${config.rankText}`}>
            {rank}
          </span>
        </div>
      )}

      {/* Drag Handle */}
      {dragHandleProps && !compact && (
        <div {...dragHandleProps} className="mt-0.5 text-dim cursor-grab active:cursor-grabbing shrink-0">
          <GripVertical className="w-4 h-4" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <h3 className={`font-medium ${compact ? 'text-sm' : 'text-base'} ${config.text} truncate`}>
            {todo.title}
          </h3>

          {compact && onComplete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onComplete()
              }}
              className="h-5 w-5 rounded border border-border hover:border-success hover:bg-success/10 text-transparent hover:text-success flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              title="Complete Task"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 mt-2">
          {onDurationChange ? (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowDurationDropdown(!showDurationDropdown)
                }}
                className={`flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.badge} hover:ring-1 hover:ring-current transition-all cursor-pointer`}
              >
                <Clock className="w-3 h-3 mr-1" />
                {formatDuration(todo.duration)}
                <ChevronDown className="w-3 h-3 ml-1" />
              </button>

              {showDurationDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowDurationDropdown(false)} />
                  <div className="absolute left-full top-0 ml-2 bg-elevated border border-border rounded-lg shadow-xl z-20 py-1 min-w-[80px]">
                    {DURATION_OPTIONS.map((dur) => (
                      <button
                        key={dur}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDurationSelect(dur)
                        }}
                        className={`w-full px-3 py-1.5 text-xs text-left hover:bg-surface transition-colors cursor-pointer ${
                          dur === todo.duration ? 'text-accent font-medium' : 'text-primary'
                        }`}
                      >
                        {formatDuration(dur)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className={`flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.badge}`}>
              <Clock className="w-3 h-3 mr-1" />
              {formatDuration(todo.duration)}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
