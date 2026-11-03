import { useEffect, useMemo, useState } from 'react';

const NOTES_KEY = 'timmy-shadow-notes';
const cardStyle = { background: '#1f2937', border: '1px solid #293548', borderRadius: '18px', padding: '20px', margin: '16px auto', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' };
const inputStyle = { width: '100%', padding: '11px 12px', borderRadius: '10px', border: '1px solid #374151', background: '#111827', color: '#f9fafb', fontSize: '15px', boxSizing: 'border-box' };
const buttonStyle = { border: '1px solid #374151', borderRadius: '9px', padding: '9px 11px', background: '#111827', color: '#e5e7eb', fontSize: '13px', cursor: 'pointer' };

function readNotes() {
  try {
    const value = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]');
    return Array.isArray(value) ? value.filter((note) => note && typeof note.id === 'string') : [];
  } catch { return []; }
}
function googleCalendarUrl(title, note, date) {
  const start = date.replaceAll('-', '');
  const dateObj = new Date(`${date}T00:00:00`);
  dateObj.setDate(dateObj.getDate() + 1);
  const end = `${dateObj.getFullYear()}${String(dateObj.getMonth() + 1).padStart(2, '0')}${String(dateObj.getDate()).padStart(2, '0')}`;
  const params = new URLSearchParams({ action: 'TEMPLATE', text: title || 'Timmy’sShadow reminder', details: note || '', dates: `${start}/${end}` });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function NotesAndGoogle() {
  const [notes, setNotes] = useState(readNotes);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    try { localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); } catch { setError('Could not save notes in this browser.'); }
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
    setTitle(note.title); setBody(note.body); setDate(note.date || new Date().toLocaleDateString('en-CA')); setEditingId(note.id); setError('');
  }
  function deleteNote(id) {
    if (!window.confirm('Delete this note?')) return;
    setNotes((current) => current.filter((note) => note.id !== id));
    if (editingId === id) { setEditingId(null); setTitle(''); setBody(''); }
  }
  function cancelEdit() { setEditingId(null); setTitle(''); setBody(''); setError(''); }

  return (
    <section id="notes" style={{ ...cardStyle, maxWidth: '680px', color: '#f9fafb', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '12px', flexWrap: 'wrap' }}>
        <div><p style={{ color: '#6ee7b7', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Capture and organize</p><h2 style={{ margin: 0, fontSize: '1.2rem' }}>Notes &amp; Google tools</h2><p style={{ color: '#9ca3af', fontSize: '13px', margin: '6px 0 0' }}>{notes.length} saved note{notes.length === 1 ? '' : 's'} on this device</p></div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <a href="https://tasks.google.com/" target="_blank" rel="noopener noreferrer" style={{ ...buttonStyle, color: '#d1fae5', textDecoration: 'none' }}>Open Google Tasks ↗</a>
          <a href="https://calendar.google.com/calendar/" target="_blank" rel="noopener noreferrer" style={{ ...buttonStyle, color: '#d1fae5', textDecoration: 'none' }}>Open Google Calendar ↗</a>
        </div>
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
            <a href={googleCalendarUrl(note.title, note.body, note.date || new Date().toLocaleDateString('en-CA'))} target="_blank" rel="noopener noreferrer" style={{ color: '#6ee7b7', fontSize: '12px' }}>Create Google Calendar reminder ↗</a>
          </article>
        ))}
      </div>
      <p style={{ color: '#9ca3af', fontSize: '11px', lineHeight: 1.5, margin: '14px 0 0' }}>Notes are stored locally in this browser. Google Tasks and Calendar links open Google; this lightweight setup does not automatically sync notes or tasks to your Google account. Use the calendar reminder link to prefill a calendar event.</p>
    </section>
  );
}

export { NOTES_KEY };
