import { useState } from 'react';
import GoogleDay, { GoogleSchedule } from './GoogleDay.jsx';
import DailyHealth from './App.jsx';
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

export const emptyPlanner = { events: [], todos: [], days: {}, monthGoals: {}, yearGoals: {}, memos: '', life: {}, goals: [], goalLinks: {} };
export function loadPlanner() {
  try { return { ...emptyPlanner, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return emptyPlanner; }
}

export default function JibunTecho({ s, setS, date, setDate, shadow, setShadow, openBrain }) {
  const today = key(new Date());
  const [view, setView] = useState('day');
  const [editing, setEditing] = useState(null);
  const [goalText, setGoalText] = useState('');
  const [priorityText, setPriorityText] = useState({ personal: '', work: '' });

  const upd = (patch) => setS((p) => ({ ...p, ...patch }));
  const open = (k, v = 'day') => { setDate(k); setView(v); };
  const eventsOn = (k) => s.events.filter((e) => e.date === k).sort((a, b) => a.start.localeCompare(b.start));
  const saveEvent = (ev) => {
    const { isNew, ...saved } = ev;
    upd({ events: s.events.some((e) => e.id === ev.id) ? s.events.map((e) => (e.id === ev.id ? saved : e)) : [...s.events, saved] });
    setEditing(null);
  };
  const newEvent = (k) => setEditing({ id: uid(), date: k, start: '09:00', end: '10:00', title: '', color: COLORS[0], isNew: true });

  const ym = date.slice(0, 7);
  const year = date.slice(0, 4);

  function EventForm() {
    const ev = editing;
    const set = (p) => setEditing({ ...ev, ...p });
    const valid = ev.title.trim() && (!ev.start && !ev.end || ev.start && (!ev.end || toMin(ev.end) > toMin(ev.start)));
    return (
      <div className="jt-form">
        <input className="w" placeholder="Event title" value={ev.title} onChange={(e) => set({ title: e.target.value })} autoFocus />
        <input type="date" className="w" value={ev.date} onChange={(e) => e.target.value && set({ date: e.target.value })} />
        <label>Start (optional)<input type="time" value={ev.start} onChange={(e) => set({ start: e.target.value })} /></label>
        <label>End (optional)<input type="time" value={ev.end} onChange={(e) => set({ end: e.target.value })} /></label>
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
              {eventsOn(k).filter((e) => e.start).map((e) => {
                const top = Math.max(0, (toMin(e.start) - START_HOUR * 60) / 60 * HOUR_PX);
                const h = Math.max(14, (e.end ? toMin(e.end) - toMin(e.start) : 45) / 60 * HOUR_PX);
                return <div key={e.id} className="jt-blk" style={{ top, height: h, background: e.color }} onClick={() => setEditing(e)}>{e.title}</div>;
              })}
            </div>
          ))}
        </div>
        {days.map((k) => eventsOn(k).filter((e) => !e.start).map((e) => <div key={e.id} className="jt-row"><span>{k} · All day</span><button onClick={() => setEditing(e)}>{e.title}</button></div>))}
        <p><small>Tap an empty slot to add; tap a block to edit; tap a day header to open it.</small></p>
      </>
    );
  }

  function Day() {
    const info = s.days[date] || {};
    const setInfo = (p) => upd({ days: { ...s.days, [date]: { ...info, ...p } } });
    const goals = s.goals || [];
    const links = s.goalLinks || {};
    const focusGoal = info.focusGoal || '';
    const setLink = (item, goal) => setS((current) => ({ ...current, goalLinks: { ...current.goalLinks, [item]: goal } }));
    const goalSelector = (item, label) => <label className="jt-link">Goal for {label}
      <select value={links[item] || ''} onChange={(event) => setLink(item, event.target.value)}>
        <option value="">No linked goal</option>{goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}
      </select>
    </label>;
    const priorities = info.priorities || {};
    const priorityIds = (group) => (priorities[group] || []).filter((id) => s.todos.some((task) => task.id === id));
    const selectedIds = [...priorityIds('personal'), ...priorityIds('work')];
    const availableTasks = s.todos.filter((task) =>
      !task.done && (!task.date || task.date <= date) && !selectedIds.includes(task.id));
    const selectPriority = (group, id) => {
      if (!id || selectedIds.includes(id) || priorityIds(group).length >= 5) return;
      setInfo({ priorities: { ...priorities, [group]: [...priorityIds(group), id] } });
    };
    const addPriority = (group) => {
      const title = priorityText[group].trim();
      if (!title || priorityIds(group).length >= 5) return;
      const task = { id: uid(), date, text: title, done: false };
      setS((current) => ({
        ...current,
        todos: [...current.todos, task],
        days: { ...current.days, [date]: { ...current.days[date], priorities: { ...priorities, [group]: [...priorityIds(group), task.id] } } },
      }));
      setPriorityText((current) => ({ ...current, [group]: '' }));
    };
    const addGoal = () => {
      if (!goalText.trim()) return;
      setS((current) => ({ ...current, goals: [...(current.goals || []), { id: uid(), name: goalText.trim() }] }));
      setGoalText('');
    };
    const removeGoal = (goal) => {
      if (!window.confirm(`Remove the goal “${goal.name}” and its links?`)) return;
      setS((current) => ({
        ...current,
        goals: (current.goals || []).filter((item) => item.id !== goal.id),
        goalLinks: Object.fromEntries(Object.entries(current.goalLinks || {}).filter(([, value]) => value !== goal.id)),
        days: Object.fromEntries(Object.entries(current.days).map(([day, value]) => [day, value.focusGoal === goal.id ? { ...value, focusGoal: '' } : value])),
      }));
    };
    const entry = shadow.entries[date] || {};
    const setEntry = (field, value) => setShadow((current) => ({ ...current, entries: { ...current.entries, [date]: { ...current.entries[date], [field]: value } } }));
    const scheduled = [
      ...eventsOn(date).map((event) => ({ type: 'event', time: event.start, event })),
      ...shadow.habitDefinitions.filter((habit) => info.habitTimes?.[habit.id]).map((habit) => ({ type: 'habit', time: info.habitTimes[habit.id], habit })),
    ].sort((a, b) => a.time.localeCompare(b.time));
    const periodGoals = [
      ...Object.entries(s.yearGoals).filter(([, value]) => value.trim()).map(([period, value]) => ({ label: `Year ${period}`, value })),
      ...Object.entries(s.monthGoals).filter(([, value]) => value.trim()).map(([period, value]) => ({ label: `Month ${period}`, value })),
    ];
    return (
      <div className="jt-day">
        <header className="jt-day-hero">
          <p className="jt-eyebrow">Your daily planner</p>
        <Nav label={parse(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} onPrev={() => setDate(shift(date, -1))} onNext={() => setDate(shift(date, 1))} onToday={() => setDate(today)} />
          <p className="jt-day-subtitle">A little structure for the things that matter.</p>
          <label className="jt-date-picker">Select date<input type="date" value={date} onChange={(event) => event.target.value && setDate(event.target.value)} /></label>
          <a className="jt-health-link" href="#health">Jump to daily &amp; health ↓</a>
        </header>
        <GoogleDay date={date} initialClientId="285115057031-p6q8oaca3f1f0lkg5lf34j0q48gn2u9l.apps.googleusercontent.com">
        <div className="jt-day-grid">
          <section className="jt-card jt-priorities-card">
            <div className="jt-section-heading"><span className="jt-step">01</span><div><h3>Today’s top tasks</h3><p>Choose up to five local tasks for each area, in priority order. Remove a task from a list to make room.</p></div></div>
            <div className="jt-priority-grid">
              {['personal', 'work'].map((group) => {
                const ids = priorityIds(group);
                const label = group === 'personal' ? 'Personal' : 'Work';
                return <div key={group} className="jt-priority-list">
                  <h4>Top 5 {label.toLowerCase()} tasks <small>{ids.length}/5</small></h4>
                  {ids.length === 0 && <p className="jt-muted">No {group} priorities selected yet.</p>}
                  {ids.map((id, index) => {
                    const task = s.todos.find((item) => item.id === id);
                    return <div className="jt-row" key={id}>
                      <span>{index + 1}.</span>
                      <input type="checkbox" aria-label={`Complete ${task.text}`} checked={task.done} onChange={() => upd({ todos: s.todos.map((item) => item.id === id ? { ...item, done: !item.done } : item) })} />
                      <span className={`t ${task.done ? 'done' : ''}`}>{task.text}</span>
                      <button type="button" aria-label={`Remove ${task.text} from ${group} priorities`} onClick={() => setInfo({ priorities: { ...priorities, [group]: ids.filter((item) => item !== id) } })}>Remove</button>
                    </div>;
                  })}
                  <label>Add an existing task to {group}
                    <select value="" disabled={ids.length >= 5 || !availableTasks.length} onChange={(event) => selectPriority(group, event.target.value)}>
                      <option value="">{availableTasks.length ? 'Choose a task' : 'No available local tasks'}</option>
                      {availableTasks.map((task) => <option key={task.id} value={task.id}>{task.text}{task.date ? ` (${task.date})` : ''}</option>)}
                    </select>
                  </label>
                  <form className="jt-actions" onSubmit={(event) => { event.preventDefault(); addPriority(group); }}>
                    <input aria-label={`New ${group} priority`} placeholder={`New ${group} task`} value={priorityText[group]} onChange={(event) => setPriorityText((current) => ({ ...current, [group]: event.target.value }))} disabled={ids.length >= 5} />
                    <button disabled={ids.length >= 5 || !priorityText[group].trim()}>Add</button>
                  </form>
                </div>;
              })}
            </div>
            <p className="jt-muted">Add a task here or choose one from your existing local tasks.</p>
          </section>
          <section className="jt-card jt-log-card">
            <div className="jt-section-heading"><span className="jt-step">02</span><div><h3>Focus &amp; running log</h3><p>Keep the task at hand visible and capture actions as your day unfolds.</p></div></div>
            <label>What am I focusing on now?<input value={info.currentFocus || ''} onChange={(event) => setInfo({ currentFocus: event.target.value })} placeholder="The next action or task" /></label>
            <label>Running log<textarea value={info.actionLog || ''} onChange={(event) => setInfo({ actionLog: event.target.value })} placeholder="Record actions, progress, and what to do next…" /></label>
          </section>
          <section className="jt-card jt-focus-card">
            <div className="jt-section-heading"><span className="jt-step">03</span><div><h3>Your goals</h3><p>Keep all your goals in view and choose one to focus on today.</p></div></div>
            <div className="jt-actions"><input aria-label="New goal" placeholder="A goal that matters to you" value={goalText} onChange={(event) => setGoalText(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addGoal()} /><button onClick={addGoal} disabled={!goalText.trim()}>Add goal</button></div>
            <label>Focus goal for this date<select value={focusGoal} onChange={(event) => setInfo({ focusGoal: event.target.value })}><option value="">Choose a focus goal</option>{goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select></label>
            {goals.length === 0 ? <p className="jt-muted">No goals yet. Add one above.</p> : goals.map((goal) => <div className="jt-row" key={goal.id}><span className="t">{goal.name}</span><button className="d" onClick={() => removeGoal(goal)}>Remove</button></div>)}
            {periodGoals.length > 0 && <div className="jt-period-goals"><h4>Year and month goals</h4>{periodGoals.map(({ label, value }) => <div key={label}><strong>{label}</strong><p>{value}</p></div>)}<p className="jt-muted">Edit these goals in the Year and Month tabs.</p></div>}
            <div className="jt-checkin">
              <div><span>Weather</span>{WEATHER.map((w) => <button key={w} aria-label={`Weather ${w}`} className={info.weather === w ? 'p' : ''} onClick={() => setInfo({ weather: info.weather === w ? '' : w })}>{w}</button>)}</div>
              <div><span>Mood</span>{MOODS.map((m) => <button key={m} aria-label={`Mood ${m}`} className={info.mood === m ? 'p' : ''} onClick={() => setInfo({ mood: info.mood === m ? '' : m })}>{m}</button>)}</div>
            </div>
          </section>
          <section className="jt-card">
            <div className="jt-section-heading"><span className="jt-step">04</span><div><h3>Review your schedule</h3><p>Your plans for the day, all in one place.</p></div></div>
            {scheduled.map((item) => item.type === 'event' ? <div key={`event:${item.event.id}`} className="jt-row" onClick={() => setEditing(item.event)}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.event.color }} />
              <span>{item.time ? `${item.time}${item.event.end ? `–${item.event.end}` : ''}` : 'All day'}</span><span className="t">{item.event.title}</span>
            </div> : <div key={`habit:${item.habit.id}`} className="jt-row">
              <span>{item.time}</span><span className="t">{item.habit.icon} {item.habit.name}</span><small>Habit</small>
            </div>)}
            <p><button onClick={() => newEvent(date)}>+ Add event</button></p>
            <GoogleSchedule />
          </section>
          <section className="jt-card">
            <div className="jt-section-heading"><span className="jt-step">05</span><div><h3>Schedule your habits</h3><p>Set a time for this day and check off habits as you complete them.</p></div></div>
            {shadow.habitDefinitions.map((habit) => {
              const item = `habit:${habit.id}`;
              const aligned = focusGoal && links[item] === focusGoal;
              return <div key={habit.id} className={`jt-task ${aligned ? 'jt-aligned' : ''}`}>
                <label className="jt-row">
                  <input type="checkbox" checked={Boolean(shadow.habitsByDate[date]?.[habit.id])} onChange={(e) => setShadow((current) => ({ ...current, habitsByDate: { ...current.habitsByDate, [date]: { ...current.habitsByDate[date], [habit.id]: e.target.checked } } }))} />
                  <span>{habit.icon} {habit.name} {aligned && <strong>· Today’s focus</strong>}</span>
                </label>
                <label className="jt-habit-time">Time for {habit.name}<input type="time" value={info.habitTimes?.[habit.id] || ''} onChange={(event) => setInfo({ habitTimes: { ...info.habitTimes, [habit.id]: event.target.value } })} /></label>
                {goalSelector(item, habit.name)}
              </div>;
            })}
            <p className="jt-muted"><a href="#habits">Add or edit habits in the habit tracker.</a></p>
          </section>
          <section className="jt-card jt-reflection-card">
            <div className="jt-section-heading"><span className="jt-step">06</span><div><h3>Take a moment to reflect</h3><p>Capture what you learned, what you noticed, and how you want to move forward.</p></div></div>
            <div className="jt-reflection-grid">
              <label>Silent Strength reading<textarea value={entry.silentStrength || ''} onChange={(e) => setEntry('silentStrength', e.target.value)} placeholder="What stood out and how can you apply it today?" /></label>
              <label>Daily Stoic reading<textarea value={entry.dailyStoic || ''} onChange={(e) => setEntry('dailyStoic', e.target.value)} placeholder="What did you learn and what will you practice?" /></label>
              <label>Daily notes<textarea value={entry.notes || ''} onChange={(e) => setEntry('notes', e.target.value)} placeholder="Notes for this day" /></label>
              <label>Daily journal<textarea aria-label="Daily journal" value={entry.journal || ''} onChange={(e) => setEntry('journal', e.target.value)} placeholder="How was today?" /></label>
            </div>
            {info.diary && <><h3>Earlier planner diary</h3><p>Your original planner diary is preserved here. Copy it into the shared journal if you wish.</p><textarea aria-label="Earlier planner diary" value={info.diary} onChange={(e) => setInfo({ diary: e.target.value })} /></>}
          </section>
        </div>
        </GoogleDay>
        <DailyHealth state={shadow} setState={setShadow} selectedDate={date} />
      </div>
    );
  }

  function Life() {
    const life = s.life || {};
    const fields = [
      ['values', 'Values & purpose', 'What matters most to you?'],
      ['vision', 'Life vision', 'What kind of life are you working toward?'],
      ['dreams', 'Dreams & things to do', 'Places, experiences, and dreams to pursue…'],
      ['milestones', 'Life milestones', 'Important moments, dates, and achievements…'],
      ['people', 'People & connections', 'People and relationships you want to nurture…'],
    ];
    return <>
      <div className="jt-head"><h2>LIFE</h2></div>
      <p>Keep the big picture here, then use your year and month goals to turn it into plans.</p>
      {fields.map(([field, label, placeholder]) => <label key={field} className="jt-life-field">
        <h3>{label}</h3>
        <textarea value={life[field] || ''} placeholder={placeholder} onChange={(e) => upd({ life: { ...life, [field]: e.target.value } })} />
      </label>)}
      <button onClick={() => setView('year')}>Open year goals</button>
    </>;
  }

  function Memo() {
    return (
      <>
        <div className="jt-head"><h2>IDEA</h2></div>
        <p>Use this space for freeform lists and ideas. Capture individual searchable notes in your Second Brain.</p>
        <button onClick={openBrain}>Open Second Brain</button>
        <h3>Free notes</h3>
        <textarea style={{ minHeight: 400 }} value={s.memos} onChange={(e) => upd({ memos: e.target.value })} placeholder="Lists, ideas, wishlist, books to read…" />
      </>
    );
  }

  const tabs = [['life', 'LIFE'], ['year', 'Year'], ['month', 'Month'], ['week', 'Week'], ['day', 'Day'], ['memo', 'IDEA']];
  return (
    <div className="jt">
      <div className="jt-page" style={{ marginTop: 40 }}>
        {editing ? EventForm() : view === 'life' ? Life() : view === 'year' ? Year() : view === 'month' ? Month() : view === 'week' ? Week() : view === 'day' ? Day() : Memo()}
      </div>
      <nav className="jt-nav">
        {tabs.map(([v, l]) => <button key={v} className={view === v ? 'on' : ''} onClick={() => { setEditing(null); setView(v); }}>{l}</button>)}
      </nav>
    </div>
  );
}
