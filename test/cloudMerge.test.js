import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeCloudData, updateMetadata } from '../src/cloudMerge.js';

test('merges unrelated edits and prefers a PC on a conflicting field', () => {
  const base = { entries: { a: 'old', b: 'old' }, tasks: [{ id: '1', text: 'one' }] };
  const pc = { entries: { a: 'pc', b: 'old', c: 'new' }, tasks: [{ id: '1', text: 'one' }, { id: '2', text: 'two' }] };
  const phone = { entries: { a: 'phone', b: 'phone' }, tasks: [{ id: '1', text: 'edited' }, { id: '3', text: 'three' }] };
  const metadata = updateMetadata({}, base, phone, 'mobile', 2);
  const result = mergeCloudData(base, pc, phone, { role: 'pc', metadata, baseRevision: 1 });
  assert.deepEqual(result.data.entries, { a: 'pc', b: 'phone', c: 'new' });
  assert.deepEqual(result.data.tasks.map((t) => t.id).sort(), ['1', '2', '3']);
  assert.equal(result.data.tasks.find((t) => t.id === '1').text, 'edited');
  assert.equal(result.conflicts, 1);
});

test('phone cannot overwrite a concurrent PC edit, including a deletion', () => {
  const base = { entries: { today: 'old', yesterday: 'old' } };
  const phone = { entries: { today: 'phone', yesterday: 'phone' } };
  const pc = { entries: { today: 'pc' } };
  const metadata = updateMetadata({}, base, pc, 'pc', 2);
  const result = mergeCloudData(base, phone, pc, { role: 'mobile', metadata, baseRevision: 1 });
  assert.deepEqual(result.data, pc);
  assert.equal(result.conflicts, 2);
});

test('rejects concurrent edits to arrays without stable identities', () => {
  assert.throws(() => mergeCloudData({ values: [1] }, { values: [1, 2] }, { values: [1, 3] },
    { role: 'pc', metadata: {}, baseRevision: 1 }), /unsupported/);
});
