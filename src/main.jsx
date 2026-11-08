import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App, { dateKey, loadState } from './App.jsx';
import JibunTecho, { loadPlanner } from './JibunTecho.jsx';
import NotesAndGoogle from './NotesAndGoogle.jsx';
import { importTimmyOs } from './timmyOsImport.js';
import './shell.css';

const SHADOW_KEY = 'timmy-shadow-state';
const PLANNER_KEY = 'jibun-techo-state';
const NOTES_KEY = 'timmy-shadow-notes';
const ONEDRIVE_FOLDER_URL = 'https://1drv.ms/f/c/a95c2dfbe131e8db/IgDd5OcW3dTCQZV8J0y-Q1ChAZUHhhLJSanpjO7vygD0_so?e=rBruTv';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function DataTools({ planner, shadow, setPlanner, setShadow }) {
  const restoreInput = useRef(null);
  const importInput = useRef(null);
  const [message, setMessage] = useState('');

  function downloadBackup() {
    try {
      const notes = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]');
      if (!Array.isArray(notes)) throw new Error('Saved notes are invalid. The backup was not created.');
      const backup = { app: 'Timmy Life Journal', version: 1, exportedAt: new Date().toISOString(), data: { shadow, planner, notes } };
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `timmy-life-journal-${dateKey()}.json`;
      link.click();
      URL.revokeObjectURL(url);
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
        updates = { [SHADOW_KEY]: savedShadow, [PLANNER_KEY]: savedPlanner, [NOTES_KEY]: notes };
      } else {
        const savedShadow = backup?.app === 'Timmy’sShadow' ? backup.data : backup;
        if (!isObject(savedShadow) || !(isObject(savedShadow.habitsByDate) || isObject(savedShadow.entries) || isObject(savedShadow.workoutLogs) || isObject(savedShadow.workoutPlans))) {
          throw new Error('This is not a supported life journal or Timmy’sShadow backup.');
        }
        updates = { [SHADOW_KEY]: savedShadow };
      }
      if (!window.confirm(Object.keys(updates).length === 1
        ? 'Restore the older Shadow backup? This replaces your Shadow data but leaves planner and notes unchanged.'
        : 'Restore this backup? This replaces the journal, planner, health data, and notes in this browser.')) return;
      const previous = Object.fromEntries(Object.keys(updates).map((key) => [key, localStorage.getItem(key)]));
      try {
        for (const [key, value] of Object.entries(updates)) localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        try {
          for (const [key, value] of Object.entries(previous)) {
            if (value === null) localStorage.removeItem(key);
            else localStorage.setItem(key, value);
          }
        } catch {
          throw new Error('Restore failed and storage could not be rolled back. Restore your backup again after freeing browser storage.');
        }
        throw error;
      }
      window.location.reload();
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
      setPlanner(result.planner);
      setShadow(result.shadow);
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

function Root() {
  const [page, setPage] = useState('planner');
  const [date, setDate] = useState(dateKey);
  const [planner, setPlanner] = useState(loadPlanner);
  const [shadow, setShadow] = useState(() => loadState(dateKey()));
  const [storageError, setStorageError] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(PLANNER_KEY, JSON.stringify(planner));
      localStorage.setItem(SHADOW_KEY, JSON.stringify(shadow));
      setStorageError('');
    } catch {
      setStorageError('Could not save your data in this browser. Free storage space and make a backup before leaving.');
    }
  }, [planner, shadow]);

  return <>
    <header className="life-nav">
      <strong>Timmy Life Journal</strong>
      <nav aria-label="Life journal">
        {[['planner', 'Planner'], ['daily', 'Daily & health'], ['brain', 'Second Brain']].map(([key, label]) =>
          <button key={key} type="button" aria-current={page === key ? 'page' : undefined} onClick={() => setPage(key)}>{label}</button>)}
      </nav>
      <DataTools planner={planner} shadow={shadow} setPlanner={setPlanner} setShadow={setShadow} />
    </header>
    {storageError && <p className="storage-error" role="alert">{storageError}</p>}
    {page === 'planner' && <JibunTecho s={planner} setS={setPlanner} date={date} setDate={setDate} shadow={shadow} setShadow={setShadow} openBrain={() => setPage('brain')} />}
    {page === 'daily' && <App state={shadow} setState={setShadow} selectedDate={date} setSelectedDate={setDate} />}
    {page === 'brain' && <main className="brain-page"><NotesAndGoogle /></main>}
  </>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><Root /></React.StrictMode>);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js'));
}
