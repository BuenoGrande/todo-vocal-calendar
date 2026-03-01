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
import { motion, AnimatePresence } from 'framer-motion'
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
import TopBar from './components/TopBar'
import TodoList from './components/TodoList'
import CalendarView from './components/CalendarView'
import DayNavigation from './components/DayNavigation'
import LoginScreen from './components/LoginScreen'
import VoiceInputModal from './components/VoiceInputModal'
import TaskCard from './components/TaskCard'
import Achievements from './components/Achievements'
import type { Achievement } from './components/Achievements'
import DailyGoals from './components/DailyGoals'
import type { DailyObjective } from './components/DailyGoals'
import LevelUpCelebration from './components/LevelUpCelebration'
import ParticleTrail from './components/ParticleTrail'

const GOOGLE_EVENT_COLOR = '#4A90D9'
const XP_PER_TASK = 25
const XP_PER_LEVEL = 100

/** Priority-based color: index 0 (most urgent) = vivid red, last = muted grey */
function getPriorityColor(index: number, total: number): string {
  if (total <= 1) return '#EF4444'
  const t = index / (total - 1)
  if (t <= 0.6) {
    const hue = 0 + (t / 0.6) * 40
    return `hsl(${hue}, 90%, 55%)`
  }
  const u = (t - 0.6) / 0.4
  const sat = 90 - u * 70
  const lit = 55 - u * 20
  return `hsl(40, ${sat}%, ${lit}%)`
}

