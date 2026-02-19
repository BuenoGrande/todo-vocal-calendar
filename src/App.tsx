import { useState, useCallback, useEffect, useRef } from 'react'
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { TodoItem, CalendarEvent, ViewMode } from './types'
import { parseTasks, scheduleWithAI } from './services/llm'
import { scheduleLocally } from './services/localScheduler'
import {
  fetchEventsForDateRange,
  createGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
} from './services/googleCalendar'
import {
  fetchTasks,
  createTask,
  updateTask,
  deleteTask,
  reorderTasks,
  fetchEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getCompletionStats,
  incrementCompletionStats,
} from './services/database'
import { useAuth } from './contexts/AuthContext'
import GoogleCalendarButton from './components/GoogleCalendarButton'
import VoiceInput from './components/VoiceInput'
import TodoList from './components/TodoList'
import CalendarView from './components/CalendarView'
import DayNavigation from './components/DayNavigation'
import CompletionCounter from './components/CompletionCounter'
import LoginScreen from './components/LoginScreen'
import AnimatedBackground from './components/AnimatedBackground'

const EVENT_COLORS = ['#6366f1', '#8b5cf6', '#3b82f6', '#06b6d4', '#f59e0b', '#ec4899']
const GOOGLE_EVENT_COLOR = '#3b82f6'

