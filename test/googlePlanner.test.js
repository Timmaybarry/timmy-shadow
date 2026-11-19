import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleTask, dayBounds, fetchGoogleCalendarDay, fetchGoogleDay, googleTaskKey, setGoogleTaskDone, taskVisibleOn } from '../src/googlePlanner.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('open tasks include overdue and undated; completed tasks appear only on their due date', () => {
  const date = '2026-11-14';
  assert.equal(taskVisibleOn({ status: 'needsAction' }, date), true);
  assert.equal(taskVisibleOn({ status: 'needsAction', due: '2026-11-13T00:00:00.000Z' }, date), true);
  assert.equal(taskVisibleOn({ status: 'needsAction', due: '2026-11-15T00:00:00.000Z' }, date), false);
  assert.equal(taskVisibleOn({ status: 'completed', due: '2026-11-14T00:00:00.000Z' }, date), true);
  assert.equal(taskVisibleOn({ status: 'completed', due: '2026-11-13T00:00:00.000Z' }, date), false);
  assert.equal(taskVisibleOn({ status: 'completed' }, date), false);
});

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

test('fetches paginated selected calendars and task lists, filtering the selected day', async () => {
  const calls = [];
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    calls.push(url);
    assert.equal(options.headers.Authorization.slice(0, 7), ['Bear', 'er '].join(''));
    assert.equal(options.cache, 'no-store');
    let data;
    if (url.pathname.endsWith('/calendarList')) data = { items: [{ id: 'cal/1', summary: 'Personal' }, { id: 'hidden', selected: false }] };
    else if (url.pathname.endsWith('/@me/lists')) data = url.searchParams.has('pageToken')
      ? { items: [{ id: 'list2', title: 'Other' }] }
      : { items: [{ id: 'list/1', title: 'Personal tasks' }], nextPageToken: 'next' };
    else if (url.pathname.endsWith('/events')) data = { items: [{ id: 'event', start: { date: '2026-11-14' } }] };
    else if (url.pathname.includes('list%2F1')) data = { items: [{ id: 'a', title: 'Due', due: '2026-11-14T00:00:00Z' }, { id: 'b', due: '2026-11-15T00:00:00Z' }] };
    else data = { items: [{ id: 'c', title: 'Undated' }] };
    return new Response(JSON.stringify(data), { status: 200 });
  };
  const result = await fetchGoogleDay('token', '2026-11-14');
  assert.equal(result.events[0].calendarName, 'Personal');
  assert.deepEqual(result.tasks.map((task) => task.id), ['a', 'c']);
  assert.equal(result.taskLists.length, 2);
  assert.equal(calls.some((url) => url.pathname.includes('hidden')), false);
  const events = calls.find((url) => url.pathname.endsWith('/events'));
  assert.equal(events.searchParams.get('singleEvents'), 'true');
  const tasks = calls.find((url) => url.pathname.includes('/tasks') && url.pathname.includes('/lists/'));
  assert.equal(tasks.searchParams.get('showHidden'), 'true');
  assert.notEqual(googleTaskKey('a:b', 'c'), googleTaskKey('a', 'b:c'));
});

test('creates and reopens Google tasks with the expected date and payload', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response('{}', { status: 200 });
  };
  await createGoogleTask('token', 'list/1', 'Plan', '2026-11-14');
  await setGoogleTaskDone('token', 'list/1', 'task/1', false);
  assert.match(calls[0].url, /list%2F1/);
  assert.deepEqual(JSON.parse(calls[0].options.body), { title: 'Plan', due: '2026-11-14T00:00:00.000Z' });
  assert.deepEqual(JSON.parse(calls[1].options.body), { status: 'needsAction', completed: null });
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
  const result = await fetchGoogleCalendarDay('token', '2026-11-14');
  assert.deepEqual(result.events.map((event) => event.id), ['all-day', 'earlier', 'later']);
  assert.equal(result.events[0].calendarName, 'Personal');
  assert.equal(calls.some((url) => url.pathname.includes('hidden')), false);
  assert.equal(calls.length, 2);
  const events = calls.find((url) => url.pathname.endsWith('/events'));
  assert.equal(events.searchParams.get('singleEvents'), 'true');
});

test('reports Google API errors rather than presenting incomplete results', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'Permission denied' } }), { status: 403 });
  await assert.rejects(fetchGoogleCalendarDay('token', '2026-11-14'), /403.*Permission denied/);
});

test('calendar-only schedule does not request Google Tasks', async () => {
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    calls.push(url.href);
    const items = url.pathname.endsWith('/calendarList')
      ? [{ id: 'personal', summary: 'Personal' }]
      : [{ id: 'event', summary: 'Meeting', start: { date: '2026-11-14' } }];
    return new Response(JSON.stringify({ items }), { status: 200 });
  };
  const result = await fetchGoogleCalendarDay('token', '2026-11-14');
  assert.equal(result.events[0].summary, 'Meeting');
  assert.equal(calls.length, 2);
  assert.ok(calls.every((url) => new URL(url).hostname !== 'tasks.googleapis.com'));
});
