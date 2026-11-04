import React, { useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

const STORAGE_KEY = 'timmy-shadow-state';
const ONEDRIVE_FOLDER_URL = 'https://1drv.ms/f/c/a95c2dfbe131e8db/IgDd5OcW3dTCQZV8J0y-Q1ChAZUHhhLJSanpjO7vygD0_so?e=rBruTv';

function OneDriveBackup() {
  const fileInput = useRef(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function downloadBackup() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        setMessage('No saved Timmy’sShadow data was found in this browser yet.');
        return;
      }
      const parsed = JSON.parse(saved);
      const blob = new Blob([JSON.stringify({ app: 'Timmy’sShadow', version: 1, exportedAt: new Date().toISOString(), data: parsed }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `timmys-shadow-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage('Backup downloaded. Move the JSON file into your OneDrive folder to store it there.');
    } catch {
      setMessage('Could not create the backup. Check that browser storage is available.');
    }
  }

  async function restoreBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      const backup = JSON.parse(await file.text());
      const data = backup?.app === 'Timmy’sShadow' ? backup.data : backup;
      if (!data || typeof data !== 'object' || Array.isArray(data) ||
          !(data.habitsByDate || data.entries || data.workoutLogs || data.workoutPlans)) {
        throw new Error('This file does not look like a Timmy’sShadow backup.');
      }
      if (!window.confirm('Restore this backup? It will replace the Timmy’sShadow data currently saved in this browser.')) return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof SyntaxError ? 'That file is not valid JSON.' : error.message || 'Could not restore that backup.');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  return (
    <details style={{ position: 'fixed', zIndex: 1000, right: '14px', top: '14px', width: 'min(320px, calc(100vw - 28px))', color: '#f9fafb', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <summary style={{ listStyle: 'none', marginLeft: 'auto', width: 'fit-content', cursor: 'pointer', border: '1px solid #047857', borderRadius: '999px', padding: '10px 14px', background: '#064e3b', boxShadow: '0 6px 20px rgba(0,0,0,.3)', fontSize: '13px', fontWeight: 700 }}>
        ☁️ OneDrive backup
      </summary>
      <div style={{ marginTop: '8px', padding: '16px', borderRadius: '16px', background: '#1f2937', border: '1px solid #374151', boxShadow: '0 12px 32px rgba(0,0,0,.4)' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '16px' }}>Back up Timmy’sShadow</h2>
        <p style={{ color: '#d1d5db', fontSize: '12px', lineHeight: 1.5, margin: '0 0 12px' }}>
          Download a backup of this browser’s habits, workouts, and journal. Save the downloaded JSON file in your OneDrive folder. To sync another device, restore that file there.
        </p>
        <button type="button" onClick={downloadBackup} style={buttonStyle}>Download backup file</button>
        <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} style={{ ...buttonStyle, marginLeft: '8px', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Reading…' : 'Restore backup'}
        </button>
        <input ref={fileInput} type="file" accept=".json,application/json" onChange={restoreBackup} style={{ display: 'none' }} aria-label="Choose a Timmy’sShadow backup file" />
        <a href={ONEDRIVE_FOLDER_URL} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '12px', color: '#6ee7b7', fontSize: '13px' }}>
          Open Timmy’sShadow OneDrive folder ↗
        </a>
        {message && <p role="status" style={{ color: '#d1d5db', fontSize: '12px', lineHeight: 1.45, margin: '12px 0 0' }}>{message}</p>}
        <p style={{ color: '#9ca3af', fontSize: '11px', lineHeight: 1.45, margin: '10px 0 0' }}>
          This is a manual backup/restore flow, not automatic OneDrive sync. Keep the backup private because it may contain personal journal and health information.
        </p>
      </div>
    </details>
  );
}

const buttonStyle = {
  border: '1px solid #047857',
  borderRadius: '9px',
  padding: '8px 10px',
  background: '#111827',
  color: '#e5e7eb',
  fontSize: '12px',
  cursor: 'pointer',
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <OneDriveBackup />
  </React.StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}
