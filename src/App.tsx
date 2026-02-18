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
import type { TodoItem, CalendarEvent } from './types'
import { parseTasks, scheduleWithAI } from './services/llm'
import {
  initGoogleAuth,
  fetchTodayEvents,
  createGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
} from './services/googleCalendar'
import GoogleCalendarButton from './components/GoogleCalendarButton'
import VoiceInput from './components/VoiceInput'
import TodoList from './components/TodoList'
import CalendarView from './components/CalendarView'

const EVENT_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6']
const GOOGLE_EVENT_COLOR = '#34a853'
const GOOGLE_CLIENT_ID = '1065090327076-lfesgc6ophb9pach2qbltrsvkb1kv4ba.apps.googleusercontent.com'

export default function App() {
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [googleToken, setGoogleToken] = useState<string | null>(null)
  const [isScheduling, setIsScheduling] = useState(false)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // Google Calendar connect
  async function handleConnectGoogle() {
    try {
      const token = await initGoogleAuth(GOOGLE_CLIENT_ID)
      setGoogleToken(token)
      showToast('Connected to Google Calendar')
      // Fetch today's events
      const events = await fetchTodayEvents(token)
      const mapped: CalendarEvent[] = events.map(
        (e: { id: string; title: string; start: Date; end: Date }) => ({
          id: `google-${e.id}`,
          title: e.title,
          start: e.start,
          end: e.end,
          googleEventId: e.id,
          isGoogleEvent: true,
          color: GOOGLE_EVENT_COLOR,
        }),
      )
      setCalendarEvents((prev) => {
        const nonGoogle = prev.filter((e) => !e.isGoogleEvent)
        return [...nonGoogle, ...mapped]
      })
    } catch (err) {
      console.error('Google auth error:', err)
      showToast(`Google Calendar error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  function handleDisconnectGoogle() {
    setGoogleToken(null)
    setCalendarEvents((prev) => prev.filter((e) => !e.isGoogleEvent))
    showToast('Disconnected from Google Calendar')
  }

  // Add todo
  function handleAddTodo(title: string, duration: number) {
    const newTodo: TodoItem = {
      id: crypto.randomUUID(),
      title,
      duration,
      priority: todos.length,
    }
    setTodos((prev) => [...prev, newTodo])
  }

  // Update todo
  function handleUpdateTodo(id: string, updates: Partial<TodoItem>) {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)))
  }

  // Delete todo
  function handleDeleteTodo(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id))
  }

  // Voice transcription handler
  const handleTranscription = useCallback(
    async (text: string) => {
      try {
        showToast('Parsing tasks...')
        const tasks = await parseTasks(text)
        // Sort by priority from LLM (1 = highest) before inserting
        const sorted = [...tasks].sort((a, b) => a.priority - b.priority)
        const newTodos: TodoItem[] = sorted.map((t, i) => ({
          id: crypto.randomUUID(),
          title: t.title,
          duration: t.duration,
          priority: i,
          timePreference: t.timePreference,
        }))
        // Prepend new tasks (higher priority) before existing ones, re-number existing
        setTodos((prev) => {
          const renumbered = prev.map((t, i) => ({ ...t, priority: newTodos.length + i }))
          return [...newTodos, ...renumbered]
        })
        showToast(`Added ${newTodos.length} task${newTodos.length !== 1 ? 's' : ''}`)
      } catch (err) {
        console.error('Task parsing error:', err)
        showToast(`Parsing failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    },
    [],
  )

  // AI scheduling
  async function handleAISchedule() {
    if (todos.length === 0) return
    setIsScheduling(true)
    try {
      const schedule = await scheduleWithAI(todos, calendarEvents)
      const newEvents: CalendarEvent[] = []
      const scheduledTodoIds: string[] = []

      for (const item of schedule) {
        const todo = todos.find((t) => t.title === item.title)
        if (!todo) continue

        const [hours, minutes] = item.startTime.split(':').map(Number)
        const start = new Date()
        start.setHours(hours, minutes, 0, 0)
        const end = new Date(start.getTime() + item.duration * 60000)
        const color = EVENT_COLORS[newEvents.length % EVENT_COLORS.length]

        const newEvent: CalendarEvent = {
          id: crypto.randomUUID(),
          title: todo.title,
          start,
          end,
          todoId: todo.id,
          color,
        }

        // Create in Google Calendar if connected
        if (googleToken) {
          try {
            const googleId = await createGoogleEvent(googleToken, {
              title: todo.title,
              start,
              end,
            })
            newEvent.googleEventId = googleId
          } catch (err) {
            console.error('Failed to create Google event:', err)
          }
        }

        newEvents.push(newEvent)
        scheduledTodoIds.push(todo.id)
      }

      setCalendarEvents((prev) => [...prev, ...newEvents])
      setTodos((prev) => prev.filter((t) => !scheduledTodoIds.includes(t.id)))
      showToast(`Scheduled ${newEvents.length} task${newEvents.length !== 1 ? 's' : ''}`)
    } catch (err) {
      console.error('AI scheduling error:', err)
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
    },
    [],
  )

  // Sync to Google on event update (debounced via mouseup in CalendarView)
  useEffect(() => {
    // We handle Google sync on specific actions, not every state change
  }, [])

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
    },
    [calendarEvents, googleToken],
  )

  // Reschedule: move calendar event back to todo list
  const handleReschedule = useCallback(
    async (event: CalendarEvent) => {
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
      // Create new todo
      const duration = Math.round((event.end.getTime() - event.start.getTime()) / 60000)
      const newTodo: TodoItem = {
        id: crypto.randomUUID(),
        title: event.title,
        duration,
        priority: todos.length,
      }
      setTodos((prev) => [...prev, newTodo])
      showToast(`"${event.title}" moved back to tasks`)
    },
    [googleToken, todos.length],
  )

  // DnD handlers
  function handleDragStart(event: { active: { id: string | number } }) {
    setActiveDragId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null)
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    if (overId.startsWith('slot-')) {
      // Dropped on calendar slot
      const todo = todos.find((t) => t.id === activeId)
      if (!todo) return

      const timeStr = overId.replace('slot-', '')
      const [hours, minutes] = timeStr.split(':').map(Number)
      const start = new Date()
      start.setHours(hours, minutes, 0, 0)
      const end = new Date(start.getTime() + todo.duration * 60000)
      const color = EVENT_COLORS[calendarEvents.filter((e) => !e.isGoogleEvent).length % EVENT_COLORS.length]

      const newEvent: CalendarEvent = {
        id: crypto.randomUUID(),
        title: todo.title,
        start,
        end,
        todoId: todo.id,
        color,
      }

      // Create in Google Calendar if connected
      if (googleToken) {
        createGoogleEvent(googleToken, { title: todo.title, start, end })
          .then((googleId) => {
            setCalendarEvents((prev) =>
              prev.map((e) => (e.id === newEvent.id ? { ...e, googleEventId: googleId } : e)),
            )
          })
          .catch((err) => console.error('Failed to create Google event:', err))
      }

      setCalendarEvents((prev) => [...prev, newEvent])
      setTodos((prev) => prev.filter((t) => t.id !== activeId))
    } else {
      // Reorder within todo list
      if (activeId !== overId) {
        setTodos((prev) => {
          const oldIndex = prev.findIndex((t) => t.id === activeId)
          const newIndex = prev.findIndex((t) => t.id === overId)
          if (oldIndex === -1 || newIndex === -1) return prev
          return arrayMove(prev, oldIndex, newIndex)
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
      // Sync all non-google events that have googleEventIds
      calendarEvents
        .filter((e) => !e.isGoogleEvent && e.googleEventId)
        .forEach((e) => syncEventToGoogle(e.id))
    }
    document.addEventListener('mouseup', handleGlobalMouseUp)
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [calendarEvents, syncEventToGoogle])

  const activeTodo = activeDragId ? todos.find((t) => t.id === activeDragId) : null

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-screen flex flex-col bg-slate-50 font-sans">
        {/* Header — minimal */}
        <header className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h1 className="text-base font-semibold text-gray-900">Voice Todo Calendar</h1>
          </div>

          <GoogleCalendarButton
            connected={!!googleToken}
            onConnect={handleConnectGoogle}
            onDisconnect={handleDisconnectGoogle}
          />
        </header>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Todo panel */}
          <div className="w-[380px] flex-shrink-0 p-4 border-r border-gray-100 bg-slate-50/50">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">Tasks</h2>
              <span className="text-xs text-gray-400 font-medium">
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
                className="flex-1 h-9 px-3 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-medium hover:from-violet-600 hover:to-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 cursor-pointer"
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
          <div className="flex-1 p-4 overflow-hidden">
            <CalendarView
              events={calendarEvents}
              onEventUpdate={handleEventUpdate}
              onEventDelete={handleEventDelete}
              onReschedule={handleReschedule}
            />
          </div>
        </div>

        {/* Privacy policy link */}
        <div className="fixed bottom-2 right-4 z-40">
          <a href="/privacy.html" target="_blank" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Privacy Policy
          </a>
        </div>

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-gray-900 text-white text-sm rounded-xl shadow-lg animate-[fadeIn_0.2s_ease-out]">
            {toast}
          </div>
        )}

        {/* Drag overlay */}
        <DragOverlay>
          {activeTodo ? (
            <div className="px-4 py-2.5 bg-white rounded-xl border border-indigo-200 shadow-xl text-sm text-gray-800 font-medium max-w-[300px] truncate">
              {activeTodo.title}
              <span className="ml-2 text-xs text-indigo-500">{activeTodo.duration}m</span>
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  )
}
