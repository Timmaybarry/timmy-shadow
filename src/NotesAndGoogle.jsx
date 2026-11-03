import { useEffect, useMemo, useRef, useState } from 'react';

const NOTES_KEY = 'timmy-shadow-notes';
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');
const cardStyle = { background: '#1f2937', border: '1px solid #293548', borderRadius: '18px', padding: '20px', margin: '16px auto', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' };
const inputStyle = { width: '100%', padding: '11px 12px', borderRadius: '10px', border: '1px solid #374151', background: '#111827', color: '#f9fafb', fontSize: '15px', boxSizing: 'border-box' };
const buttonStyle = { border: '1px solid #374151', borderRadius: '9px', padding: '9px 11px', background: '#111827', color: '#e5e7eb', fontSize: '13px', cursor: 'pointer' };

function readNotes() {
  try {
    const value = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]');
    return Array.isArray(value) ? value.filter((note) => note && typeof note.id === 'string') : [];
  } catch { return []; }
}
function loadGoogleIdentity() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let script = document.querySelector('script[data-google-identity]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentity = 'true';
      document.head.appendChild(script);
    }
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', () => reject(new Error('Could not load Google sign-in. Check your connection and try again.')), { once: true });
    if (window.google?.accounts?.oauth2) resolve();
  });
}
function calendarDates(date) {
  const endDate = new Date(`${date}T00:00:00`);
  endDate.setDate(endDate.getDate() + 1);
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
  return { start: date, end };
}

