import { useState, useEffect, useRef, useCallback } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { motion } from 'framer-motion'
import { Check, RotateCcw, X } from 'lucide-react'
import type { CalendarEvent, ViewMode } from '../types'

const HOUR_HEIGHT = 96
const START_HOUR = 6
const END_HOUR = 23
const SLOT_MINUTES = 15

interface CalendarViewProps {
  events: CalendarEvent[]
  viewDate: Date
  viewMode: ViewMode
  onEventUpdate: (id: string, updates: Partial<CalendarEvent>) => void
  onEventDelete: (id: string) => void
  onReschedule?: (event: CalendarEvent) => void
  onComplete?: (event: CalendarEvent) => void
  isTaskDragging?: boolean
}

function formatHour(hour: number): string {
  const h = hour % 12 || 12
  const ampm = hour < 12 ? 'AM' : 'PM'
  return `${h} ${ampm}`
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function dateToString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function DroppableSlot({ id, style, isDraggingAny }: { id: string; style: React.CSSProperties; isDraggingAny?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`absolute transition-all duration-200 rounded-md ${
        isOver
          ? 'bg-accent/10 border border-dashed border-accent/40 scale-[1.01]'
          : isDraggingAny
            ? 'border border-dashed border-border/50 bg-elevated/20'
            : ''
      }`}
    />
  )
}

function DayTargetDropZone({ dateStr, label }: { dateStr: string; label: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-target-${dateStr}` })

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 flex items-center justify-center px-3 py-3 rounded-lg border-2 border-dashed transition-all cursor-default ${
        isOver
          ? 'border-accent bg-accent/15 text-white scale-105'
          : 'border-border bg-elevated/30 text-dim hover:border-border-hover hover:text-secondary'
      }`}
    >
      <span className="text-sm font-medium">{label}</span>
    </div>
  )
}

function CurrentTimeLine({ dayOffset }: { dayOffset?: number }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(interval)
  }, [])

  if (dayOffset !== undefined && dayOffset !== 0) return null

  const minutes = now.getHours() * 60 + now.getMinutes()
  const top = ((minutes - START_HOUR * 60) / 60) * HOUR_HEIGHT

  if (top < 0 || top > (END_HOUR - START_HOUR) * HOUR_HEIGHT) return null

  return (
    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top }}>
      <div className="flex items-center">
        <div className="w-2.5 h-2.5 rounded-full bg-accent -ml-1" style={{ boxShadow: '0 0 8px rgba(139,92,246,0.6)' }} />
        <div className="flex-1 h-[2px] bg-accent" style={{ boxShadow: '0 0 4px rgba(139,92,246,0.4)' }} />
      </div>
    </div>
  )
}

function getPriorityColorFromEventColor(color: string): string {
  // Map event colors to priority border classes
  if (color === '#4A90D9') return 'border-l-medium' // Google event
  return 'border-l-accent'
}

