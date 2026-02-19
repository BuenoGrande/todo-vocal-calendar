import { useState, useEffect, useRef, useCallback } from 'react'
import { useDroppable } from '@dnd-kit/core'
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

function DroppableSlot({ id, style }: { id: string; style: React.CSSProperties }) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`absolute transition-colors ${isOver ? 'bg-white/5' : ''}`}
    />
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
        <div className="w-2.5 h-2.5 rounded-full bg-[#FF3300] -ml-1 shadow-[0_0_8px_rgba(255,51,0,0.6)]" />
        <div className="flex-1 h-[2px] bg-[#FF3300] shadow-[0_0_4px_rgba(255,51,0,0.4)]" />
      </div>
    </div>
  )
}

function DayColumn({
  date,
  events,
  dayOffset,
  isMultiDay,
  dragState,
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

  // Filter events for this day
  const dayEvents = events.filter((e) => {
    const eventDate = e.date || dateToString(e.start)
    return eventDate === dateStr
  })

  // Generate droppable slots
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
    <div className={`flex-1 relative ${isMultiDay ? 'border-r border-[#1a1a1a] last:border-r-0' : ''}`}>
      {/* Day header for multi-day view */}
      {isMultiDay && (
        <div className={`sticky top-0 z-30 px-2 py-2 text-center text-xs font-medium border-b border-[#1a1a1a] ${
          isToday ? 'text-white bg-white/5' : 'text-[#666] bg-[#0a0a0a]'
        }`}>
          {dayLabel}
        </div>
      )}

      {/* Hour lines */}
      {hours.map((hour) => (
        <div
          key={hour}
          className="absolute left-0 right-0 border-t border-[#1a1a1a]"
          style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
        />
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
              left: isMultiDay ? 0 : 48,
              right: 0,
            }}
          />
        )
      })}

      {/* Events */}
      {dayEvents.map((event) => {
        const pos = getEventStyle(event)
        const isBeingDragged = dragState?.eventId === event.id
        const completed = event.completed ?? false

        return (
          <div
            key={event.id}
            className={`group absolute rounded-lg px-3 py-1.5 select-none transition-all duration-200 ${
              event.isGoogleEvent
                ? 'cursor-default'
                : 'cursor-grab active:cursor-grabbing'
            } ${isBeingDragged ? 'shadow-lg shadow-[#FF3300]/20 z-30 ring-1 ring-[#FF3300]/40' : 'shadow-sm z-10 hover:shadow-md hover:shadow-black/20'} ${
              completed ? 'opacity-40' : ''
            }`}
            style={{
              top: pos.top,
              height: pos.height,
              left: isMultiDay ? 4 : 52,
              right: 4,
              backgroundColor: event.color + '18',
              borderLeft: `3px solid ${event.color}`,
              minHeight: 24,
              willChange: isBeingDragged ? 'transform' : undefined,
            }}
            onMouseDown={(e) => handleEventMouseDown(e, event.id, 'move')}
          >
            <div className="flex flex-col gap-0.5 h-full">
              <div className="flex items-center gap-2 min-w-0">
                {/* Action buttons inline with title */}
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
                      className={`w-7 h-7 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                        completed
                          ? 'bg-white/20 text-white !opacity-100'
                          : 'hover:bg-white/10 text-[#888] hover:text-white'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    {onReschedule && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onReschedule(event)
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        title="Move back to tasks"
                        className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10 text-[#888] hover:text-white transition-all cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onEventDelete(event.id)
                      }}
                      className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10 text-[#888] hover:text-red-400 transition-all cursor-pointer"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                <p className={`text-xs font-medium truncate leading-tight ${completed ? 'line-through text-[#555]' : 'text-[#ddd]'}`}>
                  {event.title}
                </p>
              </div>
              {pos.height > 36 && (
                <p className="text-[10px] text-[#555]">
                  {formatTime(event.start)} - {formatTime(event.end)}
                </p>
              )}
            </div>

            {/* Resize handle */}
            {!event.isGoogleEvent && (
              <div
                className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize rounded-b-lg hover:bg-white/5"
                onMouseDown={(e) => handleEventMouseDown(e, event.id, 'resize')}
              />
            )}
          </div>
        )
      })}

      {/* Current time indicator */}
      {isToday && <CurrentTimeLine dayOffset={dayOffset} />}
    </div>
  )

  function handleEventMouseDown(
    e: React.MouseEvent,
    eventId: string,
    type: 'move' | 'resize',
  ) {
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
}: CalendarViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const rafRef = useRef<number | null>(null)

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

  // Compute visible dates
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

      if (rafRef.current) cancelAnimationFrame(rafRef.current)

      rafRef.current = requestAnimationFrame(() => {
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

  // Scroll to current time on mount
  useEffect(() => {
    if (containerRef.current) {
      const now = new Date()
      const minutes = now.getHours() * 60 + now.getMinutes()
      const scrollTo = ((minutes - START_HOUR * 60) / 60) * HOUR_HEIGHT - 100
      containerRef.current.scrollTop = Math.max(0, scrollTo)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto min-h-0 bg-[#0a0a0a] rounded-xl border border-[#1a1a1a]"
    >
      <div className="flex" style={{ minHeight: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}>
        {/* Time labels column */}
        <div className="w-12 flex-shrink-0 relative">
          {hours.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0"
              style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
            >
              <span className="absolute -top-2.5 left-2 text-[10px] font-medium text-[#444]">
                {formatHour(hour)}
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {visibleDates.map((date, i) => (
          <DayColumn
            key={dateToString(date)}
            date={date}
            events={events}
            dayOffset={i}
            isMultiDay={viewMode === '3-day'}
            dragState={dragState}
            onEventMouseDown={handleEventMouseDown}
            onEventUpdate={onEventUpdate}
            onEventDelete={onEventDelete}
            onReschedule={onReschedule}
            onComplete={onComplete}
          />
        ))}
      </div>
    </div>
  )
}
