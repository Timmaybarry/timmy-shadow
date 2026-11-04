import { useState } from 'react';
import { DEFAULT_NUTRITION_GOALS, MEAL_TYPES, totalsFor, validateFoodItem } from './meals.js';

const cardStyle = { background: '#1f2937', border: '1px solid #293548', borderRadius: '18px', padding: '20px', marginBottom: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' };
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid #374151', background: '#111827', color: '#f9fafb', fontSize: '16px', boxSizing: 'border-box' };
const buttonStyle = { border: '1px solid #374151', borderRadius: '10px', padding: '9px 12px', background: '#111827', color: '#e5e7eb', fontSize: '14px', cursor: 'pointer' };
const MACROS = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
];
const emptyForm = { name: '', mealType: MEAL_TYPES[0], calories: '', protein: '', carbs: '', fat: '' };

export default function MealTracker({ date, items, goals, onAdd, onDelete, onGoalsChange }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const totals = totalsFor(items);

  function submit(event) {
    event.preventDefault();
    const result = validateFoodItem(form);
    if (result.error) {
      setError(result.error);
      return;
    }
    onAdd(result.item);
    setError('');
    setForm((current) => ({ ...emptyForm, mealType: current.mealType }));
  }

  const setField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <section id="meals" style={cardStyle}>
      <h2 style={{ margin: '0 0 6px', fontSize: '1.15rem' }}>Meals & macros</h2>
      <p style={{ color: '#9ca3af', fontSize: '13px', margin: '0 0 16px' }}>Manual food log for {date}. Saved in this browser only.</p>

      <div style={{ display: 'grid', gap: '10px', marginBottom: '16px' }}>
        {MACROS.map(({ key, label, unit }) => {
          const goal = goals[key];
          const pct = Math.min(100, Math.round((totals[key] / goal) * 100));
          const over = totals[key] > goal;
          return (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                <span>{label}</span>
                <span style={{ color: over ? '#fca5a5' : '#d1d5db' }}>
                  {totals[key]} / {goal} {unit} · {over ? `${Math.round((totals[key] - goal) * 10) / 10} over` : `${Math.round((goal - totals[key]) * 10) / 10} left`}
                </span>
              </div>
              <div role="progressbar" aria-label={`${label} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} style={{ height: '8px', borderRadius: '999px', background: '#111827' }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: '999px', background: over ? '#ef4444' : '#10b981' }} />
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={submit} noValidate style={{ display: 'grid', gap: '10px', marginBottom: '16px' }}>
        <input aria-label="Food name" value={form.name} onChange={setField('name')} placeholder="Food name (e.g. Oatmeal)" maxLength={80} style={inputStyle} />
        <select aria-label="Meal" value={form.mealType} onChange={setField('mealType')} style={inputStyle}>
          {MEAL_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '8px' }}>
          {MACROS.map(({ key, label, unit }) => (
            <input key={key} aria-label={`${label} (${unit})`} type="number" inputMode="decimal" min="0" step="any" value={form[key]} onChange={setField(key)} placeholder={`${label} (${unit})`} style={inputStyle} />
          ))}
        </div>
        {error && <p role="alert" style={{ color: '#fca5a5', fontSize: '13px', margin: 0 }}>{error}</p>}
        <button type="submit" style={{ ...buttonStyle, borderColor: '#047857' }}>Add food</button>
      </form>

      {items.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: '14px', margin: '0 0 16px' }}>No meals logged for this day yet. Add your first food above.</p>
      ) : (
        MEAL_TYPES.map((type) => {
          const mealItems = items.filter((item) => (item.mealType || MEAL_TYPES[0]) === type);
          if (!mealItems.length) return null;
          const mealTotals = totalsFor(mealItems);
          return (
            <div key={type} style={{ marginBottom: '12px' }}>
              <h3 style={{ margin: '0 0 6px', fontSize: '14px' }}>{type} <span style={{ color: '#9ca3af', fontWeight: 400 }}>· {mealTotals.calories} kcal</span></h3>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '6px' }}>
                {mealItems.map((item) => (
                  <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', background: '#111827', border: '1px solid #374151', borderRadius: '12px', padding: '8px 12px' }}>
                    <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                      {item.name}
                      <span style={{ display: 'block', color: '#9ca3af', fontSize: '12px' }}>{item.calories} kcal · P {item.protein}g · C {item.carbs}g · F {item.fat}g</span>
                    </span>
                    <button type="button" onClick={() => onDelete(item.id)} aria-label={`Delete ${item.name}`} style={buttonStyle}>✕</button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}

      <details>
        <summary style={{ cursor: 'pointer', fontSize: '14px' }}>Daily goals</summary>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', marginTop: '10px' }}>
          {MACROS.map(({ key, label, unit }) => (
            <label key={key} style={{ fontSize: '13px' }}>
              <span style={{ display: 'block', marginBottom: '5px' }}>{label} ({unit})</span>
              <input type="number" min="1" step="any" value={goals[key]} onChange={(event) => {
                const number = Number(event.target.value);
                if (event.target.value !== '' && Number.isFinite(number) && number > 0) onGoalsChange({ ...goals, [key]: number });
              }} style={inputStyle} />
            </label>
          ))}
        </div>
        <button type="button" onClick={() => onGoalsChange({ ...DEFAULT_NUTRITION_GOALS })} style={{ ...buttonStyle, marginTop: '10px' }}>Reset goals</button>
      </details>
    </section>
  );
}
