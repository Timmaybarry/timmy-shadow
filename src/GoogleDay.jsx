import { createContext, useContext, useEffect, useState } from 'react';
import { loadGoogleIdentity } from './googleIdentity.js';
import { fetchGoogleCalendarDay } from './googlePlanner.js';

const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';
const empty = { events: [] };
const GoogleDayContext = createContext(null);

function eventTime(event, date) {
  if (event.start?.date) return 'All day';
  if (!event.start?.dateTime) return 'Time unavailable';
  const start = new Date(event.start.dateTime);
  const localDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  if (localDate < date) return 'Continuing';
  return start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function GoogleDay({ date, children, initialClientId }) {
  const [clientId, setClientId] = useState(initialClientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || '');
  const [token, setToken] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [data, setData] = useState(empty);
  const [dataDate, setDataDate] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);

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
    fetchGoogleCalendarDay(token, date).then((result) => {
      if (!active) return;
      setData(result);
      setDataDate(date);
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

  const ready = token && !loading && dataDate === date;
  const value = {
    clientId,
    setClientId,
    token,
    setToken,
    data,
    status,
    setStatus,
    loading,
    busy,
    setRefresh,
    date,
    ready,
    connect,
    setData,
    setDataDate,
  };
  return <GoogleDayContext.Provider value={value}>{children}</GoogleDayContext.Provider>;
}

function useGoogleDay() {
  const value = useContext(GoogleDayContext);
  if (!value) throw new Error('GoogleDay components must be rendered inside GoogleDay.');
  return value;
}

export function GoogleSchedule() {
  const {
    clientId, setClientId, token, setToken, data, status, loading, busy,
    setRefresh, date, ready, connect, setData, setDataDate,
  } = useGoogleDay();
  return <section className="jt-google">
    <h3>Google Calendar</h3>
    <p>Personal Google calendars are read-only here. Connect each session; data is not saved offline.</p>
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
    {loading && <p role="status">Loading Google calendar…</p>}
    {ready && <>
      <h4>Today’s Google schedule</h4>
      {data.events.length === 0 && <p>No Google events for this day.</p>}
      {data.events.map((event) => <div className="jt-row" key={`${event.calendarId}:${event.id}`}>
        <span>{eventTime(event, date)}</span><span className="t">{event.summary || '(No title)'}</span><small>{event.calendarName}</small>
      </div>)}
    </>}
  </section>;
}