function dateToString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function App() {
  const { user, googleToken, loading, signInWithGoogle } = useAuth()
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [isScheduling, setIsScheduling] = useState(false)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [viewDate, setViewDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('1-day')
  const [completedToday, setCompletedToday] = useState(0)
  const [dataLoaded, setDataLoaded] = useState(false)
  const googleFetchedRef = useRef(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // Load data from Supabase on auth
  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function loadData() {
      try {
        const [tasks, stats] = await Promise.all([
          fetchTasks(),
          getCompletionStats(dateToString(new Date())),
        ])
        if (cancelled) return
        setTodos(tasks)
        setCompletedToday(stats.tasksCompleted)
        setDataLoaded(true)
      } catch (err) {
        console.error('Failed to load data:', err)
      }
    }

    loadData()
    return () => { cancelled = true }
  }, [user])

  // Load events for visible date range
  useEffect(() => {
    if (!user || !dataLoaded) return
    let cancelled = false

    async function loadEvents() {
      const start = new Date(viewDate)
      start.setHours(0, 0, 0, 0)
      const end = new Date(viewDate)
      if (viewMode === '3-day') end.setDate(end.getDate() + 2)
      end.setHours(23, 59, 59, 999)

      try {
        const events = await fetchEvents(dateToString(start), dateToString(end))
        if (cancelled) return
        setCalendarEvents((prev) => {
          // Keep google-origin events that may have been fetched, merge with DB events
          const googleEvents = prev.filter((e) => e.isGoogleEvent)
          const dbIds = new Set(events.map((e) => e.id))
          const nonConflictingGoogle = googleEvents.filter((e) => !dbIds.has(e.id))
          return [...events, ...nonConflictingGoogle]
        })
      } catch (err) {
        console.error('Failed to load events:', err)
      }
    }

    loadEvents()
    return () => { cancelled = true }
  }, [user, viewDate, viewMode, dataLoaded])

  // Fetch Google Calendar events when token is available
  useEffect(() => {
    if (!googleToken || !user || googleFetchedRef.current) return
    googleFetchedRef.current = true

    async function fetchGoogleEvents() {
      try {
        const start = new Date(viewDate)
        start.setHours(0, 0, 0, 0)
        const end = new Date(viewDate)
        if (viewMode === '3-day') end.setDate(end.getDate() + 2)
        end.setHours(23, 59, 59, 999)

        const events = await fetchEventsForDateRange(googleToken!, start, end)
        const mapped: CalendarEvent[] = events.map(
          (e: { id: string; title: string; start: Date; end: Date }) => ({
            id: `google-${e.id}`,
            title: e.title,
            start: e.start,
            end: e.end,
            googleEventId: e.id,
            isGoogleEvent: true,
            color: GOOGLE_EVENT_COLOR,
            date: dateToString(e.start),
          }),
        )
        setCalendarEvents((prev) => {
          const nonGoogle = prev.filter((e) => !e.isGoogleEvent)
          return [...nonGoogle, ...mapped]
        })
      } catch (err) {
        console.error('Failed to fetch Google Calendar events:', err)
      }
    }

    fetchGoogleEvents()
  }, [googleToken, user, viewDate, viewMode])

  // Add todo
  async function handleAddTodo(title: string, duration: number) {
    if (!user) return
    const priority = todos.length
    const tempId = crypto.randomUUID()
    const newTodo: TodoItem = { id: tempId, title, duration, priority }

    // Optimistic update
    setTodos((prev) => [...prev, newTodo])

    try {
      const created = await createTask({ title, duration, priority }, user.id)
      setTodos((prev) => prev.map((t) => (t.id === tempId ? created : t)))
      await incrementCompletionStats(user.id, dateToString(new Date()), 'tasks_created')
    } catch (err) {
      console.error('Failed to create task:', err)
      setTodos((prev) => prev.filter((t) => t.id !== tempId))
      showToast('Failed to save task')
    }
  }

  // Update todo
  async function handleUpdateTodo(id: string, updates: Partial<TodoItem>) {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)))
    try {
      await updateTask(id, updates)
    } catch (err) {
      console.error('Failed to update task:', err)
    }
  }

  // Delete todo
  async function handleDeleteTodo(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id))
    try {
      await deleteTask(id)
    } catch (err) {
      console.error('Failed to delete task:', err)
    }
  }

  // Voice transcription handler
  const handleTranscription = useCallback(
    async (text: string) => {
      if (!user) return
      try {
        showToast('Parsing tasks...')
        const tasks = await parseTasks(text)
        const sorted = [...tasks].sort((a, b) => a.priority - b.priority)
        const newTodos: TodoItem[] = sorted.map((t, i) => ({
          id: crypto.randomUUID(),
          title: t.title,
          duration: t.duration,
          priority: i,
          timePreference: t.timePreference,
        }))

        // Optimistic update
        setTodos((prev) => {
          const renumbered = prev.map((t, i) => ({ ...t, priority: newTodos.length + i }))
          return [...newTodos, ...renumbered]
        })

        // Persist to Supabase
        const createdTodos: TodoItem[] = []
        for (const todo of newTodos) {
          try {
            const created = await createTask(
              { title: todo.title, duration: todo.duration, priority: todo.priority, timePreference: todo.timePreference },
              user.id,
            )
            createdTodos.push(created)
            await incrementCompletionStats(user.id, dateToString(new Date()), 'tasks_created')
          } catch (err) {
            console.error('Failed to create task:', err)
          }
        }

        // Replace temp IDs with real ones
        setTodos((prev) => {
          let updated = [...prev]
          for (let i = 0; i < newTodos.length; i++) {
            if (createdTodos[i]) {
              updated = updated.map((t) => (t.id === newTodos[i].id ? createdTodos[i] : t))
            }
          }
          // Reorder existing tasks in DB
          const existing = updated.filter((t) => !newTodos.some((n) => n.id === t.id))
          reorderTasks(existing.map((t, i) => ({ id: t.id, priority: newTodos.length + i }))).catch(console.error)
          return updated
        })

        showToast(`Added ${newTodos.length} task${newTodos.length !== 1 ? 's' : ''}`)
      } catch (err) {
        console.error('Task parsing error:', err)
        showToast(`Parsing failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    },
    [user],
  )

  // AI scheduling with optimistic local preview
  async function handleAISchedule() {
    if (todos.length === 0 || !user) return
    setIsScheduling(true)

    // Optimistic: show local schedule immediately with shimmer
    const localSchedule = scheduleLocally(todos, calendarEvents, viewDate)
    const placeholderEvents: CalendarEvent[] = []
    const placeholderTodoIds: string[] = []

    for (const item of localSchedule) {
      const todo = todos.find((t) => t.title === item.title)
      if (!todo) continue

      const [hours, minutes] = item.startTime.split(':').map(Number)
      const start = new Date(viewDate)
      start.setHours(hours, minutes, 0, 0)
      const end = new Date(start.getTime() + item.duration * 60000)

      placeholderEvents.push({
        id: `placeholder-${crypto.randomUUID()}`,
        title: todo.title,
        start,
        end,
        todoId: todo.id,
        color: EVENT_COLORS[placeholderEvents.length % EVENT_COLORS.length],
        date: dateToString(start),
      })
      placeholderTodoIds.push(todo.id)
    }

    // Show placeholders immediately
    setCalendarEvents((prev) => [...prev, ...placeholderEvents])
    setTodos((prev) => prev.filter((t) => !placeholderTodoIds.includes(t.id)))

    try {
      const schedule = await scheduleWithAI(todos, calendarEvents)
      // Remove placeholders
      setCalendarEvents((prev) => prev.filter((e) => !e.id.startsWith('placeholder-')))

      const newEvents: CalendarEvent[] = []
      const scheduledTodoIds: string[] = []

      for (const item of schedule) {
        const todo = todos.find((t) => t.title === item.title)
        if (!todo) continue

        const [hours, minutes] = item.startTime.split(':').map(Number)
        const start = new Date(viewDate)
        start.setHours(hours, minutes, 0, 0)
        const end = new Date(start.getTime() + item.duration * 60000)
        const color = EVENT_COLORS[newEvents.length % EVENT_COLORS.length]
        const dateStr = dateToString(start)

        const eventData: Omit<CalendarEvent, 'id'> = {
          title: todo.title,
          start,
          end,
          todoId: todo.id,
          color,
          date: dateStr,
        }

        // Create in Google Calendar if connected
        if (googleToken) {
          try {
            const googleId = await createGoogleEvent(googleToken, { title: todo.title, start, end })
            eventData.googleEventId = googleId
          } catch (err) {
            console.error('Failed to create Google event:', err)
          }
        }

        // Persist to Supabase
        const created = await createEvent(eventData, user.id)
        newEvents.push(created)
        scheduledTodoIds.push(todo.id)

        // Delete the task from DB
        await deleteTask(todo.id)
      }

      setCalendarEvents((prev) => {
        const withoutPlaceholders = prev.filter((e) => !e.id.startsWith('placeholder-'))
        return [...withoutPlaceholders, ...newEvents]
      })
      // Ensure todos that were scheduled are removed
      setTodos((prev) => prev.filter((t) => !scheduledTodoIds.includes(t.id) && !placeholderTodoIds.includes(t.id)))
      showToast(`Scheduled ${newEvents.length} task${newEvents.length !== 1 ? 's' : ''}`)
    } catch (err) {
      console.error('AI scheduling error:', err)
      // Revert: remove placeholders, add todos back
      setCalendarEvents((prev) => prev.filter((e) => !e.id.startsWith('placeholder-')))
      // Reload from DB
      const tasks = await fetchTasks()
      setTodos(tasks)
      showToast(`Scheduling failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsScheduling(false)
    }
  }

  // Calendar event updates
  const handleEventUpdate = useCallback(
    async (id: string, updates: Partial<CalendarEvent>) => {
      setCalendarEvents((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...updates } : e)),
      )
      // Skip DB update for placeholder events
      if (id.startsWith('placeholder-')) return
      try {
        await updateEvent(id, updates)
      } catch (err) {
        console.error('Failed to update event:', err)
      }
    },
    [],
  )

  // Complete event
  const handleComplete = useCallback(
    async (event: CalendarEvent) => {
      if (!user) return
      const newCompleted = !event.completed
      setCalendarEvents((prev) =>
        prev.map((e) => (e.id === event.id ? { ...e, completed: newCompleted } : e)),
      )
      if (newCompleted) {
        setCompletedToday((c) => c + 1)
        await incrementCompletionStats(user.id, dateToString(new Date()), 'tasks_completed')
      }
      try {
        await updateEvent(event.id, { completed: newCompleted })
      } catch (err) {
        console.error('Failed to update completion:', err)
      }
    },
    [user],
  )

  const handleEventDelete = useCallback(
    async (id: string) => {
      const event = calendarEvents.find((e) => e.id === id)
      if (event?.googleEventId && googleToken && !event.isGoogleEvent) {
        try {
          await deleteGoogleEvent(googleToken, event.googleEventId)
        } catch (err) {
          console.error('Failed to delete Google event:', err)
        }
      }
      setCalendarEvents((prev) => prev.filter((e) => e.id !== id))
      if (!id.startsWith('placeholder-')) {
        try {
          await deleteEvent(id)
        } catch (err) {
          console.error('Failed to delete event from DB:', err)
        }
      }
    },
    [calendarEvents, googleToken],
  )

  // Reschedule: move calendar event back to todo list
  const handleReschedule = useCallback(
    async (event: CalendarEvent) => {
      if (!user) return
      // Delete from Google Calendar if synced
      if (event.googleEventId && googleToken && !event.isGoogleEvent) {
        try {
          await deleteGoogleEvent(googleToken, event.googleEventId)
        } catch (err) {
          console.error('Failed to delete Google event:', err)
        }
      }
      // Remove from calendar
      setCalendarEvents((prev) => prev.filter((e) => e.id !== event.id))
      await deleteEvent(event.id).catch(console.error)

      // Create new todo
      const duration = Math.round((event.end.getTime() - event.start.getTime()) / 60000)
      const priority = todos.length
      const created = await createTask({ title: event.title, duration, priority }, user.id)
      setTodos((prev) => [...prev, created])
      showToast(`"${event.title}" moved back to tasks`)
    },
    [googleToken, todos.length, user],
  )

  // DnD handlers
  function handleDragStart(event: { active: { id: string | number } }) {
    setActiveDragId(String(event.active.id))
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null)
    const { active, over } = event
    if (!over || !user) return

    const activeId = String(active.id)
    const overId = String(over.id)

    if (overId.startsWith('slot-')) {
      // Dropped on calendar slot — parse date and time from slot id
      const todo = todos.find((t) => t.id === activeId)
      if (!todo) return

      // slot id format: slot-YYYY-MM-DD-HH:MM or slot-HH:MM (single day)
      let dateStr: string
      let timeStr: string

      const parts = overId.replace('slot-', '')
      const dateMatch = parts.match(/^(\d{4}-\d{2}-\d{2})-(\d{2}:\d{2})$/)
      if (dateMatch) {
        dateStr = dateMatch[1]
        timeStr = dateMatch[2]
      } else {
        dateStr = dateToString(viewDate)
        timeStr = parts
      }

      const [hours, minutes] = timeStr.split(':').map(Number)
      const [year, month, day] = dateStr.split('-').map(Number)
      const start = new Date(year, month - 1, day, hours, minutes, 0, 0)
      const end = new Date(start.getTime() + todo.duration * 60000)
      const color = EVENT_COLORS[calendarEvents.filter((e) => !e.isGoogleEvent).length % EVENT_COLORS.length]

      const eventData: Omit<CalendarEvent, 'id'> = {
        title: todo.title,
        start,
        end,
        todoId: todo.id,
        color,
        date: dateStr,
      }

      // Create in Google Calendar if connected
      if (googleToken) {
        createGoogleEvent(googleToken, { title: todo.title, start, end })
          .then((googleId) => {
            setCalendarEvents((prev) =>
              prev.map((e) => (e.todoId === todo.id ? { ...e, googleEventId: googleId } : e)),
            )
            updateEvent(todo.id, { googleEventId: googleId }).catch(console.error)
          })
          .catch((err) => console.error('Failed to create Google event:', err))
      }

      // Persist to Supabase
      try {
        const created = await createEvent(eventData, user.id)
        setCalendarEvents((prev) => [...prev, created])
      } catch (err) {
        console.error('Failed to create event:', err)
        // Fallback: add optimistic
        setCalendarEvents((prev) => [...prev, { id: crypto.randomUUID(), ...eventData }])
      }

      setTodos((prev) => prev.filter((t) => t.id !== activeId))
      await deleteTask(activeId).catch(console.error)
    } else {
      // Reorder within todo list
      if (activeId !== overId) {
        setTodos((prev) => {
          const oldIndex = prev.findIndex((t) => t.id === activeId)
          const newIndex = prev.findIndex((t) => t.id === overId)
          if (oldIndex === -1 || newIndex === -1) return prev
          const reordered = arrayMove(prev, oldIndex, newIndex)
          // Persist priority order
          reorderTasks(reordered.map((t, i) => ({ id: t.id, priority: i }))).catch(console.error)
          return reordered
        })
      }
    }
  }

  // Sync event to Google Calendar after drag/resize
  const syncEventToGoogle = useCallback(
    async (eventId: string) => {
      if (!googleToken) return
      const event = calendarEvents.find((e) => e.id === eventId)
      if (!event || event.isGoogleEvent || !event.googleEventId) return
      try {
        await updateGoogleEvent(googleToken, event.googleEventId, {
          title: event.title,
          start: event.start,
          end: event.end,
        })
      } catch (err) {
        console.error('Failed to sync event to Google:', err)
      }
    },
    [googleToken, calendarEvents],
  )

  // Listen for mouseup to sync calendar events after drag/resize
  useEffect(() => {
    function handleGlobalMouseUp() {
      calendarEvents
        .filter((e) => !e.isGoogleEvent && e.googleEventId)
        .forEach((e) => syncEventToGoogle(e.id))
    }
    document.addEventListener('mouseup', handleGlobalMouseUp)
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [calendarEvents, syncEventToGoogle])

  const activeTodo = activeDragId ? todos.find((t) => t.id === activeDragId) : null

  // Loading state
  if (loading) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="text-white text-2xl font-black animate-pulse">SHOUT</div>
      </div>
    )
  }

  // Not authenticated
  if (!user) {
    return <LoginScreen onSignIn={signInWithGoogle} />
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-screen flex flex-col bg-black font-sans relative">
        <AnimatedBackground />

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-black text-white tracking-tight">
              SH<span className="text-white/60">OU</span>T
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <CompletionCounter count={completedToday} />
            <GoogleCalendarButton />
          </div>
        </header>

        {/* Main content */}
        <div className="relative z-10 flex flex-1 overflow-hidden">
          {/* Todo panel */}
          <div className="w-[420px] flex-shrink-0 p-4 border-r border-[#1a1a1a]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-white">Tasks</h2>
              <span className="text-xs text-[#555] font-medium">
                {todos.length} {todos.length === 1 ? 'task' : 'tasks'}
              </span>
            </div>

            {/* Voice input + AI Schedule */}
            <div className="flex items-center gap-2 mb-4">
              <VoiceInput onTranscription={handleTranscription} />
              <button
                onClick={handleAISchedule}
                disabled={todos.length === 0 || isScheduling}
                title="AI auto-schedule all tasks"
                className="flex-1 h-9 px-3 rounded-lg bg-white text-black text-sm font-semibold hover:bg-white/90 hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isScheduling ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
                AI Schedule
              </button>
            </div>

            <TodoList
              todos={todos}
              onAddTodo={handleAddTodo}
              onUpdateTodo={handleUpdateTodo}
              onDeleteTodo={handleDeleteTodo}
            />
          </div>

          {/* Calendar panel */}
          <div className="flex-1 p-4 overflow-hidden flex flex-col gap-3">
            <DayNavigation
              viewDate={viewDate}
              viewMode={viewMode}
              onDateChange={setViewDate}
              onViewModeChange={setViewMode}
            />
            <CalendarView
              events={calendarEvents}
              viewDate={viewDate}
              viewMode={viewMode}
              onEventUpdate={handleEventUpdate}
              onEventDelete={handleEventDelete}
              onReschedule={handleReschedule}
              onComplete={handleComplete}
            />
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-[#1a1a1a] text-white text-sm rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.2s_ease-out]">
            {toast}
          </div>
        )}

        {/* Drag overlay */}
        <DragOverlay>
          {activeTodo ? (
            <div className="px-4 py-2.5 bg-[#111] rounded-xl border border-white/20 shadow-xl text-sm text-white font-medium max-w-[300px] truncate">
              {activeTodo.title}
              <span className="ml-2 text-xs text-[#888]">{activeTodo.duration}m</span>
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  )
}
