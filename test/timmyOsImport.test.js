import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importTimmyOs } from '../src/timmyOsImport.js';

const planner = { events: [], todos: [], days: {}, monthGoals: {}, yearGoals: {}, memos: '' };
const shadow = {
  entries: { '2026-01-02': { journal: 'Existing journal', recovery: 'Rest' } },
  habitDefinitions: [{ id: 'existing', name: 'Existing habit' }],
  habitsByDate: { '2026-01-02': { existing: true } },
};
const backup = {
  journal: { '2026-01-02': 'Imported journal' },
  tasks: [{ id: 'task-1', text: 'Task', date: '2026-01-02', done: true }],
  events: [{ id: 'event-1', title: 'All day', date: '2026-01-02', start: '', end: '' }],
  habits: [{ id: 'habit-1', name: 'Habit', checkins: ['2026-01-02'] }],
};

test('merges all Timmy OS data without overwriting existing records', () => {
  const result = importTimmyOs(backup, planner, shadow);
  assert.equal(result.shadow.entries['2026-01-02'].journal, 'Existing journal\n\n--- Imported from Timmy OS ---\nImported journal');
  assert.equal(result.shadow.entries['2026-01-02'].recovery, 'Rest');
  assert.deepEqual(result.shadow.habitsByDate['2026-01-02'], { existing: true, 'timmy-os:habit-1': true });
  assert.equal(result.shadow.habitDefinitions.length, 2);
  assert.equal(result.planner.todos[0].done, true);
  assert.equal(result.planner.events[0].start, '');
  assert.equal(planner.todos.length, 0);
  assert.equal(shadow.entries['2026-01-02'].journal, 'Existing journal');
});

test('reimport does not duplicate records or overwrite later changes', () => {
  const first = importTimmyOs(backup, planner, shadow);
  first.shadow.habitsByDate['2026-01-02']['timmy-os:habit-1'] = false;
  first.planner.todos[0].done = false;
  const second = importTimmyOs(backup, first.planner, first.shadow);
  assert.equal(second.planner.todos.length, 1);
  assert.equal(second.planner.events.length, 1);
  assert.equal(second.shadow.habitDefinitions.length, 2);
  assert.equal(second.planner.todos[0].done, false);
  assert.equal(second.shadow.habitsByDate['2026-01-02']['timmy-os:habit-1'], false);
  assert.equal(second.shadow.entries['2026-01-02'].journal, first.shadow.entries['2026-01-02'].journal);
});

test('rejects invalid and duplicate records instead of partially importing', () => {
  assert.throws(() => importTimmyOs({ ...backup, tasks: [backup.tasks[0], backup.tasks[0]] }, planner, shadow), /invalid or duplicate/);
  assert.throws(() => importTimmyOs({ ...backup, journal: { '2026-02-30': 'invalid' } }, planner, shadow), /invalid or duplicate/);
  assert.throws(() => importTimmyOs({}, planner, shadow), /not a Timmy OS/);
  assert.deepEqual(planner.todos, []);
});
