import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'timmy-shadow-state';
const DEFAULT_HABITS = [
  { id: 'sleep', name: 'sleep', icon: '😴', color: '#818cf8' },
  { id: 'hydration', name: 'hydration', icon: '💧', color: '#38bdf8' },
  { id: 'movement', name: 'movement', icon: '🏃', color: '#34d399' },
  { id: 'focus', name: 'focus', icon: '🎯', color: '#fbbf24' },
  { id: 'mindfulness', name: 'mindfulness', icon: '🧘', color: '#c084fc' },
];
const HABIT_COLORS = ['#34d399', '#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb7185', '#fbbf24', '#fb923c'];
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const cardStyle = { background: '#1f2937', border: '1px solid #293548', borderRadius: '18px', padding: '20px', marginBottom: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' };
const inputStyle = { width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid #374151', background: '#111827', color: '#f9fafb', fontSize: '16px', boxSizing: 'border-box' };
const buttonStyle = { border: '1px solid #374151', borderRadius: '10px', padding: '9px 12px', background: '#111827', color: '#e5e7eb', fontSize: '14px', cursor: 'pointer' };

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function shiftDate(key, amount) {
  const [year, month, day] = key.split('-').map(Number);
  return dateKey(new Date(year, month - 1, day + amount));
}
function formatDate(key, options = { weekday: 'long', month: 'long', day: 'numeric' }) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, options);
}
function makeDefaultState(today) {
  return {
    weight: 185,
    goalWeight: 160,
    habitDefinitions: DEFAULT_HABITS,
    habitsByDate: { [today]: { sleep: true, hydration: true, movement: false, focus: true, mindfulness: false } },
    entries: { [today]: {
      journal: 'Today felt grounded. I kept my routine simple and took small moves toward the goals that matter most.',
      recovery: 'Felt a little sore after the workout, but recovery is improving. Stretching and walking helped a lot.',
      notes: 'Keep the day gentle. Protect energy and stay consistent with the basics.',
      mood: 'balanced', energy: '7',
    } },
  };
}
function loadState(today) {
  const defaults = makeDefaultState(today);
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return defaults;
    const savedHabits = Array.isArray(saved.habitDefinitions) ? saved.habitDefinitions : [];
    const habitDefinitions = savedHabits.length
      ? savedHabits.filter((habit) => habit && habit.id && habit.name).map((habit) => {
        const defaultHabit = DEFAULT_HABITS.find((item) => item.id === habit.id);
        return { ...defaultHabit, ...habit, icon: habit.icon || defaultHabit?.icon || '✨', color: habit.color || defaultHabit?.color || '#34d399' };
      })
      : defaults.habitDefinitions;
    return {
      weight: Number(saved.weight) || defaults.weight,
      goalWeight: Number(saved.goalWeight) || defaults.goalWeight,
      habitDefinitions,
      habitsByDate: saved.habitsByDate || { [today]: saved.habits || defaults.habitsByDate[today] },
      entries: saved.entries || { [today]: {
        journal: saved.journal ?? defaults.entries[today].journal,
        recovery: saved.recovery ?? defaults.entries[today].recovery,
        notes: saved.notes ?? defaults.entries[today].notes,
        mood: saved.mood ?? defaults.entries[today].mood,
        energy: saved.energy ?? defaults.entries[today].energy,
      } },
    };
  } catch {
    return defaults;
  }
}
function isComplete(habitsByDate, habitId, day) {
  return Boolean(habitsByDate[day]?.[habitId]);
}
function streakFor(habitsByDate, habitId, endingDay, today) {
  let cursor = endingDay;
  if (cursor === today && !isComplete(habitsByDate, habitId, cursor)) cursor = shiftDate(cursor, -1);
  let streak = 0;
  while (isComplete(habitsByDate, habitId, cursor)) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}
