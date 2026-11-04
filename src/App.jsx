import { useEffect, useMemo, useState } from 'react';
import MealTracker from './MealTracker.jsx';
import { DEFAULT_NUTRITION_GOALS, sanitizeGoals, sanitizeMeals } from './meals.js';

const STORAGE_KEY = 'timmy-shadow-state';
const HABIT_NAMES = ['sleep', 'hydration', 'movement', 'focus', 'mindfulness'];
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const cardStyle = {
  background: '#1f2937',
  border: '1px solid #293548',
  borderRadius: '18px',
  padding: '20px',
  marginBottom: '16px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
};
const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '12px',
  border: '1px solid #374151',
  background: '#111827',
  color: '#f9fafb',
  fontSize: '16px',
  boxSizing: 'border-box',
};
const buttonStyle = {
  border: '1px solid #374151',
  borderRadius: '10px',
  padding: '9px 12px',
  background: '#111827',
  color: '#e5e7eb',
  fontSize: '14px',
  cursor: 'pointer',
};

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDate(key, amount) {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day + amount);
  return dateKey(date);
}

function formatDate(key, options = { weekday: 'long', month: 'long', day: 'numeric' }) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, options);
}

function getLastSevenDays() {
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return dateKey(date);
  });
}

function makeDefaultState(today) {
  return {
    weight: 185,
    goalWeight: 160,
    habitsByDate: {
      [today]: {
        sleep: true,
        hydration: true,
        movement: false,
        focus: true,
        mindfulness: false,
      },
    },
    habitDefinitions: [
      { id: 'sleep', name: 'Sleep', icon: '😴' },
      { id: 'hydration', name: 'Hydration', icon: '💧' },
      { id: 'movement', name: 'Movement', icon: '🏃' },
      { id: 'focus', name: 'Focus', icon: '🎯' },
      { id: 'mindfulness', name: 'Mindfulness', icon: '🧘' },
    ],
    entries: {
      [today]: {
        journal: 'Today felt grounded. I kept my routine simple and took small moves toward the goals that matter most.',
        recovery: 'Felt a little sore after the workout, but recovery is improving. Stretching and walking helped a lot.',
        notes: 'Keep the day gentle. Protect energy and stay consistent with the basics.',
        mood: 'balanced',
        energy: '7',
      },
    },
    workoutPlans: {},
    workoutLogs: {},
    meals: {},
    nutritionGoals: { ...DEFAULT_NUTRITION_GOALS },
  };
}

function loadState(today) {
  const defaults = makeDefaultState(today);
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return defaults;

    const habitsByDate = saved.habitsByDate || {
      [today]: saved.habits || defaults.habitsByDate[today],
    };
    const entries = saved.entries || {
      [today]: {
        journal: saved.journal ?? defaults.entries[today].journal,
        recovery: saved.recovery ?? defaults.entries[today].recovery,
        notes: saved.notes ?? defaults.entries[today].notes,
        mood: saved.mood ?? defaults.entries[today].mood,
        energy: saved.energy ?? defaults.entries[today].energy,
      },
    };

    return {
      weight: Number(saved.weight) || defaults.weight,
      goalWeight: Number(saved.goalWeight) || defaults.goalWeight,
      habitsByDate,
      habitDefinitions: Array.isArray(saved.habitDefinitions) && saved.habitDefinitions.length
        ? saved.habitDefinitions
        : defaults.habitDefinitions,
      entries,
      workoutPlans: saved.workoutPlans || defaults.workoutPlans,
      workoutLogs: saved.workoutLogs || defaults.workoutLogs,
      meals: sanitizeMeals(saved.meals),
      nutritionGoals: sanitizeGoals(saved.nutritionGoals),
    };
  } catch {
    return defaults;
  }
}

function isComplete(habitsByDate, habit, day) {
  return Boolean(habitsByDate[day]?.[habit]);
}