function dateToString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function computeStreak(stats: { date: string; tasksCompleted: number }[]): number {
  const completedDates = new Set(stats.filter((s) => s.tasksCompleted > 0).map((s) => s.date))
  let streak = 0
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

const INITIAL_ACHIEVEMENTS: Achievement[] = [
  { id: 'a1', name: 'First Win', description: 'Complete your first task.', icon: 'CheckCircle', unlocked: false, category: 'Productivity' },
  { id: 'a2', name: 'Week Warrior', description: 'Maintain a 7-day streak.', icon: 'Flame', unlocked: false, category: 'Consistency' },
  { id: 'a3', name: 'Power Planner', description: 'Complete 50 tasks.', icon: 'Target', unlocked: false, category: 'Mastery' },
  { id: 'a4', name: 'Early Bird', description: 'Plan your day before 8 AM.', icon: 'Sunrise', unlocked: false, category: 'Consistency' },
  { id: 'a5', name: 'Unstoppable', description: 'Complete 5 Critical tasks in a day.', icon: 'Zap', unlocked: false, category: 'Mastery' },
]

export default function App() {
  const { user, googleToken, loading, signInWithGoogle } = useAuth()
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [isScheduling, setIsScheduling] = useState(false)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 })
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

  // New UI state
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false)
  const [isAchievementsOpen, setIsAchievementsOpen] = useState(false)
  const [isGoalsOpen, setIsGoalsOpen] = useState(false)
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [achievements, setAchievements] = useState<Achievement[]>(INITIAL_ACHIEVEMENTS)

  // Gamification derived state
  const xp = completedToday * XP_PER_TASK
  const level = Math.floor(xp / XP_PER_LEVEL) + 1
  const xpInLevel = xp % XP_PER_LEVEL

  const dailyObjectives: DailyObjective[] = [
    { id: 'o1', name: 'Complete 3 tasks', progress: Math.min(completedToday, 3), target: 3, completed: completedToday >= 3 },
    { id: 'o2', name: 'Schedule all tasks', progress: todos.length === 0 ? 1 : 0, target: 1, completed: todos.length === 0 },
    { id: 'o3', name: 'Maintain streak', progress: streak > 0 ? 1 : 0, target: 1, completed: streak > 0 },
  ]

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

        // Unlock achievements based on data
        if (stats.tasksCompleted > 0) {
          setAchievements((prev) => prev.map((a) => a.id === 'a1' ? { ...a, unlocked: true } : a))
        }
        const s = computeStreak(recentStats)
        if (s >= 7) {
          setAchievements((prev) => prev.map((a) => a.id === 'a2' ? { ...a, unlocked: true } : a))
        }
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
          const appGoogleIds = new Set(
            nonGoogle.filter((e) => e.googleEventId).map((e) => e.googleEventId),
          )
          const dedupedGoogle = mapped.filter((e) => !appGoogleIds.has(e.googleEventId))
          return [...nonGoogle, ...dedupedGoogle]
        })
      } catch (err: unknown) {
        console.error('Failed to fetch Google Calendar events:', err)
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

        setTodos((prev) => {
          const renumbered = prev.map((t, i) => ({ ...t, priority: newTodos.length + i }))
          return [...newTodos, ...renumbered]
        })

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

        setTodos((prev) => {
          let updated = [...prev]
          for (let i = 0; i < newTodos.length; i++) {
            if (createdTodos[i]) {
              updated = updated.map((t) => (t.id === newTodos[i].id ? createdTodos[i] : t))
            }
          }
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

  // Schedule all tasks
  async function handleAISchedule() {
    if (todos.length === 0 || !user) return
    setIsScheduling(true)
    const t0 = performance.now()

    const schedule = scheduleLocally(todos, calendarEvents, viewDate)
    console.log(`[SHOUT] Local scheduling: ${(performance.now() - t0).toFixed(0)}ms`)

    if (schedule.length === 0) {
      showToast('No available time slots')
      setIsScheduling(false)
      return
    }

    const eventDataList = schedule.map((item, i) => {
      const todo = todos.find((t) => t.id === item.todoId)!
      const [hours, minutes] = item.startTime.split(':').map(Number)
      const start = new Date(viewDate)
      start.setHours(hours, minutes, 0, 0)
      const end = new Date(start.getTime() + item.duration * 60000)
      return { todo, start, end, color: getPriorityColor(i, schedule.length), dateStr: dateToString(start) }
    })

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

      googleIds.forEach((gId, i) => {
        if (gId && createdEvents[i]) {
          updateEvent(createdEvents[i].id, { googleEventId: gId }).catch(console.error)
        }
      })

      const t2 = performance.now()
      await Promise.all(scheduledTodoIds.map((id) => deleteTask(id).catch(console.error)))
      console.log(`[SHOUT] Delete tasks: ${(performance.now() - t2).toFixed(0)}ms`)

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
      const now = new Date()

      if (newCompleted) {
        const actualEnd = now < event.end ? now : event.end
        setCalendarEvents((prev) =>
          prev.map((e) => (e.id === event.id ? { ...e, completed: true, end: actualEnd } : e)),
        )
        const newCount = completedToday + 1
        setCompletedToday(newCount)

        // Check for level-up
        const prevLevel = Math.floor((completedToday * XP_PER_TASK) / XP_PER_LEVEL) + 1
        const newLevel = Math.floor((newCount * XP_PER_TASK) / XP_PER_LEVEL) + 1
        if (newLevel > prevLevel) {
          setShowLevelUp(true)
        }

        // Unlock first win achievement
        setAchievements((prev) => prev.map((a) => a.id === 'a1' ? { ...a, unlocked: true } : a))

        await Promise.all([
          incrementCompletionStats(user.id, dateToString(new Date()), 'tasks_completed'),
          updateEvent(event.id, { completed: true, end: actualEnd }),
        ])

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
    [user, todos, completedToday],
  )

  // Schedule the suggested next task
  async function handleScheduleNextTask() {
    if (!nextTaskSuggestion || !user) return
    const task = todos.find((t) => t.id === nextTaskSuggestion.taskId)
    if (!task) { setNextTaskSuggestion(null); return }

    const start = new Date(nextTaskSuggestion.freeFrom)
    start.setMinutes(Math.ceil(start.getMinutes() / 5) * 5, 0, 0)
    const end = new Date(start.getTime() + task.duration * 60000)
    const todoIndex = todos.findIndex((t) => t.id === task.id)
    const color = getPriorityColor(todoIndex >= 0 ? todoIndex : 0, todos.length)
    const dateStr = dateToString(start)

    const eventData: Omit<CalendarEvent, 'id'> = {
      title: task.title,
      start,
      end,
      todoId: task.id,
      color,
      date: dateStr,
    }

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
      if (event.googleEventId && googleToken && !event.isGoogleEvent) {
        try {
          await deleteGoogleEvent(googleToken, event.googleEventId)
        } catch (err) {
          console.error('Failed to delete Google event:', err)
        }
      }
      setCalendarEvents((prev) => prev.filter((e) => e.id !== event.id))
      await deleteEvent(event.id).catch(console.error)

      const duration = Math.round((event.end.getTime() - event.start.getTime()) / 60000)
      const priority = todos.length
      const created = await createTask({ title: event.title, duration, priority }, user.id)
      setTodos((prev) => [...prev, created])
      showToast(`"${event.title}" moved back to tasks`)
    },
    [googleToken, todos.length, user],
  )

  // Clear all events
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

  function handleDragMove(event: { delta: { x: number; y: number }; activatorEvent: Event }) {
    const e = event.activatorEvent as MouseEvent
    setDragPosition({ x: e.clientX + event.delta.x, y: e.clientY + event.delta.y })
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null)
    const { active, over } = event
    if (!over || !user) return

    const activeId = String(active.id)
    const overId = String(over.id)

    if (overId.startsWith('day-target-')) {
      const todo = todos.find((t) => t.id === activeId)
      if (!todo) return

      const targetDateStr = overId.replace('day-target-', '')
      const [year, month, day] = targetDateStr.split('-').map(Number)
      const start = new Date(year, month - 1, day, 9, 0, 0, 0)
      const end = new Date(start.getTime() + todo.duration * 60000)
      const todoIndex = todos.findIndex((t) => t.id === todo.id)
      const color = getPriorityColor(todoIndex >= 0 ? todoIndex : 0, todos.length)

      const eventData: Omit<CalendarEvent, 'id'> = {
        title: todo.title,
        start,
        end,
        todoId: todo.id,
        color,
        date: targetDateStr,
      }

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

      try {
        const created = await createEvent(eventData, user.id)
        setCalendarEvents((prev) => [...prev, created])
      } catch (err) {
        console.error('Failed to create event:', err)
        setCalendarEvents((prev) => [...prev, { id: crypto.randomUUID(), ...eventData }])
      }

      setTodos((prev) => prev.filter((t) => t.id !== activeId))
      await deleteTask(activeId).catch(console.error)

      const dayLabel = new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      showToast(`Task scheduled for ${dayLabel}`)
    } else if (overId.startsWith('slot-')) {
      const todo = todos.find((t) => t.id === activeId)
      if (!todo) return

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
      const todoIndex = todos.findIndex((t) => t.id === todo.id)
      const color = getPriorityColor(todoIndex >= 0 ? todoIndex : 0, todos.length)

      const eventData: Omit<CalendarEvent, 'id'> = {
        title: todo.title,
        start,
        end,
        todoId: todo.id,
        color,
        date: dateStr,
      }

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

      try {
        const created = await createEvent(eventData, user.id)
        setCalendarEvents((prev) => [...prev, created])
      } catch (err) {
        console.error('Failed to create event:', err)
        setCalendarEvents((prev) => [...prev, { id: crypto.randomUUID(), ...eventData }])
      }

      setTodos((prev) => prev.filter((t) => t.id !== activeId))
      await deleteTask(activeId).catch(console.error)
    } else {
      if (activeId !== overId) {
        setTodos((prev) => {
          const oldIndex = prev.findIndex((t) => t.id === activeId)
          const newIndex = prev.findIndex((t) => t.id === overId)
          if (oldIndex === -1 || newIndex === -1) return prev
          const reordered = arrayMove(prev, oldIndex, newIndex)
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
      <div className="h-screen w-screen bg-deep flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-accent flex items-center justify-center" style={{ boxShadow: '0 0 15px -3px rgba(139,92,246,0.4)' }}>
            <span className="font-bold text-white text-lg leading-none">S</span>
          </div>
          <span className="text-primary text-2xl font-bold animate-pulse">SHOUT</span>
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
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div className="h-screen w-full flex flex-col bg-deep text-primary overflow-hidden">
        <TopBar
          level={level}
          xp={xpInLevel}
          xpToNextLevel={XP_PER_LEVEL}
          streak={streak}
          onNewTask={() => setIsVoiceModalOpen(true)}
          onOpenAchievements={() => setIsAchievementsOpen(true)}
          onToggleGoals={() => setIsGoalsOpen(!isGoalsOpen)}
        />

        <div className="relative z-40">
          <DailyGoals isOpen={isGoalsOpen} objectives={dailyObjectives} />
        </div>

        <main className="flex-1 flex overflow-hidden relative z-10">
          {/* Task backlog panel */}
          <div className="w-[40%] xl:w-[35%] h-full shrink-0">
            <TodoList
              todos={todos}
              onAddTodo={handleAddTodo}
              onUpdateTodo={handleUpdateTodo}
              onDeleteTodo={handleDeleteTodo}
              onAutoSchedule={handleAISchedule}
              isScheduling={isScheduling}
            />
          </div>

          {/* Schedule panel */}
          <div className="w-[60%] xl:w-[65%] h-full shrink-0 flex flex-col">
            <div className="px-6 pt-4 pb-2">
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
                    className="px-3 py-1.5 text-xs font-medium text-critical border border-critical/20 rounded-md hover:bg-critical/10 transition-all cursor-pointer"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <CalendarView
                events={calendarEvents}
                viewDate={viewDate}
                viewMode={viewMode}
                onEventUpdate={handleEventUpdate}
                onEventDelete={handleEventDelete}
                onReschedule={handleReschedule}
                onComplete={handleComplete}
                isTaskDragging={!!activeDragId}
              />
            </div>
          </div>
        </main>

        {/* Next task suggestion */}
        <AnimatePresence>
          {nextTaskSuggestion && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-surface text-primary text-sm rounded-xl border border-accent/20 shadow-lg flex items-center gap-3"
            >
              <span>Finished early! Schedule <strong>{nextTaskSuggestion.taskName}</strong>?</span>
              <button
                onClick={handleScheduleNextTask}
                className="px-3 py-1.5 bg-accent text-white text-xs font-semibold rounded-md hover:bg-accent-glow transition-all cursor-pointer"
              >
                Schedule now
              </button>
              <button
                onClick={() => setNextTaskSuggestion(null)}
                className="px-3 py-1.5 text-xs text-dim hover:text-primary transition-all cursor-pointer"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toast */}
        <AnimatePresence>
          {toast && !nextTaskSuggestion && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-surface text-primary text-sm rounded-xl border border-border shadow-lg"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Drag overlay */}
        <DragOverlay>
          {activeTodo ? (
            <div className="w-80">
              <TaskCard
                todo={activeTodo}
                rank={todos.findIndex((t) => t.id === activeTodo.id) + 1}
              />
            </div>
          ) : null}
        </DragOverlay>

        {/* Particle trail during drag */}
        <ParticleTrail
          x={dragPosition.x}
          y={dragPosition.y}
          isDragging={!!activeDragId}
        />

        {/* Modals */}
        <VoiceInputModal
          isOpen={isVoiceModalOpen}
          onClose={() => setIsVoiceModalOpen(false)}
          onTranscription={handleTranscription}
        />

        <Achievements
          isOpen={isAchievementsOpen}
          onClose={() => setIsAchievementsOpen(false)}
          achievements={achievements}
        />

        <LevelUpCelebration
          isOpen={showLevelUp}
          level={level}
          onClose={() => setShowLevelUp(false)}
        />
      </div>
    </DndContext>
  )
}
