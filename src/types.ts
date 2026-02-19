export interface TodoItem {
  id: string
  title: string
  duration: number // minutes
  priority: number
  timePreference?: string // e.g. "morning", "after lunch", "before 3pm" — hidden from UI, used by scheduler
}

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  todoId?: string
  googleEventId?: string
  isGoogleEvent?: boolean
  completed?: boolean
  color: string
  date?: string // YYYY-MM-DD
}

export type ViewMode = '1-day' | '3-day'