function DayColumn({
  date,
  events,
  dayOffset,
  isMultiDay,
  dragState,
  isTaskDragging,
  onEventMouseDown,
  onEventUpdate,
  onEventDelete,
  onReschedule,
  onComplete,
}: {
  date: Date
  events: CalendarEvent[]
  dayOffset: number
  isMultiDay: boolean
  dragState: DragState | null
  isTaskDragging?: boolean
  onEventMouseDown: (e: React.MouseEvent, eventId: string, type: 'move' | 'resize') => void
  onEventUpdate: (id: string, updates: Partial<CalendarEvent>) => void
  onEventDelete: (id: string) => void
  onReschedule?: (event: CalendarEvent) => void
  onComplete?: (event: CalendarEvent) => void
}) {
  const now = new Date()
  const dateStr = dateToString(date)
  const isToday = dateToString(now) === dateStr
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
  const slotHeight = (SLOT_MINUTES / 60) * HOUR_HEIGHT

  const dayEvents = events.filter((e) => {
    const eventDate = e.date || dateToString(e.start)
    return eventDate === dateStr
  })

  const slots: { id: string; hour: number; minute: number }[] = []
  for (let h = START_HOUR; h < END_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      slots.push({
        id: `slot-${dateStr}-${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        hour: h,
        minute: m,
      })
    }
  }

  function getEventStyle(event: CalendarEvent) {
    const startMin = event.start.getHours() * 60 + event.start.getMinutes()
    const endMin = event.end.getHours() * 60 + event.end.getMinutes()
    const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT
    const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, slotHeight)
    return { top, height }
  }

  const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })

  return (
    <div className={`flex-1 relative ${isMultiDay ? 'border-r border-border last:border-r-0' : ''}`}>
      {isMultiDay && (
        <div className={`sticky top-0 z-30 px-2 py-2 text-center text-xs font-medium border-b border-border ${
          isToday ? 'text-accent bg-accent/[0.06]' : 'text-dim bg-surface/80'
        }`}>
          {dayLabel}
        </div>
      )}

      {hours.map((hour) => (
        <div
          key={hour}
          className="absolute left-0 right-0 border-t border-border/30"
          style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
        />
      ))}

      {slots.map((slot) => {
        const top = ((slot.hour - START_HOUR) * 60 + slot.minute) / 60 * HOUR_HEIGHT
        return (
          <DroppableSlot
            key={slot.id}
            id={slot.id}
            isDraggingAny={isTaskDragging}
            style={{
              top,
              height: slotHeight,
              left: isMultiDay ? 0 : 48,
              right: 0,
            }}
          />
        )
      })}

      {dayEvents.map((event) => {
        const pos = getEventStyle(event)
        const isBeingDragged = dragState?.eventId === event.id
        const completed = event.completed ?? false
        const color = event.color || '#8B5CF6'
        const borderClass = getPriorityColorFromEventColor(color)

        return (
          <motion.div
            key={event.id}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`group absolute rounded-lg select-none transition-all duration-200 border border-border border-l-4 ${borderClass} ${
              event.isGoogleEvent ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
            } ${isBeingDragged ? 'shadow-xl z-30 ring-1 ring-accent/40' : 'shadow-sm z-10 hover:shadow-md'} ${
              completed ? 'opacity-40' : ''
            }`}
            style={{
              top: pos.top,
              height: pos.height,
              left: isMultiDay ? 4 : 52,
              right: 4,
              backgroundColor: `${color}10`,
              minHeight: 24,
              willChange: isBeingDragged ? 'transform' : undefined,
            }}
            onMouseDown={(e) => handleEventMouseDown(e, event.id, 'move')}
          >
            <div className="flex flex-col gap-0.5 h-full px-3 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                {!event.isGoogleEvent && (
                  <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (onComplete) onComplete(event)
                        else onEventUpdate(event.id, { completed: !completed })
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      title={completed ? 'Mark incomplete' : 'Mark done'}
                      className={`w-6 h-6 rounded flex items-center justify-center transition-all cursor-pointer ${
                        completed
                          ? 'bg-success/20 text-success'
                          : 'hover:bg-elevated text-dim hover:text-success'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    {onReschedule && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onReschedule(event)
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        title="Move back to tasks"
                        className="w-6 h-6 rounded flex items-center justify-center hover:bg-elevated text-dim hover:text-primary transition-all cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onEventDelete(event.id)
                      }}
                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-elevated text-dim hover:text-critical transition-all cursor-pointer"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <p className={`text-xs font-medium truncate leading-tight ${completed ? 'line-through text-dim' : 'text-primary'}`}>
                  {event.title}
                </p>
              </div>
              {pos.height > 36 && (
                <p className="text-[10px] text-dim">
                  {formatTime(event.start)} - {formatTime(event.end)}
                </p>
              )}
            </div>

            {!event.isGoogleEvent && (
              <div
                className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize rounded-b-lg hover:bg-white/5"
                onMouseDown={(e) => handleEventMouseDown(e, event.id, 'resize')}
              />
            )}
          </motion.div>
        )
      })}

      {isToday && <CurrentTimeLine dayOffset={dayOffset} />}
    </div>
  )

  function handleEventMouseDown(e: React.MouseEvent, eventId: string, type: 'move' | 'resize') {
    onEventMouseDown(e, eventId, type)
  }
}

