import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import App, { dateKey, loadState, makeDefaultState } from './App.jsx';
import JibunTecho, { emptyPlanner, loadPlanner } from './JibunTecho.jsx';
import NotesAndGoogle, { readNotes } from './NotesAndGoogle.jsx';
import { importTimmyOs } from './timmyOsImport.js';
import { CloudStore } from './cloudStore.js';
import './shell.css';

const SHADOW_KEY = 'timmy-shadow-state';
const PLANNER_KEY = 'jibun-techo-state';
const NOTES_KEY = 'timmy-shadow-notes';
const ONEDRIVE_FOLDER_URL = 'https://1drv.ms/f/c/a95c2dfbe131e8db/IgDd5OcW3dTCQZV8J0y-Q1ChAZUHhhLJSanpjO7vygD0_so?e=rBruTv';
const supabase = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
  : null;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function downloadJson(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function DataTools({ data, setData, cloud }) {
  const { planner, shadow, notes } = data;
  const restoreInput = useRef(null);
  const importInput = useRef(null);
  const [message, setMessage] = useState('');

  function downloadBackup() {
    try {
      if (!Array.isArray(notes)) throw new Error('Saved notes are invalid. The backup was not created.');
      const backup = { app: 'Timmy Life Journal', version: 1, exportedAt: new Date().toISOString(), data: { shadow, planner, notes } };
      downloadJson(backup, `timmy-life-journal-${dateKey()}.json`);
      setMessage('Backup downloaded. Store it somewhere private.');
    } catch (error) {
      setMessage(`Could not create backup: ${error.message}`);
    }
  }

  async function restoreBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      let updates;
      if (backup?.app === 'Timmy Life Journal' && backup.version === 1) {
        const { shadow: savedShadow, planner: savedPlanner, notes } = backup.data || {};
        if (!isObject(savedShadow) || !isObject(savedShadow.entries) || !isObject(savedShadow.habitsByDate) ||
            !Array.isArray(savedShadow.habitDefinitions) || !isObject(savedPlanner) || !Array.isArray(savedPlanner.events) ||
            !Array.isArray(savedPlanner.todos) || !isObject(savedPlanner.days) || !isObject(savedPlanner.monthGoals) ||
            !isObject(savedPlanner.yearGoals) || typeof savedPlanner.memos !== 'string' || !Array.isArray(notes) ||
            notes.some((note) => !isObject(note) || typeof note.id !== 'string')) {
          throw new Error('This life journal backup is incomplete or invalid.');
        }
        updates = { shadow: loadState(dateKey(), savedShadow), planner: { ...emptyPlanner, ...savedPlanner }, notes };
      } else {
        const savedShadow = backup?.app === 'Timmy’sShadow' ? backup.data : backup;
        if (!isObject(savedShadow) || !(isObject(savedShadow.habitsByDate) || isObject(savedShadow.entries) || isObject(savedShadow.workoutLogs) || isObject(savedShadow.workoutPlans))) {
          throw new Error('This is not a supported life journal or Timmy’sShadow backup.');
        }
        updates = { shadow: loadState(dateKey(), savedShadow) };
      }
      if (!window.confirm(Object.keys(updates).length === 1
        ? 'Restore the older Shadow backup? This replaces your Shadow data but leaves planner and notes unchanged.'
        : `Restore this backup? This replaces the journal, planner, health data, and notes ${cloud ? 'in your cloud account' : 'in this browser'}.`)) return;
      setData((current) => ({ ...current, ...updates }));
      setMessage('Backup restored.');
    } catch (error) {
      setMessage(error instanceof SyntaxError ? 'The file is not valid JSON.' : `Could not restore: ${error.message}`);
    } finally {
      event.target.value = '';
    }
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = importTimmyOs(JSON.parse(await file.text()), planner, shadow);
      if (!window.confirm('Merge this Timmy OS backup? Existing entries are kept; imported journal text is appended when there is a conflict.')) return;
      setData((current) => ({ ...current, planner: result.planner, shadow: result.shadow }));
      setMessage('Timmy OS data merged. Check the planner, journal, and habits.');
    } catch (error) {
      setMessage(error instanceof SyntaxError ? 'The file is not valid JSON.' : `Could not import: ${error.message}`);
    } finally {
      event.target.value = '';
    }
  }

  return <details className="data-tools">
    <summary>Backup &amp; import</summary>
    <div className="data-panel">
      <p>Back up the planner, journal, habits, health data, and Second Brain together. Backups contain personal information.</p>
      <button onClick={downloadBackup}>Download backup</button>
      <button onClick={() => restoreInput.current?.click()}>Restore backup</button>
      <button onClick={() => importInput.current?.click()}>Import Timmy OS</button>
      <input ref={restoreInput} type="file" accept=".json,application/json" onChange={restoreBackup} hidden aria-label="Choose a life journal backup" />
      <input ref={importInput} type="file" accept=".json,application/json" onChange={importBackup} hidden aria-label="Choose a Timmy OS backup" />
      <a href={ONEDRIVE_FOLDER_URL} target="_blank" rel="noopener noreferrer">Open OneDrive folder ↗</a>
      <p>OneDrive storage is manual, not automatic sync. Export JSON from Timmy OS before importing it here.</p>
      {message && <p role="status">{message}</p>}
    </div>
  </details>;
}