function streakFor(habitsByDate, habit, endingDay, today) {
  let cursor = endingDay;
  if (cursor === today && !isComplete(habitsByDate, habit, cursor)) {
    cursor = shiftDate(cursor, -1);
  }

  let streak = 0;
  while (isComplete(habitsByDate, habit, cursor)) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

function longestStreakFor(habitsByDate, habit) {
  const completedDays = Object.keys(habitsByDate)
    .filter((day) => isComplete(habitsByDate, habit, day))
    .sort();
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

function workoutForDate(workoutPlans, dateKeyValue) {
  return workoutPlans[dateKeyValue] || { title: 'Recovery day', exercises: [] };
}

function createHabitId() {
  return `habit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function App() {
  const today = dateKey();
  const [state, setState] = useState(() => loadState(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [habitForm, setHabitForm] = useState({ name: '', icon: '✨' });
  const [habitError, setHabitError] = useState('');
  const [isEditingHabit, setIsEditingHabit] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

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
  const workout = workoutForDate(state.workoutPlans, selectedDate);
  const workoutLog = state.workoutLogs[selectedDate] || {};
  const completedExercises = workout.exercises.filter((exercise) => workoutLog[exercise.id]?.done).length;
  const workoutHistory = Object.entries(state.workoutLogs).filter(([, log]) => Object.values(log || {}).some((item) => item?.done)).length;

  function updateEntry(field, value) {
    setState((current) => ({ ...current, entries: { ...current.entries, [selectedDate]: {
      journal: '', recovery: '', notes: '', mood: 'balanced', energy: '7', ...current.entries[selectedDate], [field]: value,
    } } }));
  }

  function toggleHabit(habitId) {
    setState((current) => ({ ...current, habitsByDate: { ...current.habitsByDate, [selectedDate]: {
      ...current.habitsByDate[selectedDate], [habitId]: !current.habitsByDate[selectedDate]?.[habitId],
    } } }));
  }

  function saveHabit(rawHabit, habitId = null) {
    const name = rawHabit.name.trim();
    if (!name) { setHabitError('Enter a habit name.'); return false; }
    if (state.habitDefinitions.some((habit) => habit.id !== habitId && habit.name.toLowerCase() === name.toLowerCase())) { setHabitError('A habit with that name already exists.'); return false; }
    setState((current) => ({ ...current, habitDefinitions: habitId
      ? current.habitDefinitions.map((habit) => habit.id === habitId ? { ...habit, ...rawHabit, name } : habit)
      : [...current.habitDefinitions, { ...rawHabit, id: createHabitId(), name, icon: rawHabit.icon.trim() || '✨' }],
    }));
    setHabitError(''); return true;
  }

  function addHabit(event) {
    event.preventDefault();
    const rawHabit = { ...habitForm, name: habitForm.name.trim(), icon: habitForm.icon.trim() || '✨' };
    if (saveHabit(rawHabit, isEditingHabit)) {
      setHabitForm({ name: '', icon: '✨' });
      setIsEditingHabit(null);
    }
  }

  function editHabit(habit) {
    setHabitForm({ name: habit.name, icon: habit.icon || '✨' });
    setIsEditingHabit(habit.id);
    setHabitError('');
  }

  function deleteHabit(habitId) {
    setState((current) => ({
      ...current,
      habitDefinitions: current.habitDefinitions.filter((habit) => habit.id !== habitId),
      habitsByDate: Object.fromEntries(Object.entries(current.habitsByDate).map(([date, habits]) => [
        date,
        Object.fromEntries(Object.entries(habits).filter(([key]) => key !== habitId)),
      ])),
    }));
    if (isEditingHabit === habitId) {
      setHabitForm({ name: '', icon: '✨' });
      setIsEditingHabit(null);
    }
  }

  function updateNumber(field, value) {
    setState((current) => ({ ...current, [field]: Number(value) || 0 }));
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#111827',
        color: '#f9fafb',
        padding: '16px 16px 28px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <main style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: '16px' }}>
        <header style={{ margin: '8px 0 24px' }}>
          <p style={{ color: '#34d399', fontSize: '12px', fontWeight: 700, letterSpacing: '0.14em', margin: '0 0 8px', textTransform: 'uppercase' }}>
            Your daily planner
          </p>
          <h1 style={{ margin: 0, fontSize: '2rem', letterSpacing: '-0.04em' }}>🌑 Timmy'sShadow</h1>
          <p style={{ color: '#9ca3af', margin: '8px 0 0' }}>Your Personal Life Operating System</p>
        </header>

        <section id="home" style={{ ...cardStyle, background: 'linear-gradient(135deg, #1f2937, #172b2b)' }}>
          <p style={{ color: '#a7f3d0', fontSize: '13px', fontWeight: 700, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Today's focus
          </p>
          <h2 style={{ fontSize: '1.35rem', margin: '0 0 16px' }}>{headline}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
            <Metric label="Weight" value={`${state.weight} lbs`} />
            <Metric label="Goal" value={`${state.goalWeight} lbs`} />
            <Metric label="Habits" value={`${completed}/${habitTotal}`} />
          </div>
          <div style={{ height: '8px', background: '#374151', borderRadius: '999px', overflow: 'hidden', marginTop: '18px' }}>
            <div style={{ width: `${percent}%`, background: '#10b981', height: '100%', transition: 'width 180ms ease' }} />
          </div>
          <p style={{ color: '#9ca3af', fontSize: '13px', margin: '8px 0 0' }}>Weight goal progress · {Math.round(percent)}%</p>
        </section>

        <section id="weekly" style={cardStyle}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.15rem' }}>Weekly review</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', marginBottom: '16px' }}>
            <Metric label="Completions" value={`${totalWeekHabitWins}`} />
            <Metric label="Best day" value={bestWeekDay ? `${bestWeekDay.count}/${habitTotal}` : `0/${habitTotal}`} />
            <Metric label="Streak" value={`${streakFor(state.habitsByDate, 'mindfulness', selectedDate, today)} days`} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '6px' }}>
            {weeklySummaries.map(({ day, count }) => (
              <div key={day} style={{ textAlign: 'center' }}>
                <div style={{ color: '#9ca3af', fontSize: '10px', marginBottom: '8px' }}>{WEEK_DAYS[new Date(day).getDay()]}</div>
                <div
                  style={{
                    width: '100%',
                    minHeight: '52px',
                    borderRadius: '10px',
                    background: count === 0 ? '#1f2937' : count >= habitTotal - 1 ? '#10b981' : count >= Math.ceil(habitTotal / 2) ? '#f59e0b' : '#374151',
                    border: '1px solid #374151',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#f9fafb',
                  }}
                >
                  {count}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="habits" style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '12px' }}>
            <div>
              <h2 style={{ margin: '0 0 5px', fontSize: '1.15rem' }}>Habit tracker</h2>
              <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>{formatDate(selectedDate)}</p>
            </div>
            <span style={{ color: '#a7f3d0', background: '#064e3b', borderRadius: '999px', padding: '6px 10px', fontSize: '12px', whiteSpace: 'nowrap' }}>
              {completed} of {habitTotal} done
            </span>
          </div>

          {state.habitDefinitions.map((habit) => {
            const streak = streakFor(state.habitsByDate, habit.id, selectedDate, today);
            const best = longestStreakFor(state.habitsByDate, habit.id);
            return (
              <div key={habit.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 0', borderBottom: '1px solid #374151' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(selectedHabits[habit.id])}
                    onChange={() => toggleHabit(habit.id)}
                    style={{ width: '20px', height: '20px', accentColor: '#10b981', flexShrink: 0 }}
                  />
                  <span style={{ flex: 1 }}>{habit.icon} {habit.name}</span>
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" onClick={() => editHabit(habit)} style={buttonStyle}>Edit</button>
                  <button type="button" onClick={() => deleteHabit(habit.id)} style={{ ...buttonStyle, color: '#fca5a5' }}>Delete</button>
                </div>
                <span style={{ color: '#9ca3af', fontSize: '12px', whiteSpace: 'nowrap' }}>🔥 {streak} day{streak === 1 ? '' : 's'} · best {best}</span>
              </div>
            );
          })}

          <form onSubmit={addHabit} style={{ display: 'grid', gap: '10px', marginTop: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: '8px' }}>
              <input
                value={habitForm.name}
                onChange={(event) => setHabitForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="New habit name"
                style={inputStyle}
              />
              <input
                value={habitForm.icon}
                onChange={(event) => setHabitForm((current) => ({ ...current, icon: event.target.value }))}
                maxLength={2}
                placeholder="Icon"
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="submit" style={{ ...buttonStyle, background: '#065f46', borderColor: '#047857' }}>
                {isEditingHabit ? 'Save habit' : 'Add habit'}
              </button>
              {isEditingHabit && (
                <button type="button" onClick={() => { setHabitForm({ name: '', icon: '✨' }); setIsEditingHabit(null); setHabitError(''); }} style={buttonStyle}>
                  Cancel
                </button>
              )}
            </div>
            {habitError && <p role="alert" style={{ color: '#fca5a5', fontSize: '13px', margin: 0 }}>{habitError}</p>}
          </form>
        </section>

        <section id="journal" style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div>
              <h2 style={{ margin: '0 0 5px', fontSize: '1.15rem' }}>Journal</h2>
              <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>{entryCount} day{entryCount === 1 ? '' : 's'} with notes</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button type="button" aria-label="Previous day" onClick={() => setSelectedDate((day) => shiftDate(day, -1))} style={buttonStyle}>←</button>
              <input aria-label="Select journal date" type="date" value={selectedDate} max={today} onChange={(event) => event.target.value && setSelectedDate(event.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: '150px' }} />
              <button type="button" aria-label="Next day" disabled={selectedDate >= today} onClick={() => setSelectedDate((day) => shiftDate(day, 1))} style={{ ...buttonStyle, opacity: selectedDate >= today ? 0.5 : 1 }}>→</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', marginBottom: '12px' }}>
            <label>
              <span style={{ display: 'block', marginBottom: '7px', fontSize: '14px' }}>Mood</span>
              <select value={entry.mood || 'balanced'} onChange={(event) => updateEntry('mood', event.target.value)} style={inputStyle}>
                <option value="happy">Happy</option>
                <option value="balanced">Balanced</option>
                <option value="tired">Tired</option>
                <option value="stress">Stressed</option>
                <option value="focused">Focused</option>
              </select>
            </label>
            <label>
              <span style={{ display: 'block', marginBottom: '7px', fontSize: '14px' }}>Energy</span>
              <input type="range" min="1" max="10" value={Number(entry.energy || 7)} onChange={(event) => updateEntry('energy', event.target.value)} style={{ width: '100%', accentColor: '#10b981' }} />
              <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '4px' }}>{entry.energy || 7}/10</div>
            </label>
          </div>

          <TextArea label="Journal entry" value={entry.journal} onChange={(value) => updateEntry('journal', value)} placeholder="What stood out today?" />
          <TextArea label="Recovery notes" value={entry.recovery} onChange={(value) => updateEntry('recovery', value)} placeholder="How is your body feeling?" />
          <label style={{ display: 'block', marginTop: '14px' }}>
            <span style={{ display: 'block', marginBottom: '7px', fontSize: '14px' }}>Daily intention</span>
            <input value={entry.notes} onChange={(event) => updateEntry('notes', event.target.value)} placeholder="A small thing to focus on" style={inputStyle} />
          </label>
          <p style={{ color: '#6b7280', fontSize: '12px', margin: '12px 0 0' }}>Entries and habit history save automatically on this device.</p>
        </section>

        <section id="workouts" style={cardStyle}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.15rem' }}>Workout plan</h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            <input
              value={workout.title || 'Recovery day'}
              onChange={(event) => setState((current) => ({
                ...current,
                workoutPlans: {
                  ...current.workoutPlans,
                  [selectedDate]: {
                    ...workoutForDate(current.workoutPlans, selectedDate),
                    title: event.target.value,
                  },
                },
              }))}
              placeholder="Workout title"
              style={inputStyle}
            />
            <div style={{ display: 'grid', gap: '8px' }}>
              {(workout.exercises || []).map((exercise) => (
                <label key={exercise.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: '#111827', border: '1px solid #374151', borderRadius: '12px', padding: '10px 12px' }}>
                  <span>{exercise.name}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(workoutLog[exercise.id]?.done)}
                    onChange={() => setState((current) => ({
                      ...current,
                      workoutLogs: {
                        ...current.workoutLogs,
                        [selectedDate]: {
                          ...(current.workoutLogs[selectedDate] || {}),
                          [exercise.id]: {
                            ...(current.workoutLogs[selectedDate]?.[exercise.id] || {}),
                            done: !current.workoutLogs[selectedDate]?.[exercise.id]?.done,
                          },
                        },
                      },
                    }))}
                    style={{ width: '20px', height: '20px', accentColor: '#10b981' }}
                  />
                </label>
              ))}
            </div>
            <p style={{ color: '#9ca3af', fontSize: '12px', margin: 0 }}>{completedExercises} of {(workout.exercises || []).length} exercises done · {workoutHistory} workout days logged</p>
          </div>
        </section>

        <MealTracker
          date={formatDate(selectedDate)}
          items={state.meals[selectedDate] || []}
          goals={state.nutritionGoals}
          onAdd={(item) => setState((current) => ({
            ...current,
            meals: {
              ...current.meals,
              [selectedDate]: [...(current.meals[selectedDate] || []), { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...item }],
            },
          }))}
          onDelete={(id) => setState((current) => ({
            ...current,
            meals: { ...current.meals, [selectedDate]: (current.meals[selectedDate] || []).filter((item) => item.id !== id) },
          }))}
          onGoalsChange={(nutritionGoals) => setState((current) => ({ ...current, nutritionGoals }))}
        />

        <section id="goals" style={cardStyle}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.15rem' }}>Weight & goals</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <label>
              <span style={{ display: 'block', marginBottom: '7px', fontSize: '14px' }}>Current weight (lbs)</span>
              <input type="number" min="0" value={state.weight} onChange={(event) => updateNumber('weight', event.target.value)} style={inputStyle} />
            </label>
            <label>
              <span style={{ display: 'block', marginBottom: '7px', fontSize: '14px' }}>Goal weight (lbs)</span>
              <input type="number" min="0" value={state.goalWeight} onChange={(event) => updateNumber('goalWeight', event.target.value)} style={inputStyle} />
            </label>
          </div>
        </section>

        <nav aria-label="Main navigation" style={{ position: 'sticky', bottom: '12px', background: 'rgba(31,41,55,0.96)', border: '1px solid #374151', borderRadius: '16px', padding: '10px 6px', display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '4px', marginTop: '20px' }}>
          <NavLink href="#home" icon="🏠" label="Home" />
          <NavLink href="#weekly" icon="📊" label="Week" />
          <NavLink href="#habits" icon="✅" label="Habits" />
          <NavLink href="#journal" icon="📓" label="Journal" />
          <NavLink href="#workouts" icon="💪" label="Workout" />
          <NavLink href="#meals" icon="🍽️" label="Meals" />
        </nav>
      </main>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div style={{ background: 'rgba(17,24,39,0.65)', borderRadius: '12px', padding: '12px 10px', minWidth: 0 }}>
      <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '5px' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: '15px', overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder }) {
  return (
    <label style={{ display: 'block', marginTop: '14px' }}>
      <span style={{ display: 'block', marginBottom: '7px', fontSize: '14px' }}>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
    </label>
  );
}

function NavLink({ href, icon, label }) {
  return (
    <a href={href} style={{ color: '#d1d5db', textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '4px 8px', fontSize: '11px' }}>
      <span aria-hidden="true" style={{ fontSize: '19px' }}>{icon}</span>
      <span>{label}</span>
    </a>
  );
}

export default App;
