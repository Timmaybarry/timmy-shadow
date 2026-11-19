import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { dayBounds, fetchGoogleEvents } from '../src/googlePlanner.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('day boundaries follow local midnight across daylight saving changes', () => {
  const previous = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    assert.deepEqual(dayBounds('2026-03-08'), { start: '2026-03-08T05:00:00.000Z', end: '2026-03-09T04:00:00.000Z' });
    assert.deepEqual(dayBounds('2026-11-01'), { start: '2026-11-01T04:00:00.000Z', end: '2026-11-02T05:00:00.000Z' });
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test('fetches events from selected calendars and sorts them by start time', async () => {
  const calls = [];
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    calls.push(url);
    assert.equal(options.headers.Authorization, 'Bearer token');
    assert.equal(options.cache, 'no-store');
    let data;
    if (url.pathname.endsWith('/calendarList')) data = { items: [{ id: 'cal/1', summary: 'Personal' }, { id: 'hidden', selected: false }] };
    else if (url.pathname.endsWith('/events')) data = { items: [
      { id: 'later', start: { dateTime: '2026-11-14T15:00:00Z' } },
      { id: 'all-day', start: { date: '2026-11-14' } },
      { id: 'cancelled', status: 'cancelled', start: { dateTime: '2026-11-14T10:00:00Z' } },
      { id: 'earlier', start: { dateTime: '2026-11-14T10:00:00Z' } },
    ] };
    return new Response(JSON.stringify(data), { status: 200 });
  };
  const result = await fetchGoogleEvents('token', '2026-11-14');
  assert.deepEqual(result.map((event) => event.id), ['all-day', 'earlier', 'later']);
  assert.equal(result[0].calendarName, 'Personal');
  assert.equal(calls.some((url) => url.pathname.includes('hidden')), false);
  assert.equal(calls.length, 2);
  const events = calls.find((url) => url.pathname.endsWith('/events'));
  assert.equal(events.searchParams.get('singleEvents'), 'true');
});

test('reports Google API errors rather than presenting incomplete results', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'Permission denied' } }), { status: 403 });
  await assert.rejects(fetchGoogleEvents('token', '2026-11-14'), /403.*Permission denied/);
});
