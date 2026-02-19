import type { TodoItem, CalendarEvent } from '../types'

interface ScheduleResult {
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

  // Sort todos by priority (lower = higher priority)
  const sorted = [...todos].sort((a, b) => a.priority - b.priority)

  const results: ScheduleResult[] = []

  for (const todo of sorted) {
    const duration = todo.duration
    let scheduled = false

    // Try to honor time preference
    let preferredStart: number | null = null
    if (todo.timePreference) {
      const pref = todo.timePreference.toLowerCase()
      if (pref.includes('morning') || pref.includes('first thing')) preferredStart = 8 * 60
      else if (pref.includes('after lunch')) preferredStart = 13 * 60
      else if (pref.includes('afternoon')) preferredStart = 14 * 60
      else if (pref.includes('evening')) preferredStart = 17 * 60

      const match = pref.match(/before (\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
      if (match) {
        let hour = parseInt(match[1])
        if (match[3]?.toLowerCase() === 'pm' && hour < 12) hour += 12
        preferredStart = Math.max(cursor, hour * 60 - duration)
      }

      const matchAfter = pref.match(/after (\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
      if (matchAfter) {
        let hour = parseInt(matchAfter[1])
        if (matchAfter[3]?.toLowerCase() === 'pm' && hour < 12) hour += 12
        preferredStart = hour * 60
      }
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