function longestStreakFor(habitsByDate, habitId) {
  const completedDays = Object.keys(habitsByDate).filter((day) => isComplete(habitsByDate, habitId, day)).sort();
  let best = 0;
  let run = 0;
  let previous = null;
  for (const day of completedDays) {
    run = previous && shiftDate(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}
function createHabitId() {
  return globalThis.crypto?.randomUUID?.() || `habit-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function App() {
  const today = dateKey();
  const [state, setState] = useState(() => loadState(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [newHabitName, setNewHabitName] = useState('');
  const [editingHabitId, setEditingHabitId] = useState(null);
  const [editingHabit, setEditingHabit] = useState({ name: '', icon: '', color: '#34d399' });
  const [habitError, setHabitError] = useState('');

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(state)), [state]);

  const entry = state.entries[selectedDate] || { journal: '', recovery: '', notes: '', mood: 'balanced', energy: '7' };
  const selectedHabits = state.habitsByDate[selectedDate] || {};
  const completed = state.habitDefinitions.filter(({ id }) => selectedHabits[id]).length;
  const habitTotal = state.habitDefinitions.length;
  const weightRange = 200 - state.goalWeight;
  const percent = weightRange > 0 ? Math.min(Math.max(((200 - state.weight) / weightRange) * 100, 0), 100) : 0;
  const entryCount = Object.values(state.entries).filter((item) => Object.values(item).some((value) => String(value || '').trim())).length;
  const headline = useMemo(() => {
    if (state.weight <= state.goalWeight) return 'Goal on track';
    if (percent >= 75) return 'Strong momentum';
    if (percent >= 40) return 'Steady progress';
    return 'Building consistency';
  }, [percent, state.weight, state.goalWeight]);
  const weeklySummaries = Array.from({ length: 7 }, (_, index) => {
    const day = shiftDate(today, index - 6);
    return { day, count: state.habitDefinitions.filter(({ id }) => isComplete(state.habitsByDate, id, day)).length };
  });
  const bestWeekDay = weeklySummaries.reduce((best, current) => current.count > best.count ? current : best, weeklySummaries[0]);
  const totalWeekHabitWins = weeklySummaries.reduce((sum, item) => sum + item.count, 0);

  function updateEntry(field, value) {
    setState((current) => ({ ...current, entries: { ...current.entries, [selectedDate]: {
      journal: '', recovery: '', notes: '', mood: 'balanced', energy: '7',
      ...current.entries[selectedDate], [field]: value,
    } } }));
  }
  function toggleHabit(habitId) {
    setState((current) => ({ ...current, habitsByDate: { ...current.habitsByDate, [selectedDate]: {
      ...current.habitsByDate[selectedDate], [habitId]: !current.habitsByDate[selectedDate]?.[habitId],
    } } }));
  }
  function saveHabit(rawHabit, habitId = null) {
    const name = rawHabit.name.trim();
    if (!name) {
      setHabitError('Enter a habit name.');
      return false;
    }
    if (state.habitDefinitions.some((habit) => habit.id !== habitId && habit.name.toLowerCase() === name.toLowerCase())) {
      setHabitError('A habit with that name already exists.');
      return false;
    }
    setState((current) => ({ ...current, habitDefinitions: habitId
      ? current.habitDefinitions.map((habit) => habit.id === habitId ? { ...habit, ...rawHabit, name } : habit)
      : [...current.habitDefinitions, { ...rawHabit, id: createHabitId(), name, icon: rawHabit.icon.trim() || '✨' }],
    }));
    setHabitError('');
    return true;
  }
  function addHabit(event) {
    event.preventDefault();
    if (saveHabit({ name: newHabitName, icon: '✨', color: '#34d399' })) setNewHabitName('');
  }
  function deleteHabit(habit) {
    if (!window.confirm(`Delete “${habit.name}” and its completion history? This cannot be undone.`)) return;
    setState((current) => {
      const habitsByDate = Object.fromEntries(Object.entries(current.habitsByDate).map(([day, habits]) => {
        const { [habit.id]: removed, ...remaining } = habits;
        return [day, remaining];
      }));
      return { ...current, habitDefinitions: current.habitDefinitions.filter((item) => item.id !== habit.id), habitsByDate };
    });
    if (editingHabitId === habit.id) setEditingHabitId(null);
  }
  function resetSelectedDay() {
    if (!window.confirm(`Clear all habit completions for ${formatDate(selectedDate)}?`)) return;
    setState((current) => ({ ...current, habitsByDate: { ...current.habitsByDate, [selectedDate]: {} } }));
  }
  function restoreDefaultHabits() {
    if (!window.confirm('Restore the five default habits? Custom habits will be removed, but existing completion history for matching default habits will remain.')) return;
    setState((current) => ({ ...current, habitDefinitions: DEFAULT_HABITS }));
    setEditingHabitId(null);
    setHabitError('');
  }
  function updateNumber(field, value) {
    setState((current) => ({ ...current, [field]: Number(value) || 0 }));
  }

  return (
    <div style={{ minHeight: '100vh', background: '#111827', color: '#f9fafb', padding: '16px 16px 28px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <main style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: '16px' }}>
        <header style={{ margin: '8px 0 24px' }}>
          <p style={{ color: '#34d399', fontSize: '12px', fontWeight: 700, letterSpacing: '0.14em', margin: '0 0 8px', textTransform: 'uppercase' }}>Your daily planner</p>
          <h1 style={{ margin: 0, fontSize: '2rem', letterSpacing: '-0.04em' }}>🌑 Timmy'sShadow</h1>
          <p style={{ color: '#9ca3af', margin: '8px 0 0' }}>Your Personal Life Operating System</p>
        </header>

        <section id="home" style={{ ...cardStyle, background: 'linear-gradient(135deg, #1f2937, #172b2b)' }}>
          <p style={{ color: '#a7f3d0', fontSize: '13px', fontWeight: 700, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Today's focus</p>
          <h2 style={{ fontSize: '1.35rem', margin: '0 0 16px' }}>{headline}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
            <Metric label="Weight" value={`${state.weight} lbs`} /><Metric label="Goal" value={`${state.goalWeight} lbs`} /><Metric label="Habits" value={`${completed}/${habitTotal}`} />
          </div>
          <div style={{ height: '8px', background: '#374151', borderRadius: '999px', overflow: 'hidden', marginTop: '18px' }}><div style={{ width: `${percent}%`, background: '#10b981', height: '100%', transition: 'width 180ms ease' }} /></div>
          <p style={{ color: '#9ca3af', fontSize: '13px', margin: '8px 0 0' }}>Weight goal progress · {Math.round(percent)}%</p>
        </section>

        <section id="weekly" style={cardStyle}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.15rem' }}>Weekly review</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', marginBottom: '16px' }}>
            <Metric label="Completions" value={`${totalWeekHabitWins}`} /><Metric label="Best day" value={`${bestWeekDay.count}/${habitTotal}`} />
            <Metric label="Streak" value={`${state.habitDefinitions[0] ? streakFor(state.habitsByDate, state.habitDefinitions[0].id, selectedDate, today) : 0} days`} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '6px' }}>
            {weeklySummaries.map(({ day, count }) => <div key={day} style={{ textAlign: 'center' }}>
              <div style={{ color: '#9ca3af', fontSize: '10px', marginBottom: '8px' }}>{WEEK_DAYS[new Date(`${day}T00:00:00`).getDay()]}</div>
              <div style={{ width: '100%', minHeight: '52px', borderRadius: '10px', background: count === 0 ? '#1f2937' : count >= Math.max(1, habitTotal * 0.8) ? '#10b981' : count >= Math.max(1, habitTotal * 0.4) ? '#f59e0b' : '#374151', border: '1px solid #374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>{count}</div>
            </div>)}
          </div>
        </section>

        <section id="habits" style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '12px', flexWrap: 'wrap' }}>
            <div><h2 style={{ margin: '0 0 5px', fontSize: '1.15rem' }}>Habit tracker</h2><p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>{formatDate(selectedDate)}</p></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ color: '#a7f3d0', background: '#064e3b', borderRadius: '999px', padding: '6px 10px', fontSize: '12px', whiteSpace: 'nowrap' }}>{completed} of {habitTotal} done</span>
              <button type="button" onClick={resetSelectedDay} style={buttonStyle}>Reset day</button>
              <button type="button" onClick={restoreDefaultHabits} style={buttonStyle}>Restore defaults</button>
            </div>
          </div>
          {state.habitDefinitions.map((habit) => {
            const { id, name, icon, color } = habit;
            const streak = streakFor(state.habitsByDate, id, selectedDate, today);
            const best = longestStreakFor(state.habitsByDate, id);
            const isEditing = editingHabitId === id;
            return <div key={id} style={{ padding: '12px 0', borderBottom: '1px solid #374151' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <input aria-label={`Mark ${name} complete`} type="checkbox" checked={Boolean(selectedHabits[id])} onChange={() => toggleHabit(id)} style={{ width: '20px', height: '20px', accentColor: color, flexShrink: 0 }} />
                {isEditing ? <form onSubmit={(event) => { event.preventDefault(); if (saveHabit(editingHabit, id)) setEditingHabitId(null); }} style={{ display: 'flex', flex: 1, alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <input aria-label="Habit name" autoFocus maxLength={60} value={editingHabit.name} onChange={(event) => { setEditingHabit((current) => ({ ...current, name: event.target.value })); setHabitError(''); }} style={{ ...inputStyle, flex: '1 1 130px', width: 'auto', minWidth: 0, padding: '8px 10px' }} />
                  <input aria-label="Habit icon or emoji" maxLength={8} value={editingHabit.icon} onChange={(event) => setEditingHabit((current) => ({ ...current, icon: event.target.value }))} style={{ ...inputStyle, width: '70px', padding: '8px' }} />
                  <select aria-label="Habit color" value={editingHabit.color} onChange={(event) => setEditingHabit((current) => ({ ...current, color: event.target.value }))} style={{ ...inputStyle, width: 'auto', padding: '8px' }}>{HABIT_COLORS.map((option) => <option key={option} value={option}>{option}</option>)}</select>
                  <button type="submit" style={buttonStyle}>Save</button>
                  <button type="button" onClick={() => { setEditingHabitId(null); setHabitError(''); }} style={buttonStyle}>Cancel</button>
                </form> : <>
                  <span style={{ fontSize: '20px' }} aria-hidden="true">{icon}</span>
                  <span style={{ flex: 1, textTransform: 'capitalize', overflowWrap: 'anywhere' }}>{name}</span>
                  <span style={{ color: '#9ca3af', fontSize: '12px', whiteSpace: 'nowrap' }}>🔥 {streak} day{streak === 1 ? '' : 's'} · best {best}</span>
                  <button type="button" aria-label={`Edit ${name}`} onClick={() => { setEditingHabitId(id); setEditingHabit({ name, icon, color }); setHabitError(''); }} style={buttonStyle}>Edit</button>
                  <button type="button" aria-label={`Delete ${name}`} onClick={() => deleteHabit(habit)} style={{ ...buttonStyle, color: '#fca5a5' }}>Delete</button>
                </>}
              </div>
            </div>;
          })}
          <form onSubmit={addHabit} style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            <input aria-label="New habit name" value={newHabitName} onChange={(event) => { setNewHabitName(event.target.value); setHabitError(''); }} placeholder="Add a habit" maxLength={60} style={{ ...inputStyle, minWidth: 0 }} />
            <button type="submit" style={{ ...buttonStyle, background: '#065f46', borderColor: '#047857', whiteSpace: 'nowrap' }}>Add habit</button>
          </form>
          {habitError && <p role="alert" style={{ color: '#fca5a5', fontSize: '13px', margin: '8px 0 0' }}>{habitError}</p>}
          <p style={{ color: '#6b7280', fontSize: '12px', margin: '12px 0 0' }}>Streaks count consecutive completed days. Habits and history save automatically on this device.</p>
        </section>

        <section id="journal" style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div><h2 style={{ margin: '0 0 5px', fontSize: '1.15rem' }}>Journal</h2><p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>{entryCount} day{entryCount === 1 ? '' : 's'} with notes</p></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button type="button" aria-label="Previous day" onClick={() => setSelectedDate((day) => shiftDate(day, -1))} style={buttonStyle}>←</button>
              <input aria-label="Select journal date" type="date" value={selectedDate} max={today} onChange={(event) => event.target.value && setSelectedDate(event.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: '145px', padding: '9px' }} />
              <button type="button" aria-label="Next day" disabled={selectedDate >= today} onClick={() => setSelectedDate((day) => shiftDate(day, 1))} style={{ ...buttonStyle, opacity: selectedDate >= today ? 0.45 : 1 }}>→</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', marginBottom: '12px' }}>
            <label><span style={{ display: 'block', marginBottom: '7px', fontSize: '14px' }}>Mood</span><select value={entry.mood || 'balanced'} onChange={(event) => updateEntry('mood', event.target.value)} style={inputStyle}><option value="happy">Happy</option><option value="balanced">Balanced</option><option value="tired">Tired</option><option value="stress">Stressed</option><option value="focused">Focused</option></select></label>
            <label><span style={{ display: 'block', marginBottom: '7px', fontSize: '14px' }}>Energy</span><input type="range" min="1" max="10" value={Number(entry.energy || 7)} onChange={(event) => updateEntry('energy', event.target.value)} style={{ width: '100%', accentColor: '#10b981' }} /><div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '4px' }}>{entry.energy || 7}/10</div></label>
          </div>
          <TextArea label="Journal entry" value={entry.journal} onChange={(value) => updateEntry('journal', value)} placeholder="What stood out today?" />
          <TextArea label="Recovery notes" value={entry.recovery} onChange={(value) => updateEntry('recovery', value)} placeholder="How is your body feeling?" />
          <label style={{ display: 'block', marginTop: '14px' }}><span style={{ display: 'block', marginBottom: '7px', fontSize: '14px' }}>Daily intention</span><input value={entry.notes} onChange={(event) => updateEntry('notes', event.target.value)} placeholder="A small thing to focus on" style={inputStyle} /></label>
          <p style={{ color: '#6b7280', fontSize: '12px', margin: '12px 0 0' }}>Entries and habit history save automatically on this device.</p>
        </section>

        <section id="goals" style={cardStyle}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.15rem' }}>Weight &amp; goals</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <label><span style={{ display: 'block', marginBottom: '7px', fontSize: '14px' }}>Current weight (lbs)</span><input type="number" min="0" value={state.weight} onChange={(event) => updateNumber('weight', event.target.value)} style={inputStyle} /></label>
            <label><span style={{ display: 'block', marginBottom: '7px', fontSize: '14px' }}>Goal weight (lbs)</span><input type="number" min="0" value={state.goalWeight} onChange={(event) => updateNumber('goalWeight', event.target.value)} style={inputStyle} /></label>
          </div>
        </section>

        <nav aria-label="Main navigation" style={{ position: 'sticky', bottom: '12px', background: 'rgba(31,41,55,0.96)', border: '1px solid #374151', borderRadius: '16px', padding: '10px 6px', display: 'flex', justifyContent: 'space-around', marginTop: '20px', backdropFilter: 'blur(12px)' }}>
          <NavLink href="#home" icon="🏠" label="Home" /><NavLink href="#weekly" icon="📊" label="Week" /><NavLink href="#habits" icon="✅" label="Habits" /><NavLink href="#journal" icon="📓" label="Journal" /><NavLink href="#goals" icon="🎯" label="Goals" />
        </nav>
      </main>
    </div>
  );
}

function Metric({ label, value }) {
  return <div style={{ background: 'rgba(17,24,39,0.65)', borderRadius: '12px', padding: '12px 10px', minWidth: 0 }}><div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '5px' }}>{label}</div><div style={{ fontWeight: 700, fontSize: '15px', overflowWrap: 'anywhere' }}>{value}</div></div>;
}
function TextArea({ label, value, onChange, placeholder }) {
  return <label style={{ display: 'block', marginTop: '14px' }}><span style={{ display: 'block', marginBottom: '7px', fontSize: '14px' }}>{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} /></label>;
}
function NavLink({ href, icon, label }) {
  return <a href={href} style={{ color: '#d1d5db', textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '4px 8px', fontSize: '11px' }}><span aria-hidden="true" style={{ fontSize: '19px' }}>{icon}</span><span>{label}</span></a>;
}

export default App;