function Journal({ data, setData, cloud = false, accountControls = null, storageError = '' }) {
  const [page, setPage] = useState('planner');
  const [date, setDate] = useState(dateKey);
  const { planner, shadow, notes } = data;
  const setPart = (key) => (value) => setData((current) => ({
    ...current, [key]: typeof value === 'function' ? value(current[key]) : value,
  }));
  const setPlanner = setPart('planner');
  const setShadow = setPart('shadow');

  return <>
    <header className="life-nav">
      <strong>Timmy Life Journal</strong>
      <nav aria-label="Life journal">
        {[['planner', 'Planner'], ['daily', 'Daily & health'], ['brain', 'Second Brain']].map(([key, label]) =>
          <button key={key} type="button" aria-current={page === key ? 'page' : undefined} onClick={() => setPage(key)}>{label}</button>)}
      </nav>
      {accountControls}
      <DataTools data={data} setData={setData} cloud={cloud} />
    </header>
    {storageError && <p className="storage-error" role="alert">{storageError}</p>}
    {page === 'planner' && <JibunTecho s={planner} setS={setPlanner} date={date} setDate={setDate} shadow={shadow} setShadow={setShadow} openBrain={() => setPage('brain')} />}
    {page === 'daily' && <App state={shadow} setState={setShadow} selectedDate={date} setSelectedDate={setDate} cloud={cloud} />}
    {page === 'brain' && <main className="brain-page"><NotesAndGoogle notes={notes} setNotes={setPart('notes')} cloud={cloud} /></main>}
  </>;
}

function LocalJournal({ onCloud }) {
  const [data, setData] = useState(() => ({ planner: loadPlanner(), shadow: loadState(dateKey()), notes: readNotes() }));
  const [error, setError] = useState('');
  useEffect(() => {
    const updates = { [PLANNER_KEY]: data.planner, [SHADOW_KEY]: data.shadow, [NOTES_KEY]: data.notes };
    let previous;
    try {
      previous = Object.fromEntries(Object.keys(updates).map((key) => [key, localStorage.getItem(key)]));
      for (const [key, value] of Object.entries(updates)) localStorage.setItem(key, JSON.stringify(value));
      setError('');
    } catch {
      try {
        if (previous) for (const [key, value] of Object.entries(previous)) {
          if (value === null) localStorage.removeItem(key);
          else localStorage.setItem(key, value);
        }
        setError('Could not save your data in this browser. Free storage space and make a backup before leaving.');
      } catch {
        setError('Browser storage failed and could not be rolled back. Download a backup before leaving.');
      }
    }
  }, [data]);
  return <Journal data={data} setData={setData} storageError={error}
    accountControls={onCloud && <button onClick={onCloud}>Cloud sign in</button>} />;
}

