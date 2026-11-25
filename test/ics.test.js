import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toIcs } from '../src/ics.js';

const planner = {
  events: [
    { id: 'e1', title: 'Lunch, with; team', date: '2026-12-31', start: '12:00', end: '13:30' },
    { id: 'e2', title: 'Holiday', date: '2026-12-31', start: '', end: '' },
    { id: 'e3', title: 'Bad end', date: '2026-12-31', start: '10:00', end: '09:00' },
  ],
  todos: [
    { id: 't1', text: 'Pay bill', date: '2026-12-31', done: true },
    { id: 't2', text: 'Undated', date: '', done: false },
  ],
};

test('exports timed, all-day and task entries as iCalendar', () => {
  const ics = toIcs(planner, '20260101T000000Z');
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.match(ics, /SUMMARY:Lunch\\, with\\; team/);
  assert.match(ics, /DTSTART:20261231T120000\r\nDTEND:20261231T133000/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101/);
  assert.match(ics, /SUMMARY:☑ Pay bill/);
});

test('omits invalid end times and undated tasks', () => {
  const ics = toIcs(planner, '20260101T000000Z');
  assert.doesNotMatch(ics, /T090000/);
  assert.doesNotMatch(ics, /Undated/);
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 4);
});
