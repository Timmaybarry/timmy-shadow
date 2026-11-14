import { useEffect, useState } from 'react';
import { loadGoogleIdentity } from './googleIdentity.js';
import { createGoogleTask, fetchGoogleDay, googleTaskKey, setGoogleTaskDone } from './googlePlanner.js';

const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks';
const empty = { events: [], tasks: [], taskLists: [] };

function eventTime(event, date) {
  if (event.start?.date) return 'All day';
  if (!event.start?.dateTime) return 'Time unavailable';
  const start = new Date(event.start.dateTime);
  const localDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  if (localDate < date) return 'Continuing';
  return start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function GoogleDay({ date, goals, focusGoal, links, setLink }) {
  const [clientId, setClientId] = useState(import.meta.env.VITE_GOOGLE_CLIENT_ID || '');
  const [token, setToken] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [data, setData] = useState(empty);
  const [dataDate, setDataDate] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [title, setTitle] = useState('');
  const [listId, setListId] = useState('');

  useEffect(() => {
    if (!token) return undefined;
    const delay = Math.max(0, expiresAt - Date.now());
    const timer = setTimeout(() => {
      setToken('');
      setData(empty);
      setStatus('Google session expired. Connect again to refresh your planner.');
    }, delay);
    return () => clearTimeout(timer);
  }, [token, expiresAt]);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    setLoading(true);
    setDataDate('');
    fetchGoogleDay(token, date).then((result) => {
      if (!active) return;
      setData(result);
      setDataDate(date);
      setListId((current) => result.taskLists.some((list) => list.id === current) ? current : result.taskLists[0]?.id || '');
      setStatus('');
    }).catch((error) => {
      if (!active) return;
      setData(empty);
      setStatus(`${error.message} Reconnect or refresh and try again.`);
      if (/\(401\)/.test(error.message)) setToken('');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, date, refresh]);

  async function connect() {
    if (!clientId.trim()) {
      setStatus('Enter your Google OAuth web client ID to connect.');
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      await loadGoogleIdentity();
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId.trim(),
        scope: SCOPES,
        callback: (response) => {
          setBusy(false);
          if (response.error || !response.access_token) {
            setStatus(`Google authorization failed: ${response.error || 'No access token returned.'}`);
            return;
          }
          setExpiresAt(Date.now() + Math.max(0, (Number(response.expires_in) || 0) - 30) * 1000);
          setToken(response.access_token);
        },
        error_callback: (error) => { setBusy(false); setStatus(error.message || 'Google sign-in was cancelled or failed.'); },
      });
      client.requestAccessToken({ prompt: 'consent' });
    } catch (error) {
      setStatus(error.message || 'Could not connect to Google.');
      setBusy(false);
    }
  }

  async function addTask(event) {
    event.preventDefault();
    const text = title.trim();
    if (!text || !listId) return;
    setBusy(true);
    try {
      await createGoogleTask(token, listId, text, date);
      setTitle('');
      setRefresh((value) => value + 1);
    } catch (error) { setStatus(`${error.message} Task was not confirmed. Refresh before retrying.`); }
    finally { setBusy(false); }
  }

  async function toggleTask(task) {
    setBusy(true);
    try {
      await setGoogleTaskDone(token, task.listId, task.id, task.status !== 'completed');
      setRefresh((value) => value + 1);
    } catch (error) { setStatus(`${error.message} The change was not confirmed. Refresh before retrying.`); }
    finally { setBusy(false); }
  }

  const ready = token && !loading && dataDate === date;
  return <section className="jt-google">
    <h3>Google calendar &amp; tasks</h3>
    <p>Personal Google calendars are read-only here. Tasks can be added and completed. Connect each session; data is not saved offline.</p>
    {!import.meta.env.VITE_GOOGLE_CLIENT_ID && <label>Google OAuth web client ID
      <input value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder="Client ID ending in apps.googleusercontent.com" />
    </label>}
    <div className="jt-actions">
      {!token ? <button type="button" disabled={busy} onClick={connect}>Connect Google</button> : <>
        <button type="button" disabled={busy || loading} onClick={() => setRefresh((value) => value + 1)}>Refresh Google</button>
        <button type="button" disabled={busy} onClick={() => { setToken(''); setData(empty); setDataDate(''); setStatus('Disconnected from Google in this planner.'); }}>Disconnect</button>
      </>}
    </div>
    {status && <p role="status">{status}</p>}
    {loading && <p role="status">Loading Google calendars and tasks…</p>}
    {ready && <>
      <h4>Google schedule</h4>
      {data.events.length === 0 && <p>No Google events for this day.</p>}
      {data.events.map((event) => <div className="jt-row" key={`${event.calendarId}:${event.id}`}>
        <span>{eventTime(event, date)}</span><span className="t">{event.summary || '(No title)'}</span><small>{event.calendarName}</small>
      </div>)}
      <h4>Google tasks</h4>
      <p>Showing tasks due by this date and undated tasks. Completed tasks appear on their due date.</p>
      {data.tasks.length === 0 && <p>No Google tasks for this day.</p>}
      {data.tasks.map((task) => {
        const key = googleTaskKey(task.listId, task.id);
        const aligned = focusGoal && links[key] === focusGoal;
        return <div key={key} className={`jt-task ${aligned ? 'jt-aligned' : ''}`}>
          <div className="jt-row">
            <input aria-label={`Complete ${task.title}`} type="checkbox" checked={task.status === 'completed'} disabled={busy} onChange={() => toggleTask(task)} />
            <span className={`t ${task.status === 'completed' ? 'done' : ''}`}>{task.title || '(No title)'} {aligned && <strong>· Today’s focus</strong>}<br /><small>{task.listName} · {task.due ? `Due ${task.due.slice(0, 10)}` : 'No due date'}</small></span>
          </div>
          <label className="jt-link">Goal for {task.title || 'task'}
            <select value={links[key] || ''} onChange={(event) => setLink(key, event.target.value)}>
              <option value="">No linked goal</option>{goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}
            </select>
          </label>
        </div>;
      })}
      <form className="jt-task-form" onSubmit={addTask}>
        <label>New Google task<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Task title" /></label>
        <label>Task list<select value={listId} onChange={(event) => setListId(event.target.value)}>{data.taskLists.map((list) => <option key={list.id} value={list.id}>{list.title}</option>)}</select></label>
        <button className="p" disabled={busy || !title.trim() || !listId}>Add for {date}</button>
      </form>
      {!data.taskLists.length && <p>No Google task lists found. Create one in Google Tasks and refresh.</p>}
    </>}
  </section>;
}
