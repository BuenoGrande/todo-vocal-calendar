import type { TodoItem, CalendarEvent } from '../types'

interface ScheduleResult {
  todoId: string
  title: string
  startTime: string
  duration: number
}

export function scheduleLocally(
  todos: TodoItem[],
  existingEvents: CalendarEvent[],
  targetDate: Date = new Date(),
): ScheduleResult[] {
  const now = new Date()
  const isToday = targetDate.toDateString() === now.toDateString()

  // Start time: current time rounded up to next 15-min, or 8:00 for future dates
  let cursor: number
  if (isToday) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    cursor = Math.ceil(nowMinutes / 15) * 15
  } else {
    cursor = 8 * 60 // 8:00 AM
  }

  const endOfDay = 22 * 60 // 10:00 PM

  // Build occupied intervals from existing events on the target date
  const occupied: { start: number; end: number }[] = existingEvents
    .filter((e) => {
      const eventDate = new Date(e.start)
      return eventDate.toDateString() === targetDate.toDateString()
    })
    .map((e) => ({
      start: new Date(e.start).getHours() * 60 + new Date(e.start).getMinutes(),
      end: new Date(e.end).getHours() * 60 + new Date(e.end).getMinutes(),
    }))
    .sort((a, b) => a.start - b.start)

  // Parse time preference into a preferred start minute and whether it's an exact/pinned time
  function parseTimePreference(pref: string): { start: number; exact: boolean } | null {
    const lower = pref.toLowerCase()

    // Exact time: "at 2pm", "at 14:00", "at 9:30 am"
    const atMatch = lower.match(/at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
    if (atMatch) {
      let hour = parseInt(atMatch[1])
      const min = atMatch[2] ? parseInt(atMatch[2]) : 0
      if (atMatch[3]?.toLowerCase() === 'pm' && hour < 12) hour += 12
      if (atMatch[3]?.toLowerCase() === 'am' && hour === 12) hour = 0
      return { start: hour * 60 + min, exact: true }
    }

    // Specific time without "at": "2pm", "14:00", "9:30am" (standalone)
    const timeMatch = lower.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
    if (timeMatch) {
      let hour = parseInt(timeMatch[1])
      const min = timeMatch[2] ? parseInt(timeMatch[2]) : 0
      if (timeMatch[3]?.toLowerCase() === 'pm' && hour < 12) hour += 12
      if (timeMatch[3]?.toLowerCase() === 'am' && hour === 12) hour = 0
      return { start: hour * 60 + min, exact: true }
    }

    // "before X" time
    const beforeMatch = lower.match(/before (\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
    if (beforeMatch) {
      let hour = parseInt(beforeMatch[1])
      const min = beforeMatch[2] ? parseInt(beforeMatch[2]) : 0
      if (beforeMatch[3]?.toLowerCase() === 'pm' && hour < 12) hour += 12
      if (beforeMatch[3]?.toLowerCase() === 'am' && hour === 12) hour = 0
      return { start: 8 * 60, exact: false } // start early, just need to finish before
    }

    // "after X" time
    const afterMatch = lower.match(/after (\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
    if (afterMatch) {
      let hour = parseInt(afterMatch[1])
      const min = afterMatch[2] ? parseInt(afterMatch[2]) : 0
      if (afterMatch[3]?.toLowerCase() === 'pm' && hour < 12) hour += 12
      if (afterMatch[3]?.toLowerCase() === 'am' && hour === 12) hour = 0
      return { start: hour * 60 + min, exact: false }
    }

    // Named time ranges
    if (lower.includes('morning') || lower.includes('first thing')) return { start: 8 * 60, exact: false }
    if (lower.includes('after lunch')) return { start: 13 * 60, exact: false }
    if (lower.includes('afternoon')) return { start: 14 * 60, exact: false }
    if (lower.includes('evening')) return { start: 17 * 60, exact: false }
    if (lower.includes('noon') || lower.includes('midday')) return { start: 12 * 60, exact: false }

    return null
  }

  // Separate tasks with exact times from flexible ones
  const exactTasks: (TodoItem & { pinnedStart: number })[] = []
  const flexTasks: TodoItem[] = []

  for (const todo of todos) {
    if (todo.timePreference) {
      const parsed = parseTimePreference(todo.timePreference)
      if (parsed?.exact) {
        exactTasks.push({ ...todo, pinnedStart: parsed.start })
        continue
      }
    }
    flexTasks.push(todo)
  }

  const results: ScheduleResult[] = []

  // Schedule exact/pinned tasks first
  for (const todo of exactTasks) {
    const slotStart = todo.pinnedStart
    const slotEnd = slotStart + todo.duration
    if (slotEnd > endOfDay) continue

    const hasConflict = occupied.some(
      (o) => slotStart < o.end && slotEnd > o.start,
    )
    if (!hasConflict) {
      const hours = Math.floor(slotStart / 60)
      const minutes = slotStart % 60
      results.push({
        todoId: todo.id,
        title: todo.title,
        startTime: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
        duration: todo.duration,
      })
      occupied.push({ start: slotStart, end: slotEnd })
      occupied.sort((a, b) => a.start - b.start)
    }
  }

  // Sort flexible todos by priority (lower = higher priority)
  const sorted = [...flexTasks].sort((a, b) => a.priority - b.priority)

  for (const todo of sorted) {
    const duration = todo.duration
    let scheduled = false

    // Try to honor time preference
    let preferredStart: number | null = null
    if (todo.timePreference) {
      const parsed = parseTimePreference(todo.timePreference)
      if (parsed) preferredStart = parsed.start
    }

    // Start searching from preferred time or cursor
    let searchStart = preferredStart !== null ? Math.max(preferredStart, cursor) : cursor
    // Round to 15-min slot
    searchStart = Math.ceil(searchStart / 15) * 15

    while (searchStart + duration <= endOfDay) {
      const slotEnd = searchStart + duration
      const hasConflict = occupied.some(
        (o) => searchStart < o.end && slotEnd > o.start,
      )

      if (!hasConflict) {
        const hours = Math.floor(searchStart / 60)
        const minutes = searchStart % 60
        results.push({
          todoId: todo.id,
          title: todo.title,
          startTime: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
          duration,
        })
        occupied.push({ start: searchStart, end: slotEnd })
        occupied.sort((a, b) => a.start - b.start)
        // Add 5-min break
        cursor = slotEnd + 5
        scheduled = true
        break
      }
      searchStart += 15
    }

    if (!scheduled) break // No more room
  }

  return results
}
