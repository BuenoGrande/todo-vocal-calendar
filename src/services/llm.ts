import type { TodoItem, CalendarEvent } from '../types'

export async function parseTasks(
  text: string,
): Promise<Omit<TodoItem, 'id' | 'priority'>[]> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a task parser. Extract individual tasks from the user's speech/text.
Return a JSON object with a "tasks" array. Each task has:
- "title": string (concise task name)
- "duration": number (estimated duration in minutes)

If no duration is mentioned, estimate a reasonable one based on the task.
Only return the JSON object, nothing else.`,
        },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Task parsing failed')
  }

  const data = await response.json()
  const parsed = JSON.parse(data.choices[0].message.content)
  return parsed.tasks || []
}

export async function scheduleWithAI(
  todos: TodoItem[],
  existingEvents: CalendarEvent[],
): Promise<{ title: string; startTime: string; duration: number }[]> {
  const now = new Date()
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const existingFormatted = existingEvents.map((e) => ({
    title: e.title,
    start: `${String(e.start.getHours()).padStart(2, '0')}:${String(e.start.getMinutes()).padStart(2, '0')}`,
    end: `${String(e.end.getHours()).padStart(2, '0')}:${String(e.end.getMinutes()).padStart(2, '0')}`,
  }))

  const todosFormatted = todos.map((t) => ({
    title: t.title,
    duration: t.duration,
  }))

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a smart calendar scheduling assistant. Given tasks with durations, existing calendar events, and the current time, schedule the tasks into available time slots today.

Rules:
- Never overlap with existing events
- Only schedule after the current time
- Add 5-minute breaks between tasks
- Tasks are listed in priority order (first = highest priority)
- Keep within reasonable hours (until 22:00)

Return a JSON object with a "schedule" array. Each item has:
- "title": string
- "startTime": string (HH:MM format, 24-hour)
- "duration": number (minutes)`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            currentTime,
            tasks: todosFormatted,
            existingEvents: existingFormatted,
          }),
        },
      ],
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || 'AI scheduling failed')
  }

  const data = await response.json()
  const parsed = JSON.parse(data.choices[0].message.content)
  return parsed.schedule || []
}
