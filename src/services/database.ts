import { supabase } from '../lib/supabase'
import type { TodoItem, CalendarEvent } from '../types'

// ── Tasks ──

export async function fetchTasks(): Promise<TodoItem[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('completed', false)
    .order('priority', { ascending: true })

  if (error) throw error
  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    duration: row.duration,
    priority: row.priority,
    timePreference: row.time_preference ?? undefined,
    listName: row.list_name ?? 'Default',
  }))
}

export async function createTask(task: Omit<TodoItem, 'id'>, userId: string): Promise<TodoItem> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: userId,
      title: task.title,
      duration: task.duration,
      priority: task.priority,
      time_preference: task.timePreference ?? null,
      list_name: task.listName ?? 'Default',
    })
    .select()
    .single()

  if (error) throw error
  return {
    id: data.id,
    title: data.title,
    duration: data.duration,
    priority: data.priority,
    timePreference: data.time_preference ?? undefined,
    listName: data.list_name ?? 'Default',
  }
}

export async function updateTask(id: string, updates: Partial<TodoItem>): Promise<void> {
  const dbUpdates: Record<string, unknown> = {}
  if (updates.title !== undefined) dbUpdates.title = updates.title
  if (updates.duration !== undefined) dbUpdates.duration = updates.duration
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority
  if (updates.timePreference !== undefined) dbUpdates.time_preference = updates.timePreference
  if (updates.listName !== undefined) dbUpdates.list_name = updates.listName

  const { error } = await supabase.from('tasks').update(dbUpdates).eq('id', id)
  if (error) throw error
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

export async function reorderTasks(tasks: { id: string; priority: number }[]): Promise<void> {
  const promises = tasks.map(({ id, priority }) =>
    supabase.from('tasks').update({ priority }).eq('id', id)
  )
  await Promise.all(promises)
}

// ── Scheduled Events ──

export async function fetchEvents(startDate: string, endDate: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('scheduled_events')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('start_time', { ascending: true })

  if (error) throw error
  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    start: new Date(row.start_time),
    end: new Date(row.end_time),
    todoId: row.task_id ?? undefined,
    googleEventId: row.google_event_id ?? undefined,
    isGoogleEvent: row.is_google_origin,
    completed: row.completed,
    color: row.color,
    date: row.date,
  }))
}

export async function createEvent(
  event: Omit<CalendarEvent, 'id'>,
  userId: string,
): Promise<CalendarEvent> {
  const dateStr = event.date || event.start.toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('scheduled_events')
    .insert({
      user_id: userId,
      task_id: event.todoId ?? null,
      title: event.title,
      start_time: event.start.toISOString(),
      end_time: event.end.toISOString(),
      color: event.color,
      completed: event.completed ?? false,
      google_event_id: event.googleEventId ?? null,
      is_google_origin: event.isGoogleEvent ?? false,
      date: dateStr,
    })
    .select()
    .single()

  if (error) throw error
  return {
    id: data.id,
    title: data.title,
    start: new Date(data.start_time),
    end: new Date(data.end_time),
    todoId: data.task_id ?? undefined,
    googleEventId: data.google_event_id ?? undefined,
    isGoogleEvent: data.is_google_origin,
    completed: data.completed,
    color: data.color,
    date: data.date,
  }
}

export async function updateEvent(id: string, updates: Partial<CalendarEvent>): Promise<void> {
  const dbUpdates: Record<string, unknown> = {}
  if (updates.title !== undefined) dbUpdates.title = updates.title
  if (updates.start !== undefined) dbUpdates.start_time = updates.start.toISOString()
  if (updates.end !== undefined) dbUpdates.end_time = updates.end.toISOString()
  if (updates.color !== undefined) dbUpdates.color = updates.color
  if (updates.completed !== undefined) {
    dbUpdates.completed = updates.completed
    dbUpdates.completed_at = updates.completed ? new Date().toISOString() : null
  }
  if (updates.googleEventId !== undefined) dbUpdates.google_event_id = updates.googleEventId

  const { error } = await supabase.from('scheduled_events').update(dbUpdates).eq('id', id)
  if (error) throw error
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('scheduled_events').delete().eq('id', id)
  if (error) throw error
}

// ── Daily Stats ──

export async function getCompletionStats(date: string): Promise<{ tasksCompleted: number; tasksCreated: number }> {
  const { data, error } = await supabase
    .from('daily_stats')
    .select('tasks_completed, tasks_created')
    .eq('date', date)
    .maybeSingle()

  if (error) throw error
  return {
    tasksCompleted: data?.tasks_completed ?? 0,
    tasksCreated: data?.tasks_created ?? 0,
  }
}

export async function incrementCompletionStats(
  userId: string,
  date: string,
  field: 'tasks_completed' | 'tasks_created',
): Promise<void> {
  const { data: existing } = await supabase
    .from('daily_stats')
    .select('id, tasks_completed, tasks_created')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('daily_stats')
      .update({ [field]: (existing[field] ?? 0) + 1 })
      .eq('id', existing.id)
  } else {
    await supabase.from('daily_stats').insert({
      user_id: userId,
      date,
      [field]: 1,
    })
  }
}

export async function fetchRecentStats(days: number): Promise<{ date: string; tasksCompleted: number }[]> {
  const dates: string[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }

  const { data, error } = await supabase
    .from('daily_stats')
    .select('date, tasks_completed')
    .in('date', dates)

  if (error) throw error
  return (data || []).map((row) => ({
    date: row.date,
    tasksCompleted: row.tasks_completed ?? 0,
  }))
}
