import { useEffect, useState } from 'react';
import './jibun.css';

const KEY = 'jibun-techo-state';
const COLORS = ['#e56b6f', '#e29a3f', '#5aa469', '#4a8fd1', '#8e6bbf', '#777777'];
const MOODS = ['😄', '🙂', '😐', '😟', '😴'];
const WEATHER = ['☀️', '⛅', '☁️', '🌧️', '❄️'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const START_HOUR = 6, HOURS = 18, HOUR_PX = 32;

const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const shift = (k, n) => { const d = parse(k); d.setDate(d.getDate() + n); return key(d); };
const uid = () => Math.random().toString(36).slice(2, 10);
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

const empty = { events: [], todos: [], habits: [], habitLog: {}, days: {}, monthGoals: {}, yearGoals: {}, memos: '' };
function load() {
  try { return { ...empty, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return empty; }
}

export default function JibunTecho() {
  const today = key(new Date());
  const [s, setS] = useState(load);
  const [view, setView] = useState('month');
  const [date, setDate] = useState(today);
  const [editing, setEditing] = useState(null);
  const [text, setText] = useState('');

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(s)); }, [s]);
  const upd = (patch) => setS((p) => ({ ...p, ...patch }));
  const open = (k, v = 'day') => { setDate(k); setView(v); };
  const eventsOn = (k) => s.events.filter((e) => e.date === k).sort((a, b) => a.start.localeCompare(b.start));
  const saveEvent = (ev) => {
    upd({ events: s.events.some((e) => e.id === ev.id) ? s.events.map((e) => (e.id === ev.id ? ev : e)) : [...s.events, ev] });
    setEditing(null);
  };
  const newEvent = (k) => setEditing({ id: uid(), date: k, start: '09:00', end: '10:00', title: '', color: COLORS[0], isNew: true });

  const [habitText, setHabitText] = useState('');
  const doneOn = (k, id) => (s.habitLog[k] || []).includes(id);
  const toggleHabit = (k, id) => {
    const cur = s.habitLog[k] || [];
    upd({ habitLog: { ...s.habitLog, [k]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] } });
  };
  const streak = (id) => {
    let k = today, n = 0;
    if (!doneOn(k, id)) k = shift(k, -1);
    while (doneOn(k, id)) { n++; k = shift(k, -1); }
    return n;
  };
  const addHabit = () => {
    if (!habitText.trim()) return;
    upd({ habits: [...s.habits, { id: uid(), name: habitText.trim() }] });
    setHabitText('');
  };
  const removeHabit = (id) => {
    if (window.confirm('Delete this habit and its history?')) upd({ habits: s.habits.filter((h) => h.id !== id) });
  };
  const toggleTodo = (id) => upd({ todos: s.todos.map((x) => (x.id === id ? { ...x, done: !x.done } : x)) });

  const ym = date.slice(0, 7);
  const year = date.slice(0, 4);

  function EventForm() {
    const ev = editing;
    const set = (p) => setEditing({ ...ev, ...p });
    const valid = ev.title.trim() && toMin(ev.end) > toMin(ev.start);
    return (
      <div className="jt-form">
        <input className="w" placeholder="Event title" value={ev.title} onChange={(e) => set({ title: e.target.value })} autoFocus />
        <input type="date" className="w" value={ev.date} onChange={(e) => e.target.value && set({ date: e.target.value })} />
        <input type="time" value={ev.start} onChange={(e) => set({ start: e.target.value })} />
        <input type="time" value={ev.end} onChange={(e) => set({ end: e.target.value })} />
        <div className="jt-sw w">{COLORS.map((c) => <span key={c} style={{ background: c }} className={ev.color === c ? 'on' : ''} onClick={() => set({ color: c })} />)}</div>
        <button className="p" disabled={!valid} onClick={() => saveEvent({ ...ev, title: ev.title.trim() })}>Save</button>
        <button onClick={() => setEditing(null)}>Cancel</button>
        {!ev.isNew && <button className="d w" onClick={() => { upd({ events: s.events.filter((e) => e.id !== ev.id) }); setEditing(null); }}>Delete event</button>}
      </div>
    );
  }

  function Nav({ label, onPrev, onNext, onToday }) {
    return (
      <div className="jt-head">
        <button onClick={onPrev}>‹</button>
        <h2 onClick={onToday} style={{ cursor: 'pointer' }}>{label}</h2>
        <button onClick={onNext}>›</button>
      </div>
    );
  }

  function Year() {
    const goals = s.yearGoals[year] || '';
    return (
      <>
        <Nav label={year} onPrev={() => setDate(`${+year - 1}-01-01`)} onNext={() => setDate(`${+year + 1}-01-01`)} onToday={() => setDate(today)} />
        <h3>Year goals</h3>
        <textarea placeholder="Your goals for the year…" value={goals} onChange={(e) => upd({ yearGoals: { ...s.yearGoals, [year]: e.target.value } })} />
        <h3>Months</h3>
        <div className="jt-mo">
          {MONTHS.map((m, i) => {
            const mk = `${year}-${String(i + 1).padStart(2, '0')}`;
            const n = s.events.filter((e) => e.date.startsWith(mk)).length;
            return <button key={m} onClick={() => open(`${mk}-01`, 'month')}>{m}<br /><small>{n} events</small></button>;
          })}
        </div>
      </>
    );
  }

  function Month() {
    const first = parse(`${ym}-01`);
    const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(first); d.setDate(1 - first.getDay() + i); return d; });
    const stepMonth = (n) => setDate(key(new Date(first.getFullYear(), first.getMonth() + n, 1)));
    return (
      <>
        <Nav label={`${MONTHS[first.getMonth()]} ${first.getFullYear()}`} onPrev={() => stepMonth(-1)} onNext={() => stepMonth(1)} onToday={() => setDate(today)} />
        <div className="jt-grid">
          {DOW.map((d) => <div key={d} className="dow">{d}</div>)}
          {cells.map((d) => {
            const k = key(d);
            const evs = eventsOn(k);
            return (
              <div key={k} className={`${d.getMonth() !== first.getMonth() ? 'dim' : ''} ${k === today ? 'today' : ''}`} onClick={() => open(k)}>
                <b>{d.getDate()}</b>
                {evs.slice(0, 3).map((e) => <span key={e.id} className="ev" style={{ background: e.color }}>{e.title}</span>)}
                {evs.length > 3 && <small>+{evs.length - 3}</small>}
              </div>
            );
          })}
        </div>
        <h3>Month goals</h3>
        <textarea placeholder="Goals & focus for this month…" value={s.monthGoals[ym] || ''} onChange={(e) => upd({ monthGoals: { ...s.monthGoals, [ym]: e.target.value } })} />
      </>
    );
  }

  function Week() {
    const d = parse(date);
    const start = shift(date, -d.getDay());
    const days = Array.from({ length: 7 }, (_, i) => shift(start, i));
    return (
      <>
        <Nav label={`Week of ${parse(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`} onPrev={() => setDate(shift(date, -7))} onNext={() => setDate(shift(date, 7))} onToday={() => setDate(today)} />
        <div className="jt-wk">
          <div />
          {days.map((k) => <div key={k} className={`hd ${k === today ? 'today' : ''}`} onClick={() => open(k)}>{DOW[parse(k).getDay()]}<br />{parse(k).getDate()}</div>)}
          <div className="jt-hrs">{Array.from({ length: HOURS }, (_, i) => <div key={i}>{START_HOUR + i}</div>)}</div>
          {days.map((k) => (
            <div key={k} className="jt-col" onClick={(e) => {
              if (e.target !== e.currentTarget) return;
              const h = START_HOUR + Math.floor((e.clientY - e.currentTarget.getBoundingClientRect().top) / HOUR_PX);
              const hh = String(Math.min(h, 23)).padStart(2, '0');
              setEditing({ ...{ id: uid(), date: k, title: '', color: COLORS[0], isNew: true }, start: `${hh}:00`, end: `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${h >= 23 ? '59' : '00'}` });
            }}>
              {eventsOn(k).map((e) => {
                const top = Math.max(0, (toMin(e.start) - START_HOUR * 60) / 60 * HOUR_PX);
                const h = Math.max(14, (toMin(e.end) - toMin(e.start)) / 60 * HOUR_PX);
                return <div key={e.id} className="jt-blk" style={{ top, height: h, background: e.color }} onClick={() => setEditing(e)}>{e.title}</div>;
              })}
            </div>
          ))}
        </div>
        <p><small>Tap an empty slot to add; tap a block to edit; tap a day header to open it.</small></p>
      </>
    );
  }

  function Day() {
    const info = s.days[date] || {};
    const setInfo = (p) => upd({ days: { ...s.days, [date]: { ...info, ...p } } });
    const todos = s.todos.filter((t) => t.date === date);
    const add = () => { if (!text.trim()) return; upd({ todos: [...s.todos, { id: uid(), date, text: text.trim(), done: false }] }); setText(''); };
    return (
      <>
        <Nav label={parse(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} onPrev={() => setDate(shift(date, -1))} onNext={() => setDate(shift(date, 1))} onToday={() => setDate(today)} />
        <div>Weather {WEATHER.map((w) => <button key={w} className={info.weather === w ? 'p' : ''} onClick={() => setInfo({ weather: info.weather === w ? '' : w })}>{w}</button>)}</div>
        <div style={{ marginTop: 6 }}>Mood {MOODS.map((m) => <button key={m} className={info.mood === m ? 'p' : ''} onClick={() => setInfo({ mood: info.mood === m ? '' : m })}>{m}</button>)}</div>
        <h3>Schedule</h3>
        {eventsOn(date).map((e) => (
          <div key={e.id} className="jt-row" onClick={() => setEditing(e)}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: e.color }} />
            <span>{e.start}–{e.end}</span><span className="t">{e.title}</span>
          </div>
        ))}
        <p><button onClick={() => newEvent(date)}>+ Add event</button></p>
        <h3>To-do</h3>
        {todos.map((t) => (
          <div key={t.id} className="jt-row">
            <input type="checkbox" checked={t.done} onChange={() => toggleTodo(t.id)} />
            <span className={`t ${t.done ? 'done' : ''}`}>{t.text}</span>
            <button className="d" aria-label="Delete" onClick={() => upd({ todos: s.todos.filter((x) => x.id !== t.id) })}>✕</button>
          </div>
        ))}
        <div className="jt-row"><input placeholder="New to-do" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} /><button className="p" onClick={add}>Add</button></div>
        <h3>Habits</h3>
        {s.habits.length === 0 && <p><small>No habits yet. Add some in the Habits tab.</small></p>}
        {s.habits.map((h) => (
          <div key={h.id} className="jt-row">
            <input type="checkbox" checked={doneOn(date, h.id)} onChange={() => toggleHabit(date, h.id)} />
            <span className="t">{h.name}</span><small>🔥 {streak(h.id)}</small>
          </div>
        ))}
        <h3>Diary / notes</h3>
        <textarea value={info.diary || ''} onChange={(e) => setInfo({ diary: e.target.value })} placeholder="How was today?" />
      </>
    );
  }

  function Tasks() {
    const pending = s.todos.filter((t) => !t.done).sort((a, b) => a.date.localeCompare(b.date));
    const doneCount = s.todos.length - pending.length;
    const groups = pending.reduce((g, t) => ((g[t.date] = g[t.date] || []).push(t), g), {});
    return (
      <>
        <div className="jt-head"><h2>Tasks</h2><small>{doneCount}/{s.todos.length} done</small></div>
        {pending.length === 0 && <p><small>Nothing open. Add tasks from a Day page.</small></p>}
        {Object.keys(groups).map((k) => (
          <div key={k}>
            <h3 style={k < today ? { color: '#b42318' } : undefined}>
              {k < today ? 'Overdue · ' : k === today ? 'Today · ' : ''}{parse(k).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </h3>
            {groups[k].map((t) => (
              <div key={t.id} className="jt-row">
                <input type="checkbox" checked={false} onChange={() => toggleTodo(t.id)} />
                <span className="t" onClick={() => open(k)}>{t.text}</span>
                {k < today && <button onClick={() => upd({ todos: s.todos.map((x) => (x.id === t.id ? { ...x, date: today } : x)) })}>→ Today</button>}
              </div>
            ))}
          </div>
        ))}
      </>
    );
  }

  function Habits() {
    const d = parse(date);
    const start = shift(date, -d.getDay());
    const days = Array.from({ length: 7 }, (_, i) => shift(start, i));
    return (
      <>
        <Nav label={`Habits · week of ${parse(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`} onPrev={() => setDate(shift(date, -7))} onNext={() => setDate(shift(date, 7))} onToday={() => setDate(today)} />
        <div className="jt-hb">
          <div />
          {days.map((k) => <div key={k} className={`hd ${k === today ? 'today' : ''}`}>{DOW[parse(k).getDay()][0]}<br />{parse(k).getDate()}</div>)}
          <div />
          {s.habits.map((h) => [
            <div key={h.id} className="nm">{h.name}<br /><small>🔥 {streak(h.id)}</small></div>,
            ...days.map((k) => <div key={h.id + k} className={`ck ${doneOn(k, h.id) ? 'on' : ''}`} onClick={() => toggleHabit(k, h.id)}>{doneOn(k, h.id) ? '✓' : ''}</div>),
            <button key={h.id + 'x'} className="d" aria-label="Delete habit" onClick={() => removeHabit(h.id)}>✕</button>,
          ])}
        </div>
        {s.habits.length === 0 && <p><small>Add your first habit below.</small></p>}
        <div className="jt-row"><input placeholder="New habit" value={habitText} onChange={(e) => setHabitText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addHabit()} /><button className="p" onClick={addHabit}>Add</button></div>
      </>
    );
  }

  function Memo() {
    return (
      <>
        <div className="jt-head"><h2>Free notes</h2></div>
        <textarea style={{ minHeight: 400 }} value={s.memos} onChange={(e) => upd({ memos: e.target.value })} placeholder="Lists, ideas, wishlist, books to read…" />
      </>
    );
  }

  const tabs = [['year', 'Year'], ['month', 'Month'], ['week', 'Week'], ['day', 'Day'], ['tasks', 'Tasks'], ['habits', 'Habits'], ['memo', 'Notes']];
  return (
    <div className="jt">
      <div className="jt-page" style={{ marginTop: 40 }}>
        {editing ? EventForm() : view === 'year' ? Year() : view === 'month' ? Month() : view === 'week' ? Week() : view === 'day' ? Day() : view === 'tasks' ? Tasks() : view === 'habits' ? Habits() : Memo()}
      </div>
      <nav className="jt-nav">
        {tabs.map(([v, l]) => <button key={v} className={view === v ? 'on' : ''} onClick={() => { setEditing(null); setView(v); }}>{l}</button>)}
      </nav>
    </div>
  );
}
