export async function fetchEventsForDateRange(
  accessToken: string,
  startDate: Date,
  endDate: Date,
) {
  const params = new URLSearchParams({
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
  })

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Failed to fetch calendar events')
  }

  const data = await response.json()
  return (data.items || []).map(
    (item: {
      id: string
      summary?: string
      start: { dateTime?: string; date?: string }
      end: { dateTime?: string; date?: string }
    }) => ({
      id: item.id,
      title: item.summary || '(No title)',
      start: new Date(item.start.dateTime || item.start.date || ''),
      end: new Date(item.end.dateTime || item.end.date || ''),
    }),
  )
}

export async function createGoogleEvent(
  accessToken: string,
  event: { title: string; start: Date; end: Date },
): Promise<string> {
  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: event.title,
        start: { dateTime: event.start.toISOString() },
        end: { dateTime: event.end.toISOString() },
      }),
    },
  )

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Failed to create event')
  }

  const data = await response.json()
  return data.id
}

export async function updateGoogleEvent(
  accessToken: string,
  eventId: string,
  event: { title: string; start: Date; end: Date },
): Promise<void> {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: event.title,
        start: { dateTime: event.start.toISOString() },
        end: { dateTime: event.end.toISOString() },
      }),
    },
  )

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Failed to update event')
  }
}

export async function deleteGoogleEvent(accessToken: string, eventId: string): Promise<void> {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  )

  if (!response.ok && response.status !== 404) {
    throw new Error('Failed to delete event')
  }
}
