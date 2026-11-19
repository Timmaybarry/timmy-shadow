const CALENDAR = 'https://www.googleapis.com/calendar/v3';

async function request(token, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  if (!response.ok) {
    let message = '';
    try { message = (await response.json()).error?.message || ''; } catch { /* The response may not be JSON. */ }
    throw new Error(`Google request failed (${response.status})${message ? `: ${message}` : ''}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function pages(token, url) {
  const items = [];
  let pageToken;
  do {
    const pageUrl = new URL(url);
    if (pageToken) pageUrl.searchParams.set('pageToken', pageToken);
    const result = await request(token, pageUrl);
    items.push(...(result.items || []));
    pageToken = result.nextPageToken;
  } while (pageToken);
  return items;
}

export function dayBounds(date) {
  const [year, month, day] = date.split('-').map(Number);
  return {
    start: new Date(year, month - 1, day).toISOString(),
    end: new Date(year, month - 1, day + 1).toISOString(),
  };
}

export async function fetchGoogleEvents(token, date) {
  const bounds = dayBounds(date);
  const calendars = await pages(token, `${CALENDAR}/users/me/calendarList?minAccessRole=reader`);
  const eventGroups = await Promise.all(calendars.filter((calendar) => calendar.selected !== false).map(async (calendar) => {
    const url = new URL(`${CALENDAR}/calendars/${encodeURIComponent(calendar.id)}/events`);
    url.search = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', timeMin: bounds.start, timeMax: bounds.end, maxResults: '250' });
    return (await pages(token, url)).filter((event) => event.status !== 'cancelled').map((event) => ({ ...event, calendarName: calendar.summary || 'Calendar', calendarId: calendar.id }));
  }));
  return eventGroups.flat().sort((a, b) => {
    if (Boolean(a.start?.date) !== Boolean(b.start?.date)) return a.start?.date ? -1 : 1;
    return new Date(a.start?.dateTime || a.start?.date || 0) - new Date(b.start?.dateTime || b.start?.date || 0);
  });
}
