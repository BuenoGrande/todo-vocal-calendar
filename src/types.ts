export interface TodoItem {
  id: string
  title: string
  duration: number // minutes
  priority: number
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
}