type DragState = {
  eventId: string
  type: 'move' | 'resize'
  startY: number
  originalStart: Date
  originalEnd: Date
}

export default function CalendarView({
  events,
  viewDate,
  viewMode,
  onEventUpdate,
  onEventDelete,
  onReschedule,
  onComplete,
  isTaskDragging,
}: CalendarViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const rafRef = useRef<number | null>(null)

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

  const visibleDates: Date[] = []
  if (viewMode === '3-day') {
    for (let i = 0; i < 3; i++) {
      const d = new Date(viewDate)
      d.setDate(d.getDate() + i)
      visibleDates.push(d)
    }
  } else {
    visibleDates.push(new Date(viewDate))
  }

  const dayTargets: { dateStr: string; label: string }[] = []
  if (viewMode === '1-day' && isTaskDragging) {
    for (let i = 1; i <= 3; i++) {
      const d = new Date(viewDate)
      d.setDate(d.getDate() + i)
      const label = i === 1 ? 'Tomorrow' : `+${i} days`
      dayTargets.push({ dateStr: dateToString(d), label })
    }
  }

  function handleEventMouseDown(e: React.MouseEvent, eventId: string, type: 'move' | 'resize') {
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
      if (rafRef.current) cancelAnimationFrame(rafRef.current)

      rafRef.current = requestAnimationFrame(() => {
        const deltaY = e.clientY - dragState.startY
        const deltaMinutes = Math.round(deltaY / (HOUR_HEIGHT / 60) / SLOT_MINUTES) * SLOT_MINUTES

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
      })
    },
    [dragState, onEventUpdate],
  )

  const handleMouseUp = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
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

  useEffect(() => {
    if (containerRef.current) {
      const now = new Date()
      const minutes = now.getHours() * 60 + now.getMinutes()
      const scrollTo = ((minutes - START_HOUR * 60) / 60) * HOUR_HEIGHT - 100
      containerRef.current.scrollTop = Math.max(0, scrollTo)
    }
  }, [])

  return (
    <div className="h-full w-full bg-deep flex flex-col relative overflow-hidden">
      <div className="p-6 border-b border-border bg-surface/80 backdrop-blur-sm z-10">
        <h2 className="text-lg font-semibold text-primary">Schedule</h2>
        <p className="text-secondary text-sm mt-1">Your timeline for today.</p>
      </div>

      {dayTargets.length > 0 && (
        <div className="flex gap-2 p-4 animate-[fadeIn_0.15s_ease-out]">
          {dayTargets.map((target) => (
            <DayTargetDropZone key={target.dateStr} dateStr={target.dateStr} label={target.label} />
          ))}
        </div>
      )}

      <div ref={containerRef} className="flex-1 overflow-y-auto">
        <div className="flex" style={{ minHeight: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}>
          <div className="w-14 flex-shrink-0 relative">
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute left-0 right-0"
                style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
              >
                <span className="absolute -top-2.5 right-3 text-xs font-medium text-secondary">
                  {formatHour(hour)}
                </span>
              </div>
            ))}
          </div>

          {visibleDates.map((date, i) => (
            <DayColumn
              key={dateToString(date)}
              date={date}
              events={events}
              dayOffset={i}
              isMultiDay={viewMode === '3-day'}
              dragState={dragState}
              isTaskDragging={isTaskDragging}
              onEventMouseDown={handleEventMouseDown}
              onEventUpdate={onEventUpdate}
              onEventDelete={onEventDelete}
              onReschedule={onReschedule}
              onComplete={onComplete}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