function ConflictBackups({ userId }) {
  const [backups, setBackups] = useState([]);
  const [message, setMessage] = useState('');
  async function load() {
    const { data, error } = await supabase.from('shadow_conflict_backups').select('id,created_at')
      .eq('user_id', userId).order('created_at', { ascending: false });
    if (error) setMessage(`Could not load conflict backups: ${error.message}`);
    else { setBackups(data); setMessage(data.length ? '' : 'No conflict backups.'); }
  }
  async function download(id, version) {
    const { data, error } = await supabase.from('shadow_conflict_backups').select('versions')
      .eq('id', id).eq('user_id', userId).single();
    if (error) setMessage(`Could not download conflict backup: ${error.message}`);
    else downloadJson({ app: 'Timmy Life Journal', version: 1, exportedAt: new Date().toISOString(), data: data.versions[version] }, `timmy-conflict-${id}-${version}.json`);
  }
  return <details className="data-tools"><summary>Conflict backups</summary><div className="data-panel">
    <p>Each backup contains both versions before automatic conflict resolution. Keep downloads private.</p>
    <button onClick={load}>Load conflict backups</button>
    {backups.map((item) => <div key={item.id}><span>{new Date(item.created_at).toLocaleString()} </span>
      <button onClick={() => download(item.id, 'local')}>Download local version</button>
      <button onClick={() => download(item.id, 'remote')}>Download cloud version</button></div>)}
    {message && <p role="status">{message}</p>}
  </div></details>;
}

function CloudJournal({ store, user, role, signOut, changeRole, offline, login }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [message, setMessage] = useState('');
  async function leave() {
    if ((store.dirty || store.busy) && !window.confirm('There are changes waiting to sync. They will remain in this browser, but will not appear on other devices until you sign in here and sync. Sign out?')) return;
    if (store.cacheError) { setMessage('The offline copy could not be saved. Download a backup and resolve the storage error before signing out.'); return; }
    const failure = await signOut();
    if (failure) setMessage(`Could not sign out: ${failure.message}`);
  }
  function relabel() {
    if (store.dirty || store.busy) { setMessage('Wait for changes to sync before changing this device label.'); return; }
    try { localStorage.removeItem('timmy-shadow-device-role'); changeRole(); }
    catch (failure) { setMessage(`Could not change device label: ${failure.message}`); }
  }
  async function downloadCloud() {
    try {
      const remote = await store.readRemote();
      downloadJson({ app: 'Timmy Life Journal', version: 1, exportedAt: new Date().toISOString(), data: remote.data }, `timmy-cloud-${dateKey()}.json`);
    } catch (failure) { setMessage(`Could not download cloud data: ${failure.message}`); }
  }
  return <Journal data={state.data} setData={(update) => store.update(update)} cloud storageError={state.error}
    accountControls={<>
      <span role="status">{offline ? 'Offline copy; sign in to sync' : state.status} · {role === 'pc' ? 'PC' : 'Phone/tablet'}</span>
      {offline && <button onClick={async () => {
        const failure = await login();
        if (failure) setMessage(`Could not sign in: ${failure.message}`);
      }}>Sign in to sync</button>}
      <button onClick={() => store.schedule(0)}>Sync now</button>
      <button onClick={downloadCloud}>Download cloud copy</button>
      <button onClick={relabel}>Change device label</button>
      <ConflictBackups userId={user.id} />
      <button onClick={leave}>Sign out</button>
      {message && <span role="alert">{message}</span>}
    </>} />;
}

function CloudSession({ user, role, signOut, changeRole, offline, login }) {
  const [store, setStore] = useState(null);
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let release;
    let activeStore;
    if (!navigator.locks) {
      setError('This browser does not support the exclusive lock needed for safe cloud editing. Use a current browser.');
      return undefined;
    }
    const timer = setTimeout(() => {
      navigator.locks.request(`timmy-shadow:${user.id}`, { ifAvailable: true }, async (lock) => {
        if (cancelled) return;
        if (!lock) { setLocked(true); setError('This account is already open in another tab. Close that tab and reload before editing here.'); return; }
        const initial = { planner: structuredClone(emptyPlanner), shadow: makeDefaultState(dateKey()), notes: [] };
        activeStore = new CloudStore(supabase, user.id, role, initial);
        const held = new Promise((resolve) => { release = resolve; });
        activeStore.start().then(() => {
          if (!cancelled) setStore(activeStore);
        }).catch((failure) => {
          if (!cancelled) setError(`Could not open cloud data: ${failure.message}`);
          release();
        });
        await held;
        activeStore.close();
      }).catch((failure) => { if (!cancelled) setError(`Could not lock cloud data: ${failure.message}`); });
    }, 0);
    return () => { cancelled = true; clearTimeout(timer); activeStore?.close(); release?.(); };
  }, [user.id, role]);
  if (error) return <main className="brain-page"><p role="alert">{error}</p>
    {locked ? <button onClick={() => window.location.reload()}>Retry</button> : <button onClick={signOut}>Back to sign in</button>}
  </main>;
  if (!store) return <main className="brain-page"><p role="status">Opening your cloud journal...</p></main>;
  return <CloudJournal store={store} user={user} role={role} signOut={signOut} changeRole={changeRole} offline={offline} login={login} />;
}

