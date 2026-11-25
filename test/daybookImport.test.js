import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importDaybook } from '../src/daybookImport.js';

const shadow = { entries: { '2027-03-04': { journal: 'Existing', recovery: 'Rest' } } };
const backup = {
  year: 2027,
  entries: {
    '2027-03-04': { answers: ['A walk', '', 'Rest'], completed: false },
    '2027-03-05': { answers: ['', '', ''], completed: false },
  },
};

test('appends answered Daybook reflections without touching existing data', () => {
  const { shadow: result, imported } = importDaybook(backup, shadow);
  assert.equal(imported, 1);
  assert.equal(result.entries['2027-03-04'].journal, 'Existing\n\n--- Imported from Daybook 2027 ---\nWhat stood out today?\nA walk\n\nWhat do you want to carry into tomorrow?\nRest');
  assert.equal(result.entries['2027-03-04'].recovery, 'Rest');
  assert.equal(result.entries['2027-03-05'], undefined);
  assert.equal(shadow.entries['2027-03-04'].journal, 'Existing');
});

test('reimporting the same Daybook backup does not duplicate text', () => {
  const first = importDaybook(backup, shadow).shadow;
  const second = importDaybook(backup, first);
  assert.equal(second.imported, 0);
  assert.equal(second.shadow.entries['2027-03-04'].journal, first.entries['2027-03-04'].journal);
});

test('rejects invalid Daybook backups', () => {
  assert.throws(() => importDaybook({}, shadow), /not a Daybook/);
  assert.throws(() => importDaybook({ entries: { '2027-02-30': { answers: ['x'] } } }, shadow), /invalid records/);
  assert.throws(() => importDaybook({ entries: { '2027-01-01': { answers: [1] } } }, shadow), /invalid records/);
});
