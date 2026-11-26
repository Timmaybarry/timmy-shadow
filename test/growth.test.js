import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestSlipRun, checkinScore, emptyGrowth, importGrowth, journalStats, progressSummary, slipStreak, topTrigger } from '../src/growth.js';

const scores = { Character: 4, Health: 3, Relationships: 5, 'Work & skills': 2, 'Calm & focus': 1 };
const backup = () => ({
  vision: { 0: 'Kind and calm', 10: '' },
  skills: [{ id: 'a', name: 'Spanish', why: '', current: 2, target: 4, created: '2027-01-02', log: [{ date: '2027-01-03', note: 'Lesson', minutes: 30, level: 2 }] }],
  habits: [{ id: 'b', name: 'Doomscrolling', replacement: 'Read', created: '2027-01-01', slips: [
    { date: '2027-01-10', trigger: 'Boredom', plan: '' }, { date: '2027-01-05', trigger: 'boredom', plan: '' }] }],
  checkins: [{ date: '2027-01-07', scores, win: 'w', lesson: '', focus: 'f' }],
});

test('imports a Daybook growth export with stable IDs and is idempotent', () => {
  const first = importGrowth(backup(), emptyGrowth);
  assert.deepEqual(first.counts, { vision: 1, skills: 1, oldHabits: 1, checkins: 1 });
  assert.equal(first.growth.vision[0], 'Kind and calm');
  assert.ok(first.growth.skills[0].id.startsWith('daybook-growth:'));
  assert.ok(first.growth.skills[0].log[0].id && first.growth.oldHabits[0].slips.every((s) => s.id));
  const second = importGrowth(backup(), first.growth);
  assert.deepEqual(second.counts, { vision: 0, skills: 0, oldHabits: 0, checkins: 0 });
  assert.equal(second.growth.skills.length, 1);
  assert.equal(emptyGrowth.skills.length, 0);
});

test('keeps existing vision text and appends a different import', () => {
  const { growth } = importGrowth(backup(), { ...emptyGrowth, vision: { 0: 'Mine' } });
  assert.equal(growth.vision[0], 'Mine\n\n--- Imported from Daybook 2027 ---\nKind and calm');
});

test('rejects invalid exports without partial results', () => {
  assert.throws(() => importGrowth({}, emptyGrowth), /not a Daybook 2027 growth export/);
  const bad = backup();
  bad.skills[0].target = 9;
  assert.throws(() => importGrowth(bad, emptyGrowth), /nothing was imported/);
});

test('computes slip streaks, triggers, and progress', () => {
  const { growth } = importGrowth(backup(), emptyGrowth);
  const habit = growth.oldHabits[0];
  assert.equal(slipStreak(habit, '2027-01-15'), 5);
  assert.equal(bestSlipRun(habit, '2027-01-15'), 5);
  assert.deepEqual(topTrigger(habit), { trigger: 'boredom', count: 2 });
  assert.equal(checkinScore(growth.checkins[0]), 3);
  const entries = { '2027-01-14': { journal: 'x' }, '2027-01-15': { journal: 'y' }, '2027-01-13': { journal: ' ' } };
  assert.deepEqual(journalStats(entries, '2027-01-15'), { streak: 2, recent: 2 });
  const summary = progressSummary(growth, entries, '2027-01-15');
  assert.equal(summary.skillPercent, 50);
  assert.equal(summary.openGaps, 1);
  assert.equal(summary.visionAnswered, 1);
  assert.equal(summary.longestRun, 5);
});
