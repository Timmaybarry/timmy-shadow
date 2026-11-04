import test from 'node:test';
import assert from 'node:assert/strict';
import { addFood, deleteFood, normalizeFood, sanitizeFoodLogs, totalsFor, updateFood } from '../src/foodLog.js';

test('normalizeFood validates and parses', () => {
  assert.ok(normalizeFood({ name: ' ', meal: 'Lunch' }).error);
  assert.ok(normalizeFood({ name: 'x', calories: '-5' }).error);
  assert.deepEqual(normalizeFood({ name: ' Egg ', meal: 'Breakfast', calories: '70', protein: '6.25' }).food,
    { meal: 'Breakfast', name: 'Egg', calories: 70, protein: 6.3, carbs: 0, fat: 0 });
});

test('add, update, delete and totals', () => {
  let logs = addFood({}, '2024-01-01', { meal: 'Lunch', name: 'A', calories: 100, protein: 5, carbs: 10, fat: 2 }, 'a');
  logs = addFood(logs, '2024-01-01', { meal: 'Snack', name: 'B', calories: 50, protein: 1, carbs: 5, fat: 1 }, 'b');
  assert.deepEqual(totalsFor(logs['2024-01-01']), { calories: 150, protein: 6, carbs: 15, fat: 3 });
  logs = updateFood(logs, '2024-01-01', 'a', { calories: 200 });
  assert.equal(totalsFor(logs['2024-01-01']).calories, 250);
  logs = deleteFood(logs, '2024-01-01', 'a');
  assert.equal(logs['2024-01-01'].length, 1);
  assert.deepEqual(totalsFor(undefined), { calories: 0, protein: 0, carbs: 0, fat: 0 });
});

test('sanitizeFoodLogs tolerates bad data', () => {
  assert.deepEqual(sanitizeFoodLogs(null), {});
  const out = sanitizeFoodLogs({ d: [{ name: 'X', meal: 'Nope', calories: 'abc' }, null, { name: '' }], e: 5 });
  assert.equal(out.d.length, 1);
  assert.equal(out.d[0].meal, 'Snack');
  assert.equal(out.d[0].calories, 0);
  assert.equal(out.e, undefined);
});
