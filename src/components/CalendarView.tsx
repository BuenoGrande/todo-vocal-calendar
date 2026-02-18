import { useState, useEffect, useRef, useCallback } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { CalendarEvent } from '../types'

const HOUR_HEIGHT = 96
const START_HOUR = 6
const END_HOUR = 23
const SLOT_MINUTES = 5

interface CalendarViewProps {
  events: CalendarEvent[]
  onEventUpdate: (id: string, updates: Partial<CalendarEvent>) => void
  onEventDelete: (id: string) => void
  onReschedule?: (event: CalendarEvent) => void
}

function formatHour(hour: number): string {
  const h = hour % 12 || 12
  const ampm = hour < 12 ? 'AM' : 'PM'
  return `${h} ${ampm}`
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function DroppableSlot({ id, style }: { id: string; style: React.CSSProperties }) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`absolute transition-colors ${isOver ? 'bg-indigo-100/60' : ''}`}
    />
  )
}

function CurrentTimeLine() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(interval)
  }, [])

  const minutes = now.getHours() * 60 + now.getMinutes()
  const top = ((minutes - START_HOUR * 60) / 60) * HOUR_HEIGHT

  if (top < 0 || top > (END_HOUR - START_HOUR) * HOUR_HEIGHT) return null

  return (
    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top }}>
      <div className="flex items-center">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1" />
        <div className="flex-1 h-[2px] bg-red-500" />
      </div>
    </div>
  )
}

