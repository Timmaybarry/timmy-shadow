import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudStore } from '../src/cloudStore.js';

function storage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
function client(server) {
  const channel = { on() { return this; }, subscribe() { return this; } };
  return {
    channel: () => channel,
    removeChannel() {},
    from() {
      return { select() { return this; }, eq() { return this; }, async maybeSingle() {
        return server.offline ? { error: new Error('offline') } : { data: server.row };
      } };
    },
    async rpc(name, args) {
      if (server.offline) return { error: new Error('offline') };
      if (name === 'shadow_is_allowed') return { data: server.allowed !== false };
      if (server.pause) await server.pause();
      if ((server.row?.revision || 0) !== args.expected_revision) return { data: [] };
      server.row = { revision: args.expected_revision + 1, data: args.next_data, metadata: args.next_metadata };
      server.backups.push(...args.conflict_versions);
      return { data: [server.row] };
    },
  };
}
const initial = { planner: { todos: [] }, shadow: { entries: {} }, notes: [] };
async function open(server, role, cache = storage()) {
  const store = new CloudStore(client(server), 'user-1', role, initial, cache);
  store.schedule = () => {};
  await store.start();
  return store;
}

test('sync merges unrelated device changes, prefers PC, and stores both conflict versions', async () => {
  const server = { row: null, backups: [] };
  const pc = await open(server, 'pc');
  pc.update((data) => ({ ...data, shadow: { entries: { day: 'original' } } }));
  await pc.sync();
  const mobile = await open(server, 'mobile');
  pc.update((data) => ({ ...data, shadow: { entries: { day: 'pc', pcOnly: 'pc' } } }));
  mobile.update((data) => ({ ...data, shadow: { entries: { day: 'phone', phoneOnly: 'phone' } } }));
  await pc.sync();
  await mobile.sync();
  assert.deepEqual(server.row.data.shadow.entries, { day: 'pc', pcOnly: 'pc', phoneOnly: 'phone' });
  assert.equal(server.backups.length, 1);
  assert.equal(server.backups[0].local.shadow.entries.day, 'phone');
  assert.equal(server.backups[0].remote.shadow.entries.day, 'pc');
  pc.close(); mobile.close();
});

test('keeps offline changes across a restart and syncs them after reconnecting', async () => {
  const server = { row: null, backups: [] };
  const cache = storage();
  const first = await open(server, 'mobile', cache);
  await first.sync();
  server.offline = true;
  first.update((data) => ({ ...data, notes: [{ id: 'note', title: 'offline' }] }));
  await first.sync();
  assert.match(first.getSnapshot().error, /offline/);
  first.close();
  const restored = await open(server, 'mobile', cache);
  assert.equal(restored.getSnapshot().data.notes[0].title, 'offline');
  server.offline = false;
  await restored.sync();
  assert.equal(server.row.data.notes[0].title, 'offline');
  assert.equal(restored.dirty, false);
  restored.close();
});

test('does not open a cached draft when the account is explicitly denied', async () => {
  const server = { row: null, backups: [] };
  const cache = storage();
  const first = await open(server, 'pc', cache);
  first.close();
  server.allowed = false;
  await assert.rejects(open(server, 'pc', cache), /allowlist/);
});

test('preserves a mobile edit made during a sync as a conflict backup when PC wins', async () => {
  const server = { row: null, backups: [] };
  const pc = await open(server, 'pc');
  pc.update((data) => ({ ...data, shadow: { entries: { day: 'original' } } }));
  await pc.sync();
  const mobile = await open(server, 'mobile');
  pc.update((data) => ({ ...data, shadow: { entries: { day: 'pc' } } }));
  await pc.sync();
  mobile.update((data) => ({ ...data, shadow: { entries: { day: 'first phone edit' } } }));
  let release;
  let started;
  const entered = new Promise((resolve) => { started = resolve; });
  server.pause = () => { started(); return new Promise((resolve) => { release = resolve; }); };
  const syncing = mobile.sync();
  await entered;
  mobile.update((data) => ({ ...data, shadow: { entries: { day: 'later phone edit' } } }));
  server.pause = null;
  release();
  await syncing;
  assert.equal(mobile.getSnapshot().data.shadow.entries.day, 'pc');
  assert.equal(mobile.dirty, true);
  await mobile.sync();
  assert.equal(server.row.data.shadow.entries.day, 'pc');
  assert.ok(server.backups.some((backup) => backup.local.shadow.entries.day === 'later phone edit'));
  pc.close(); mobile.close();
});
