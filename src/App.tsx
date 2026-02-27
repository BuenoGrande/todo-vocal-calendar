import { useState, useCallback, useEffect } from 'react'
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
import { parseTasks } from './services/llm'
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
  fetchRecentStats,
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

const EVENT_COLORS = ['#FF3300', '#FF6B00', '#FF9500', '#FFB800', '#E8401A', '#FF4D1A']
const GOOGLE_EVENT_COLOR = '#4A90D9'

function dateToString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function computeStreak(stats: { date: string; tasksCompleted: number }[]): number {
  const completedDates = new Set(stats.filter((s) => s.tasksCompleted > 0).map((s) => s.date))
  let streak = 0
  // Start from yesterday, count consecutive days backwards
  for (let i = 1; i <= 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (completedDates.has(dateStr)) {
      streak++
    } else {
      break
    }
  }
  return streak
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
  const [streak, setStreak] = useState(0)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [nextTaskSuggestion, setNextTaskSuggestion] = useState<{
    taskName: string
    taskId: string
    freeFrom: Date
    duration: number
  } | null>(null)

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
        const [tasks, stats, recentStats] = await Promise.all([
          fetchTasks(),
          getCompletionStats(dateToString(new Date())),
          fetchRecentStats(7),
        ])
        if (cancelled) return
        setTodos(tasks)
        setCompletedToday(stats.tasksCompleted)
        setStreak(computeStreak(recentStats))
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
          // Keep Google-origin events, but skip ones that duplicate app-created events
          const googleEvents = prev.filter((e) => e.isGoogleEvent)
          const dbGoogleIds = new Set(
            events.filter((e) => e.googleEventId).map((e) => e.googleEventId),
          )
          const dedupedGoogle = googleEvents.filter(
            (e) => !dbGoogleIds.has(e.googleEventId),
          )
          return [...events, ...dedupedGoogle]
        })
      } catch (err) {
        console.error('Failed to load events:', err)
      }
    }

    loadEvents()
    return () => { cancelled = true }
  }, [user, viewDate, viewMode, dataLoaded])

  // Fetch Google Calendar events when token is available or view changes
  useEffect(() => {
    if (!googleToken || !user) return
    let cancelled = false

    async function fetchGoogleEvents() {
      try {
        const start = new Date(viewDate)
        start.setHours(0, 0, 0, 0)
        const end = new Date(viewDate)
        if (viewMode === '3-day') end.setDate(end.getDate() + 2)
        end.setHours(23, 59, 59, 999)

        const events = await fetchEventsForDateRange(googleToken!, start, end)
        if (cancelled) return
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
          // Dedup: skip Google events that already exist as app-created events
          const appGoogleIds = new Set(
            nonGoogle.filter((e) => e.googleEventId).map((e) => e.googleEventId),
          )
          const dedupedGoogle = mapped.filter((e) => !appGoogleIds.has(e.googleEventId))
          return [...nonGoogle, ...dedupedGoogle]
        })
      } catch (err: unknown) {
        console.error('Failed to fetch Google Calendar events:', err)
        // If token expired, clear it so user can reconnect
        if (err instanceof Error && (err.message.includes('401') || err.message.includes('Invalid Credentials'))) {
          localStorage.removeItem('shout_google_token')
          showToast('Google Calendar disconnected — sign out and back in to reconnect')
        }
      }
    }

    fetchGoogleEvents()
    return () => { cancelled = true }
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
          location: t.location,
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

  // Schedule all tasks instantly using local algorithm (no AI call needed)
  async function handleAISchedule() {
    if (todos.length === 0 || !user) return
    setIsScheduling(true)
    const t0 = performance.now()

    // Local scheduler is instant — no OpenAI API call needed
    const schedule = scheduleLocally(todos, calendarEvents, viewDate)
    console.log(`[SHOUT] Local scheduling: ${(performance.now() - t0).toFixed(0)}ms`)

    if (schedule.length === 0) {
      showToast('No available time slots')
      setIsScheduling(false)
      return
    }

    // Build event data
    const eventDataList = schedule.map((item, i) => {
      const todo = todos.find((t) => t.id === item.todoId)!
      const [hours, minutes] = item.startTime.split(':').map(Number)
      const start = new Date(viewDate)
      start.setHours(hours, minutes, 0, 0)
      const end = new Date(start.getTime() + item.duration * 60000)
      return { todo, start, end, color: EVENT_COLORS[i % EVENT_COLORS.length], dateStr: dateToString(start) }
    })

    // Optimistic UI: show events immediately, remove tasks
    const scheduledTodoIds = eventDataList.map(({ todo }) => todo.id)
    const optimisticEvents: CalendarEvent[] = eventDataList.map(({ todo, start, end, color, dateStr }) => ({
      id: `placeholder-${crypto.randomUUID()}`,
      title: todo.title,
      start,
      end,
      todoId: todo.id,
      color,
      date: dateStr,
    }))
    setCalendarEvents((prev) => [...prev, ...optimisticEvents])
    setTodos((prev) => prev.filter((t) => !scheduledTodoIds.includes(t.id)))

    try {
      const t1 = performance.now()

      // Create Google + DB events in parallel
      const [googleIds, createdEvents] = await Promise.all([
        Promise.all(
          eventDataList.map(({ todo, start, end }) => {
            if (!googleToken) return null
            return createGoogleEvent(googleToken, {
              title: todo.title, start, end, location: todo.location,
            }).catch((err) => { console.error('Google event error:', err); return null })
          }),
        ),
        Promise.all(
          eventDataList.map(({ todo, start, end, color, dateStr }) =>
            createEvent({ title: todo.title, start, end, todoId: todo.id, color, date: dateStr }, user.id),
          ),
        ),
      ])
      console.log(`[SHOUT] Create events: ${(performance.now() - t1).toFixed(0)}ms`)

      // Link Google IDs to DB events (fire and forget)
      googleIds.forEach((gId, i) => {
        if (gId && createdEvents[i]) {
          updateEvent(createdEvents[i].id, { googleEventId: gId }).catch(console.error)
        }
      })

      const t2 = performance.now()
      // Delete tasks in parallel
      await Promise.all(scheduledTodoIds.map((id) => deleteTask(id).catch(console.error)))
      console.log(`[SHOUT] Delete tasks: ${(performance.now() - t2).toFixed(0)}ms`)

      // Replace placeholders with real DB events
      setCalendarEvents((prev) => {
        const withoutPlaceholders = prev.filter((e) => !e.id.startsWith('placeholder-'))
        return [...withoutPlaceholders, ...createdEvents]
      })

      console.log(`[SHOUT] Total: ${(performance.now() - t0).toFixed(0)}ms`)
      showToast(`Scheduled ${createdEvents.length} task${createdEvents.length !== 1 ? 's' : ''}`)
    } catch (err) {
      console.error('Scheduling error:', err)
      setCalendarEvents((prev) => prev.filter((e) => !e.id.startsWith('placeholder-')))
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

  // Complete event — shrink to actual time spent, suggest next task
  const handleComplete = useCallback(
    async (event: CalendarEvent) => {
      if (!user) return
      const newCompleted = !event.completed
      const now = new Date()

      if (newCompleted) {
        // Shrink event end to now (actual time spent)
        const actualEnd = now < event.end ? now : event.end
        setCalendarEvents((prev) =>
          prev.map((e) => (e.id === event.id ? { ...e, completed: true, end: actualEnd } : e)),
        )
        setCompletedToday((c) => c + 1)
        await Promise.all([
          incrementCompletionStats(user.id, dateToString(new Date()), 'tasks_completed'),
          updateEvent(event.id, { completed: true, end: actualEnd }),
        ])

        // If backlog tasks exist, suggest scheduling the next one
        if (todos.length > 0) {
          const nextTask = todos[0]
          setNextTaskSuggestion({
            taskName: nextTask.title,
            taskId: nextTask.id,
            freeFrom: actualEnd,
            duration: nextTask.duration,
          })
        }
      } else {
        // Uncomplete
        setCalendarEvents((prev) =>
          prev.map((e) => (e.id === event.id ? { ...e, completed: false } : e)),
        )
        try {
          await updateEvent(event.id, { completed: false })
        } catch (err) {
          console.error('Failed to update completion:', err)
        }
      }
    },
    [user, todos],
  )

  // Schedule the suggested next task into freed time
  async function handleScheduleNextTask() {
    if (!nextTaskSuggestion || !user) return
    const task = todos.find((t) => t.id === nextTaskSuggestion.taskId)
    if (!task) { setNextTaskSuggestion(null); return }

    const start = new Date(nextTaskSuggestion.freeFrom)
    // Round up to next 5 minutes
    start.setMinutes(Math.ceil(start.getMinutes() / 5) * 5, 0, 0)
    const end = new Date(start.getTime() + task.duration * 60000)
    const color = EVENT_COLORS[calendarEvents.filter((e) => !e.isGoogleEvent).length % EVENT_COLORS.length]
    const dateStr = dateToString(start)

    const eventData: Omit<CalendarEvent, 'id'> = {
      title: task.title,
      start,
      end,
      todoId: task.id,
      color,
      date: dateStr,
    }

    // Create event + Google Calendar in parallel
    const [created, googleId] = await Promise.all([
      createEvent(eventData, user.id),
      googleToken
        ? createGoogleEvent(googleToken, { title: task.title, start, end, location: task.location }).catch(() => null)
        : Promise.resolve(null),
    ])

    if (googleId) {
      updateEvent(created.id, { googleEventId: googleId as string }).catch(console.error)
    }

    setCalendarEvents((prev) => [...prev, created])
    setTodos((prev) => prev.filter((t) => t.id !== task.id))
    await deleteTask(task.id).catch(console.error)

    setNextTaskSuggestion(null)
    showToast(`Scheduled "${task.title}"`)
  }

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

  // Clear all events (non-Google)
  async function handleClearAllEvents() {
    const nonGoogleEvents = calendarEvents.filter((e) => !e.isGoogleEvent)
    if (nonGoogleEvents.length === 0) return
    setCalendarEvents((prev) => prev.filter((e) => e.isGoogleEvent))
    for (const event of nonGoogleEvents) {
      if (event.googleEventId && googleToken) {
        deleteGoogleEvent(googleToken, event.googleEventId).catch(console.error)
      }
      if (!event.id.startsWith('placeholder-')) {
        deleteEvent(event.id).catch(console.error)
      }
    }
    showToast(`Cleared ${nonGoogleEvents.length} events`)
  }

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

  // Milestone callback for toast
  const handleMilestone = useCallback((message: string) => {
    showToast(message)
  }, [])

  const activeTodo = activeDragId ? todos.find((t) => t.id === activeDragId) : null

  // Loading state
  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="text-white text-2xl font-black animate-pulse">
          <span className="text-[#FF3300]">S</span>HOUT
        </div>
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
      <div className="h-screen flex flex-col bg-[#0d0d0d] font-sans relative">
        <AnimatedBackground />

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-black text-white tracking-tight">
              <span className="text-[#FF3300]">SH</span><span className="text-white/60">OU</span>T
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <CompletionCounter count={completedToday} streak={streak} onMilestone={handleMilestone} />
            <GoogleCalendarButton />
          </div>
        </header>

        {/* Main content */}
        <div className="relative z-10 flex flex-1 overflow-hidden">
          {/* Todo panel */}
          <div className="w-[420px] flex-shrink-0 p-4 border-r border-white/[0.06]">
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
                className="flex-1 h-9 px-3 rounded-lg bg-[#FF3300] text-white text-sm font-semibold hover:bg-[#FF3300]/90 hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 cursor-pointer"
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
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <DayNavigation
                  viewDate={viewDate}
                  viewMode={viewMode}
                  onDateChange={setViewDate}
                  onViewModeChange={setViewMode}
                />
              </div>
              {calendarEvents.some((e) => !e.isGoogleEvent) && (
                <button
                  onClick={handleClearAllEvents}
                  className="px-3 py-1.5 text-xs font-medium text-red-400 border border-red-400/20 rounded-lg hover:bg-red-400/10 transition-all cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>
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

        {/* Next task suggestion */}
        {nextTaskSuggestion && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-[#141414] text-white text-sm rounded-xl border border-[#FF3300]/20 shadow-lg shadow-[#FF3300]/5 animate-[fadeIn_0.2s_ease-out] flex items-center gap-3">
            <span>Finished early! Schedule <strong>{nextTaskSuggestion.taskName}</strong>?</span>
            <button
              onClick={handleScheduleNextTask}
              className="px-3 py-1.5 bg-[#FF3300] text-white text-xs font-semibold rounded-lg hover:bg-[#FF3300]/90 transition-all cursor-pointer"
            >
              Schedule now
            </button>
            <button
              onClick={() => setNextTaskSuggestion(null)}
              className="px-3 py-1.5 text-xs text-[#888] hover:text-white transition-all cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Toast */}
        {toast && !nextTaskSuggestion && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-[#141414] text-white text-sm rounded-xl border border-[#FF3300]/20 shadow-lg shadow-[#FF3300]/5 animate-[fadeIn_0.2s_ease-out]">
            {toast}
          </div>
        )}

        {/* Drag overlay */}
        <DragOverlay>
          {activeTodo ? (
            <div className="px-4 py-2.5 bg-[#141414] rounded-xl border border-[#FF3300]/20 shadow-xl shadow-[#FF3300]/10 text-sm text-white font-medium max-w-[300px] truncate">
              {activeTodo.title}
              <span className="ml-2 text-xs text-[#888]">{activeTodo.duration}m</span>
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  )
}
