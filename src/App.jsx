import { useEffect, useMemo, useState } from 'react';

const cardStyle = {
  background: '#1f2937',
  borderRadius: '16px',
  padding: '16px',
  marginBottom: '16px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
};

const inputStyle = {
  width: '100%',
  padding: '12px',
  borderRadius: '12px',
  border: '1px solid #374151',
  background: '#111827',
  color: '#fff',
  fontSize: '16px',
  boxSizing: 'border-box',
};

const defaultState = {
  weight: 185,
  goalWeight: 160,
  habits: {
    sleep: true,
    hydration: true,
    movement: false,
    focus: true,
    mindfulness: false,
  },
  journal: 'Today felt grounded. I kept my routine simple and took small moves toward the goals that matter most.',
  recovery: 'Felt a little sore after the workout, but recovery is improving. Stretching and walking helped a lot.',
  notes: 'Keep the day gentle. Protect energy and stay consistent with the basics.',
};

function App() {
  const [state, setState] = useState(() => {
    const saved = localStorage.getItem('timmy-shadow-state');
    return saved ? JSON.parse(saved) : defaultState;
  });

  useEffect(() => {
    localStorage.setItem('timmy-shadow-state', JSON.stringify(state));
  }, [state]);

  const { weight, goalWeight, habits, journal, recovery, notes } = state;
  const startingWeight = 200;
  const percent = Math.min(
    Math.max(((startingWeight - weight) / (startingWeight - goalWeight)) * 100, 0),
    100
  );
  const completed = Object.values(habits).filter(Boolean).length;

  const toggleHabit = (habit) => {
    setState((current) => ({
      ...current,
      habits: {
        ...current.habits,
        [habit]: !current.habits[habit],
      },
    }));
  };

  const habitNames = Object.keys(habits);

  const headline = useMemo(() => {
    if (weight <= goalWeight) return 'Goal on track';
    if (percent >= 75) return 'Strong momentum';
    if (percent >= 40) return 'Steady progress';
    return 'Building consistency';
  }, [percent, weight, goalWeight]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#111827',
        color: '#f9fafb',
        padding: '16px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1
            style={{
              margin: 0,
              fontSize: '2rem',
            }}
          >
            🌑 Timmy'sShadow
          </h1>

          <p
            style={{
              color: '#9ca3af',
              marginTop: '6px',
            }}
          >
            Your Personal Life Operating System
          </p>
        </div>

        <div style={cardStyle}>
          <h2>Today's Focus</h2>

          <p>
            Weight: {weight} lbs
          </p>

          <p>
            Goal: {goalWeight} lbs
          </p>

          <p>
            Habits Complete: {completed}/5
          </p>

          <p style={{ color: '#9ca3af', margin: '8px 0 0' }}>{headline}</p>
        </div>

        <div style={cardStyle}>
          <h2>Weight Progress</h2>
          <p>
            {weight} lbs / {goalWeight} lbs
          </p>
          <div
            style={{
              height: '10px',
              background: '#374151',
              borderRadius: '999px',
              overflow: 'hidden',
              marginTop: '10px',
            }}
          >
            <div
              style={{
                width: `${Math.min(percent, 100)}%`,
                background: '#10b981',
                height: '100%',
              }}
            />
          </div>
        </div>

        <div style={cardStyle}>
          <h2>Habits</h2>
          {habitNames.map((habit) => (
            <label
              key={habit}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 0',
              }}
            >
              <input
                type="checkbox"
                checked={habits[habit]}
                onChange={() => toggleHabit(habit)}
              />

              <span
                style={{
                  textTransform: 'capitalize',
                }}
              >
                {habit}
              </span>
            </label>
          ))}
        </div>

        <div style={cardStyle}>
          <h2>Journal</h2>
          <textarea
            value={journal}
            onChange={(event) =>
              setState((current) => ({ ...current, journal: event.target.value }))
            }
            style={{
              ...inputStyle,
              resize: 'vertical',
              minHeight: '120px',
            }}
          />
        </div>

        <div style={cardStyle}>
          <h2>Recovery Notes</h2>
          <textarea
            value={recovery}
            onChange={(event) =>
              setState((current) => ({ ...current, recovery: event.target.value }))
            }
            style={{
              ...inputStyle,
              resize: 'vertical',
              minHeight: '120px',
            }}
          />
        </div>

        <div style={cardStyle}>
          <h2>Daily Notes</h2>
          <input
            value={notes}
            onChange={(event) =>
              setState((current) => ({ ...current, notes: event.target.value }))
            }
            style={inputStyle}
          />
        </div>

        <div style={cardStyle}>
          <h2>Goal Tracking</h2>
          <label style={{ display: 'block', marginBottom: '12px' }}>
            <span style={{ display: 'block', marginBottom: '6px' }}>Current Weight</span>
            <input
              type="number"
              value={weight}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  weight: Number(event.target.value) || 0,
                }))
              }
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', marginBottom: '6px' }}>Goal Weight</span>
            <input
              type="number"
              value={goalWeight}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  goalWeight: Number(event.target.value) || 0,
                }))
              }
              style={inputStyle}
            />
          </label>
        </div>

        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: '#1f2937',
            borderRadius: '16px',
            padding: '12px',
            display: 'flex',
            justifyContent: 'space-around',
            marginTop: '20px',
          }}
        >
          <span>🏠</span>
          <span>✅</span>
          <span>📓</span>
          <span>🏋️</span>
          <span>🎯</span>
        </div>
      </div>
    </div>
  );
}

export default App;
