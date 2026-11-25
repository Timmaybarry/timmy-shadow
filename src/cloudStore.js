import { mergeCloudData, updateMetadata } from './cloudMerge.js';

const isData = (value) => value && typeof value === 'object' && value.shadow && value.planner && Array.isArray(value.notes);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export class CloudStore {
  constructor(client, userId, role, initialData, storage = localStorage) {
    this.client = client;
    this.userId = userId;
    this.role = role;
    this.initialData = initialData;
    this.storage = storage;
    this.key = `timmy-shadow-cloud:${userId}`;
    this.listeners = new Set();
    this.view = { data: null, status: 'Loading cloud data...', error: '', ready: false };
    this.closed = false;
    this.busy = false;
  }

  subscribe = (listener) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = () => this.view;
  emit(patch) {
    if (this.closed) return;
    this.view = { ...this.view, ...patch };
    for (const listener of this.listeners) listener();
  }
  cache() {
    try {
      this.storage.setItem(this.key, JSON.stringify({
        data: this.data, base: this.base, revision: this.revision, metadata: this.metadata, dirty: this.dirty,
        pendingBackups: this.pendingBackups,
      }));
      this.storage.setItem('timmy-shadow-offline-user', this.userId);
      this.cacheError = '';
    } catch (error) {
      this.cacheError = `Offline copy could not be saved: ${error.message}. Download a backup before leaving.`;
    }
  }
  async readRemote() {
    const { data, error } = await this.client.from('shadow_cloud_state').select('revision,data,metadata')
      .eq('user_id', this.userId).maybeSingle();
    if (error) throw error;
    if (!data) {
      if (this.revision > 0) throw new Error('Cloud data is unavailable or access was revoked; the offline copy was kept');
      return { revision: 0, data: this.initialData, metadata: {} };
    }
    if (!Number.isSafeInteger(data.revision) || !isData(data.data) || !data.metadata || typeof data.metadata !== 'object') {
      throw new Error('Cloud data is invalid; no data was replaced.');
    }
    return data;
  }
  async start() {
    let cached;
    const raw = this.storage.getItem(this.key);
    if (raw) {
      try { cached = JSON.parse(raw); } catch { throw new Error('The offline copy is invalid; it was not overwritten.'); }
      if (!isData(cached.data) || !isData(cached.base) || !Number.isSafeInteger(cached.revision) ||
          !cached.metadata || typeof cached.metadata !== 'object') {
        throw new Error('The offline copy is invalid; it was not overwritten.');
      }
    }
    try {
      const { data: allowed, error } = await this.client.rpc('shadow_is_allowed');
      if (error) throw error;
      if (!allowed) throw new Error('This Google account is not in the journal allowlist.');
      const remote = await this.readRemote();
      if (this.closed) return;
      if (cached) Object.assign(this, cached);
      else Object.assign(this, { data: remote.data, base: remote.data, revision: remote.revision, metadata: remote.metadata, dirty: false, pendingBackups: [] });
    } catch (error) {
      if (this.closed) return;
      this.pendingBackups ||= [];
      if (!cached || /not in the journal allowlist/.test(error.message)) throw error;
      Object.assign(this, cached);
      this.offlineError = `Cloud unavailable: ${error.message}. Changes remain on this device until sync succeeds.`;
    }
    if (this.closed) return;
    this.cache();
    this.emit({ ready: true, data: this.data, status: this.dirty ? 'Changes waiting to sync' : 'Ready', error: this.cacheError || this.offlineError || '' });
    this.channel = this.client.channel(`shadow-${this.userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shadow_cloud_state', filter: `user_id=eq.${this.userId}` }, () => this.schedule(0))
      .subscribe((status) => { if (status === 'SUBSCRIBED') this.schedule(0); });
    this.online = () => this.schedule(0);
    globalThis.addEventListener?.('online', this.online);
    globalThis.addEventListener?.('focus', this.online);
    this.interval = setInterval(() => this.schedule(0), 15000);
    this.schedule(0);
  }
  update(updater) {
    const next = typeof updater === 'function' ? updater(this.data) : updater;
    if (!isData(next)) throw new Error('Invalid journal data.');
    if (equal(next, this.data)) return;
    this.data = next;
    this.dirty = true;
    this.cache();
    this.emit({ data: this.data, status: 'Changes waiting to sync', error: this.cacheError || '' });
    this.schedule(800);
  }
  schedule(delay) {
    if (this.closed) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.sync(), delay);
  }
  async sync() {
    if (this.closed) return;
    if (this.busy) { this.again = true; return; }
    this.busy = true;
    try {
      const remote = await this.readRemote();
      if (this.closed) return;
      if (!this.dirty) {
        if (remote.revision !== this.revision) {
          this.data = remote.data;
          this.base = remote.data;
          this.revision = remote.revision;
          this.metadata = remote.metadata;
          this.cache();
        }
        this.emit({ data: this.data, status: 'Synced', error: this.cacheError || '' });
        return;
      }
      const snapshot = this.data;
      let merged = snapshot;
      const versions = [...this.pendingBackups];
      if (remote.revision !== this.revision) {
        const result = mergeCloudData(this.base, snapshot, remote.data, {
          role: this.role, metadata: remote.metadata, baseRevision: this.revision,
        });
        merged = result.data;
        if (result.conflicts) versions.push({ baseRevision: this.revision, localRole: this.role, local: snapshot, remote: remote.data });
      }
      const metadata = updateMetadata(remote.metadata, remote.data, merged, this.role, remote.revision + 1);
      const { data: rows, error } = await this.client.rpc('shadow_save', {
        expected_revision: remote.revision, next_data: merged, next_metadata: metadata, conflict_versions: versions,
      });
      if (error) throw error;
      if (this.closed) return;
      if (!rows?.length) { this.again = true; return; }
      const saved = rows[0];
      if (!isData(saved.data) || !Number.isSafeInteger(saved.revision)) throw new Error('Unexpected cloud save response.');
      this.pendingBackups = [];
      if (this.data === snapshot) {
        this.data = saved.data;
      } else {
        const result = mergeCloudData(snapshot, this.data, saved.data, {
          role: this.role, metadata: saved.metadata, baseRevision: this.revision,
        });
        if (result.conflicts) this.pendingBackups.push({
          baseRevision: this.revision, localRole: this.role, local: this.data, remote: saved.data,
        });
        this.data = result.data;
      }
      this.base = saved.data;
      this.revision = saved.revision;
      this.metadata = saved.metadata;
      this.dirty = !equal(this.data, this.base) || this.pendingBackups.length > 0;
      this.cache();
      this.emit({ data: this.data, status: this.dirty ? 'Changes waiting to sync' : versions.length ? 'Synced; conflict versions were backed up' : 'Synced', error: this.cacheError || '' });
      if (this.dirty) this.again = true;
    } catch (error) {
      this.emit({ status: 'Sync paused', error: `${error.message || 'Cloud sync failed'}. Your current copy remains on this device; download a backup.` });
    } finally {
      this.busy = false;
      if (this.again && !this.closed) { this.again = false; this.schedule(0); }
    }
  }
  close() {
    this.closed = true;
    clearTimeout(this.timer);
    clearInterval(this.interval);
    globalThis.removeEventListener?.('online', this.online);
    globalThis.removeEventListener?.('focus', this.online);
    if (this.channel) this.client.removeChannel(this.channel);
  }
}