export default function NotesAndGoogle() {
  const [notes, setNotes] = useState(readNotes);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [clientId, setClientId] = useState(import.meta.env.VITE_GOOGLE_CLIENT_ID || '');
  const [accessToken, setAccessToken] = useState('');
  const [googleStatus, setGoogleStatus] = useState('');
  const [googleBusy, setGoogleBusy] = useState('');
  const tokenClient = useRef(null);
  const pendingTokenAction = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); }
    catch { setError('Could not save notes in this browser.'); }
  }, [notes]);

  const filteredNotes = useMemo(() => notes.filter((note) => `${note.title} ${note.body}`.toLowerCase().includes(query.toLowerCase())), [notes, query]);

  function saveNote(event) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle && !body.trim()) { setError('Add a title or note text first.'); return; }
    const now = new Date().toISOString();
    if (editingId) {
      setNotes((current) => current.map((item) => item.id === editingId ? { ...item, title: cleanTitle || 'Untitled note', body: body.trim(), date, updatedAt: now } : item));
    } else {
      setNotes((current) => [{ id: globalThis.crypto?.randomUUID?.() || `note-${Date.now()}`, title: cleanTitle || 'Untitled note', body: body.trim(), date, createdAt: now, updatedAt: now }, ...current]);
    }
    setTitle(''); setBody(''); setEditingId(null); setError('');
  }
  function editNote(note) {
    setTitle(note.title); setBody(note.body); setDate(note.date || new Date().toISOString().slice(0, 10)); setEditingId(note.id); setError('');
  }
  function deleteNote(id) {
    if (!window.confirm('Delete this note?')) return;
    setNotes((current) => current.filter((note) => note.id !== id));
    if (editingId === id) { setEditingId(null); setTitle(''); setBody(''); }
  }
  function cancelEdit() { setEditingId(null); setTitle(''); setBody(''); setError(''); }

  async function connectGoogle(action = null) {
    if (!clientId.trim()) {
      setGoogleStatus('Set VITE_GOOGLE_CLIENT_ID in the deployment environment after creating a Google OAuth Web application client ID.');
      return;
    }
    try {
      await loadGoogleIdentity();
      if (!window.google?.accounts?.oauth2) throw new Error('Google sign-in did not initialize. Please retry.');
      pendingTokenAction.current = action;
      tokenClient.current = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId.trim(),
        scope: GOOGLE_SCOPES,
        callback: async (response) => {
          if (response.error) {
            setGoogleStatus(`Google authorization failed: ${response.error}`);
            setGoogleBusy('');
            pendingTokenAction.current = null;
            return;
          }
          setAccessToken(response.access_token);
          setGoogleStatus('Connected to Google for this session.');
          const pending = pendingTokenAction.current;
          pendingTokenAction.current = null;
          if (pending) await performGoogleAction(response.access_token, pending.note, pending.kind);
        },
        error_callback: (response) => {
          setGoogleStatus(response.message || 'Google sign-in was cancelled or failed.');
          setGoogleBusy('');
          pendingTokenAction.current = null;
        },
      });
      tokenClient.current.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
    } catch (requestError) {
      setGoogleStatus(requestError.message || 'Could not connect to Google.');
      setGoogleBusy('');
    }
  }

  async function performGoogleAction(token, note, kind) {
    const actionId = `${kind}-${note.id}`;
    setGoogleBusy(actionId);
    setGoogleStatus('');
    try {
      let endpoint;
      let payload;
      if (kind === 'task') {
        endpoint = 'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks';
        payload = { title: note.title, notes: note.body || undefined, due: new Date(`${note.date || new Date().toISOString().slice(0, 10)}T00:00:00`).toISOString() };
      } else {
        endpoint = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
        const dates = calendarDates(note.date || new Date().toISOString().slice(0, 10));
        payload = { summary: note.title, description: note.body || undefined, start: { date: dates.start }, end: { date: dates.end } };
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error?.message || `Google API request failed (${response.status}).`);
      setGoogleStatus(kind === 'task' ? `Added “${note.title}” to Google Tasks.` : `Added “${note.title}” to Google Calendar.`);
    } catch (requestError) {
      setGoogleStatus(requestError.message || 'Could not save to Google. Reconnect and try again.');
      if (/401|invalid credentials|expired/i.test(requestError.message || '')) setAccessToken('');
    } finally { setGoogleBusy(''); }
  }

  function sendToGoogle(note, kind) {
    setGoogleBusy(`${kind}-${note.id}`);
    if (!accessToken) { connectGoogle({ note, kind }); return; }
    performGoogleAction(accessToken, note, kind);
  }

  return (
    <section id="notes" style={{ ...cardStyle, color: '#f9fafb', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '12px', flexWrap: 'wrap' }}>
        <div><p style={{ color: '#6ee7b7', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Capture and organize</p><h2 style={{ margin: 0, fontSize: '1.2rem' }}>Notes &amp; Google tools</h2><p style={{ color: '#9ca3af', fontSize: '13px', margin: '6px 0 0' }}>{notes.length} saved note{notes.length === 1 ? '' : 's'} · stored on this device</p></div>
      </div>

      <div style={{ border: '1px solid #374151', background: '#111827', borderRadius: '12px', padding: '14px', marginTop: '16px' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: '15px' }}>Google account connection</h3>
        <p style={{ color: '#9ca3af', fontSize: '12px', lineHeight: 1.5, margin: '0 0 10px' }}>Authorize Timmy’sShadow to create tasks and calendar events in your Google account. Access tokens stay in memory and are not saved to local storage.</p>
        {!import.meta.env.VITE_GOOGLE_CLIENT_ID && <label style={{ display: 'block', color: '#d1d5db', fontSize: '12px', marginBottom: '9px' }}>Google OAuth Web client ID<input value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder="123456789-abc.apps.googleusercontent.com" style={{ ...inputStyle, marginTop: '5px' }} /></label>}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => connectGoogle()} style={{ ...buttonStyle, background: '#065f46', borderColor: '#047857' }}>{accessToken ? 'Reconnect Google' : 'Connect Google account'}</button>
          {accessToken && <button type="button" onClick={() => { setAccessToken(''); setGoogleStatus('Disconnected from Google for this session.'); }} style={buttonStyle}>Disconnect</button>}
          <a href="https://tasks.google.com/" target="_blank" rel="noopener noreferrer" style={{ ...buttonStyle, color: '#d1fae5', textDecoration: 'none' }}>Open Google Tasks ↗</a>
          <a href="https://calendar.google.com/calendar/" target="_blank" rel="noopener noreferrer" style={{ ...buttonStyle, color: '#d1fae5', textDecoration: 'none' }}>Open Calendar ↗</a>
        </div>
        {googleStatus && <p role="status" style={{ color: googleStatus.includes('failed') || googleStatus.includes('Could not') || googleStatus.includes('Set VITE') ? '#fca5a5' : '#a7f3d0', fontSize: '12px', lineHeight: 1.45, margin: '10px 0 0' }}>{googleStatus}</p>}
        <p style={{ color: '#9ca3af', fontSize: '11px', lineHeight: 1.5, margin: '10px 0 0' }}>Google integration needs a Google Cloud OAuth Web client ID, enabled Google Tasks API and Google Calendar API, and this site’s origin added to the OAuth client’s authorized JavaScript origins. Keep the requested scopes limited to task and event creation.</p>
      </div>

      <form onSubmit={saveNote} style={{ display: 'grid', gap: '10px', marginTop: '18px' }}>
        <label style={{ color: '#d1d5db', fontSize: '13px' }}>Title<input aria-label="Note title" maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What should you remember?" style={{ ...inputStyle, marginTop: '5px' }} /></label>
        <label style={{ color: '#d1d5db', fontSize: '13px' }}>Note<textarea aria-label="Note text" maxLength={5000} rows={4} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write your note, idea, or reminder…" style={{ ...inputStyle, marginTop: '5px', resize: 'vertical' }} /></label>
        <label style={{ color: '#d1d5db', fontSize: '13px' }}>Reminder date<input aria-label="Note reminder date" type="date" value={date} onChange={(event) => setDate(event.target.value)} style={{ ...inputStyle, marginTop: '5px' }} /></label>
        <div style={{ display: 'flex', gap: '8px' }}><button type="submit" style={{ ...buttonStyle, background: '#065f46', borderColor: '#047857' }}>{editingId ? 'Save changes' : 'Save note'}</button>{editingId && <button type="button" onClick={cancelEdit} style={buttonStyle}>Cancel</button>}</div>
        {error && <p role="alert" style={{ color: '#fca5a5', fontSize: '13px', margin: 0 }}>{error}</p>}
      </form>
      <label style={{ display: 'block', marginTop: '18px', color: '#d1d5db', fontSize: '13px' }}>Search notes<input aria-label="Search notes" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles and note text" style={{ ...inputStyle, marginTop: '5px' }} /></label>
      <div style={{ marginTop: '12px' }}>
        {filteredNotes.length === 0 ? <p style={{ color: '#9ca3af', fontSize: '13px' }}>{notes.length ? 'No notes match your search.' : 'No notes yet. Add one above to get started.'}</p> : filteredNotes.map((note) => (
          <article key={note.id} style={{ background: '#111827', border: '1px solid #374151', borderRadius: '12px', padding: '14px', marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'start' }}><div style={{ minWidth: 0 }}><h3 style={{ margin: 0, fontSize: '15px', overflowWrap: 'anywhere' }}>{note.title}</h3><time dateTime={note.date} style={{ display: 'block', color: '#9ca3af', fontSize: '12px', marginTop: '4px' }}>{note.date ? new Date(`${note.date}T00:00:00`).toLocaleDateString() : 'No date'}</time></div><div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'end' }}><button type="button" onClick={() => editNote(note)} style={buttonStyle}>Edit</button><button type="button" onClick={() => deleteNote(note.id)} style={{ ...buttonStyle, color: '#fca5a5' }}>Delete</button></div></div>
            {note.body && <p style={{ whiteSpace: 'pre-wrap', color: '#d1d5db', fontSize: '13px', lineHeight: 1.5, margin: '10px 0' }}>{note.body}</p>}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
              <button type="button" disabled={googleBusy === `task-${note.id}`} onClick={() => sendToGoogle(note, 'task')} style={{ ...buttonStyle, opacity: googleBusy === `task-${note.id}` ? 0.6 : 1 }}>{googleBusy === `task-${note.id}` ? 'Adding…' : 'Add to Google Tasks'}</button>
              <button type="button" disabled={googleBusy === `calendar-${note.id}`} onClick={() => sendToGoogle(note, 'calendar')} style={{ ...buttonStyle, opacity: googleBusy === `calendar-${note.id}` ? 0.6 : 1 }}>{googleBusy === `calendar-${note.id}` ? 'Adding…' : 'Add to Google Calendar'}</button>
            </div>
          </article>
        ))}
      </div>
      <p style={{ color: '#9ca3af', fontSize: '11px', lineHeight: 1.5, margin: '14px 0 0' }}>Notes remain in this browser; sending a note to Google creates a separate task or all-day calendar event. Deleting a note here does not delete the Google item.</p>
    </section>
  );
}

export { NOTES_KEY };
