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
  color: string
}

export interface Settings {
  openaiApiKey: string
  googleClientId: string
}