function CompletionCheckbox({
  checked,
  onChange,
  color,
}: {
  checked: boolean
  onChange: (val: boolean) => void
  color: string
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      onMouseDown={(e) => e.stopPropagation()}
      className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${
        checked
          ? 'completion-check'
          : 'hover:scale-110'
      }`}
      style={{
        borderColor: checked ? color : undefined,
        backgroundColor: checked ? color : undefined,
      }}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  )
}

export default function CalendarView({
  events,
  onEventUpdate,
  onEventDelete,
  onReschedule,
}: CalendarViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragState, setDragState] = useState<{
    eventId: string
    type: 'move' | 'resize'
    startY: number
    originalStart: Date
    originalEnd: Date
  } | null>(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(interval)
  }, [])

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

  // Generate droppable slots
  const slots: { id: string; hour: number; minute: number }[] = []
  for (let h = START_HOUR; h < END_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      slots.push({
        id: `slot-${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        hour: h,
        minute: m,
      })
    }
  }

  const slotHeight = (SLOT_MINUTES / 60) * HOUR_HEIGHT

  function getEventStyle(event: CalendarEvent) {
    const startMin = event.start.getHours() * 60 + event.start.getMinutes()
    const endMin = event.end.getHours() * 60 + event.end.getMinutes()
    const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT
    const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, slotHeight)
    return { top, height }
  }

  function isOverdue(event: CalendarEvent): boolean {
    return event.end < now && !event.completed && !event.isGoogleEvent
  }

  function handleEventMouseDown(
    e: React.MouseEvent,
    eventId: string,
    type: 'move' | 'resize',
  ) {
    e.preventDefault()
    e.stopPropagation()
    const event = events.find((ev) => ev.id === eventId)
    if (!event || event.isGoogleEvent) return
    setDragState({
      eventId,
      type,
      startY: e.clientY,
      originalStart: new Date(event.start),
      originalEnd: new Date(event.end),
    })
  }

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragState) return
      const deltaY = e.clientY - dragState.startY
      const deltaMinutes =
        Math.round(deltaY / (HOUR_HEIGHT / 60) / SLOT_MINUTES) * SLOT_MINUTES

      if (dragState.type === 'move') {
        const newStart = new Date(dragState.originalStart.getTime() + deltaMinutes * 60000)
        const newEnd = new Date(dragState.originalEnd.getTime() + deltaMinutes * 60000)
        if (newStart.getHours() >= START_HOUR && newEnd.getHours() <= END_HOUR) {
          onEventUpdate(dragState.eventId, { start: newStart, end: newEnd })
        }
      } else {
        const newEnd = new Date(dragState.originalEnd.getTime() + deltaMinutes * 60000)
        if (
          newEnd.getTime() > dragState.originalStart.getTime() + SLOT_MINUTES * 60000 &&
          newEnd.getHours() <= END_HOUR
        ) {
          onEventUpdate(dragState.eventId, { end: newEnd })
        }
      }
    },
    [dragState, onEventUpdate],
  )

  const handleMouseUp = useCallback(() => {
    setDragState(null)
  }, [])

  useEffect(() => {
    if (!dragState) return
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState, handleMouseMove, handleMouseUp])

  // Scroll to current time on mount
  useEffect(() => {
    if (containerRef.current) {
      const now = new Date()
      const minutes = now.getHours() * 60 + now.getMinutes()
      const scrollTo = ((minutes - START_HOUR * 60) / 60) * HOUR_HEIGHT - 100
      containerRef.current.scrollTop = Math.max(0, scrollTo)
    }
  }, [])

  const today = new Date()
  const dayLabel = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Today</h2>
          <p className="text-xs text-gray-400">{dayLabel}</p>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto min-h-0 bg-white rounded-xl border border-gray-100 shadow-sm"
      >
        <div
          className="relative"
          style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}
        >
          {/* Hour lines */}
          {hours.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-gray-100"
              style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
            >
              <span className="absolute -top-2.5 left-2 text-[10px] font-medium text-gray-400 bg-white px-1">
                {formatHour(hour)}
              </span>
            </div>
          ))}

          {/* Droppable slots */}
          {slots.map((slot) => {
            const top = ((slot.hour - START_HOUR) * 60 + slot.minute) / 60 * HOUR_HEIGHT
            return (
              <DroppableSlot
                key={slot.id}
                id={slot.id}
                style={{
                  top,
                  height: slotHeight,
                  left: 48,
                  right: 0,
                }}
              />
            )
          })}

          {/* Events */}
          {events.map((event) => {
            const pos = getEventStyle(event)
            const isBeingDragged = dragState?.eventId === event.id
            const overdue = isOverdue(event)
            const completed = event.completed ?? false
            return (
              <div
                key={event.id}
                className={`group absolute left-12 right-2 rounded-lg px-3 py-1.5 select-none transition-all ${
                  event.isGoogleEvent
                    ? 'cursor-default'
                    : 'cursor-grab active:cursor-grabbing'
                } ${isBeingDragged ? 'shadow-lg z-30 ring-2 ring-indigo-400/40' : 'shadow-sm z-10'} ${
                  completed ? 'opacity-50' : ''
                } ${overdue ? 'ring-1 ring-amber-400/60' : ''}`}
                style={{
                  top: pos.top,
                  height: pos.height,
                  backgroundColor: event.color + '18',
                  borderLeft: `3px solid ${event.color}`,
                  minHeight: 24,
                }}
                onMouseDown={(e) => handleEventMouseDown(e, event.id, 'move')}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    {/* Completion checkbox */}
                    {!event.isGoogleEvent && (
                      <div className="mt-px">
                        <CompletionCheckbox
                          checked={completed}
                          onChange={(val) => onEventUpdate(event.id, { completed: val })}
                          color={event.color}
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-medium text-gray-800 truncate leading-tight ${completed ? 'line-through text-gray-400' : ''}`}>
                        {event.title}
                      </p>
                      {pos.height > 36 && (
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {formatTime(event.start)} - {formatTime(event.end)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {/* Reschedule button for overdue */}
                    {overdue && onReschedule && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onReschedule(event)
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        title="Move back to tasks"
                        className="text-amber-500 hover:text-amber-600 transition-colors cursor-pointer mt-0.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    )}
                    {/* Delete button */}
                    {!event.isGoogleEvent && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onEventDelete(event.id)
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:!opacity-100 text-gray-400 hover:text-red-400 transition-opacity flex-shrink-0 mt-0.5 cursor-pointer"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Resize handle */}
                {!event.isGoogleEvent && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize rounded-b-lg hover:bg-black/5"
                    onMouseDown={(e) => handleEventMouseDown(e, event.id, 'resize')}
                  />
                )}
              </div>
            )
          })}

          {/* Current time indicator */}
          <CurrentTimeLine />
        </div>
      </div>
    </div>
  )
}