function Root() {
  const [session, setSession] = useState(undefined);
  const [local, setLocal] = useState(!supabase);
  const [offlineUser, setOfflineUser] = useState(null);
  const [role, setRole] = useState(() => localStorage.getItem('timmy-shadow-device-role') || '');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!supabase) { setSession(null); return undefined; }
    let active = true;
    supabase.auth.getSession().then(({ data, error: failure }) => {
      if (active) { setSession(data.session); if (failure) setError(failure.message); }
    }).catch((failure) => {
      if (active) { setSession(null); setError(`Could not check the account: ${failure.message}`); }
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(next);
    });
    return () => { active = false; subscription.subscription.unsubscribe(); };
  }, []);
  async function login() {
    let failure;
    try {
      ({ error: failure } = await supabase.auth.signInWithOAuth({
        provider: 'google', options: { redirectTo: new URL(import.meta.env.BASE_URL, window.location.href).href },
      }));
    } catch (error) { failure = error; }
    if (failure) setError(`Could not sign in: ${failure.message}`);
    return failure;
  }
  async function signOut() {
    if (!session) { setOfflineUser(null); return null; }
    let failure;
    try { ({ error: failure } = await supabase.auth.signOut()); }
    catch (error) { failure = error; }
    if (failure) { setError(`Could not sign out: ${failure.message}`); return failure; }
    else { setSession(null); setOfflineUser(null); setLocal(false); }
    return null;
  }
  if (local) return <LocalJournal onCloud={supabase && (() => setLocal(false))} />;
  if (session === undefined) return <main className="brain-page"><p>Checking your account...</p></main>;
  if (!session && !offlineUser) return <main className="brain-page">
    <h1>Timmy Life Journal</h1>
    <p>Sign in for cloud sync, or open the data already stored in this browser to export a backup.</p>
    <button onClick={login}>Sign in with Google</button>{' '}
    <button onClick={() => setLocal(true)}>Open local journal</button>
    {localStorage.getItem('timmy-shadow-offline-user') && <button onClick={() => {
      setOfflineUser({ id: localStorage.getItem('timmy-shadow-offline-user') });
    }}>Open last offline cloud copy</button>}
    <p>Offline copies remain on this device after sign-out. Anyone with access to this browser may be able to read them.</p>
    {error && <p role="alert">{error}</p>}
  </main>;
  if (role !== 'pc' && role !== 'mobile') return <main className="brain-page">
    <h1>Identify this device</h1>
    <p>When the same entry is changed on PC and phone or tablet, the PC version wins and both versions are backed up.</p>
    {['pc', 'mobile'].map((value) => <button key={value} onClick={() => {
      try { localStorage.setItem('timmy-shadow-device-role', value); setRole(value); }
      catch (failure) { setError(`Could not remember this device: ${failure.message}`); }
    }}>{value === 'pc' ? 'This is my PC' : 'This is my phone or tablet'}</button>)}
    {error && <p role="alert">{error}</p>}
  </main>;
  const user = session?.user || offlineUser;
  return <CloudSession key={`${user.id}:${session ? 'signed-in' : 'offline'}`} user={user} role={role}
    signOut={signOut} changeRole={() => setRole('')} offline={!session} login={login} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><Root /></React.StrictMode>);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js'));
}
