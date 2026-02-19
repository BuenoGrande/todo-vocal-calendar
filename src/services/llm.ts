import type { TodoItem, CalendarEvent } from '../types'

export async function parseTasks(
  text: string,
): Promise<Omit<TodoItem, 'id'>[]> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      messages: [
        {
          role: 'system',
          content: `You are a task parser. Extract individual tasks from the user's speech/text.
Return a JSON object with a "tasks" array. Each task has:
- "title": string (concise task name)
- "duration": number (estimated duration in minutes, rounded to nearest 5)
- "priority": number (1 = highest priority, higher numbers = lower priority). Infer from emphasis, ordering, urgency words like "important", "first", "urgent", "must", etc.
- "timePreference": string | null (any mentioned time slot or ordering preference, e.g. "morning", "after lunch", "before 3pm", "first thing", "evening", "after the meeting"). Set null if no preference mentioned.
- "location": string | null (any mentioned place, address, or location, e.g. "office", "gym", "home", "coffee shop", "123 Main St"). Set null if no location mentioned.

If no duration is mentioned, estimate a reasonable one based on the task.
If no clear priority is mentioned, assign based on the order they appear in the text (first mentioned = priority 1).
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
  return (parsed.tasks || []).map(
    (t: { title: string; duration: number; priority: number; timePreference?: string | null; location?: string | null }) => ({
      title: t.title,
      duration: Math.max(5, Math.round((t.duration || 30) / 5) * 5),
      priority: t.priority ?? 999,
      timePreference: t.timePreference || undefined,
      location: t.location || undefined,
    }),
  )
}

export async function scheduleWithAI(
  todos: TodoItem[],
  existingEvents: CalendarEvent[],
): Promise<{ index: number; startTime: string; duration: number }[]> {
  const now = new Date()
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const existingFormatted = existingEvents.map((e) => ({
    title: e.title,
    start: `${String(e.start.getHours()).padStart(2, '0')}:${String(e.start.getMinutes()).padStart(2, '0')}`,
    end: `${String(e.end.getHours()).padStart(2, '0')}:${String(e.end.getMinutes()).padStart(2, '0')}`,
    ...(e.location ? { location: e.location } : {}),
  }))

  const todosFormatted = todos.map((t, i) => ({
    index: i,
    title: t.title,
    duration: t.duration,
    priority: t.priority,
    ...(t.timePreference ? { timePreference: t.timePreference } : {}),
    ...(t.location ? { location: t.location } : {}),
  }))

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      messages: [
        {
          role: 'system',
          content: `You are a smart calendar scheduling assistant. Given tasks with durations and existing calendar events, schedule ALL tasks into available time slots today.

Rules:
- Schedule EVERY task in the list — do not skip any
- Never overlap with existing events
- Only schedule after the current time
- Add 5-minute breaks between tasks
- Tasks include a "priority" field (lower number = higher priority). Schedule higher-priority tasks in better time slots.
- If a task has a "timePreference", try to honor it (e.g. "morning" → before noon, "after lunch" → after 13:00, "evening" → after 17:00, "before 3pm" → before 15:00). If the preferred slot is taken, find the closest available time.
- If tasks share the same "location", try to group them together to minimize travel.
- Keep within reasonable hours (until 22:00)

Return a JSON object with a "schedule" array. Each item MUST have:
- "index": number (the exact index from the input tasks array — this is critical for matching)
- "startTime": string (HH:MM format, 24-hour)
- "duration": number (minutes)

You MUST return one entry for every task. The schedule array length must equal the tasks array length.`,
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
