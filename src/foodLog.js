export const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
export const NUTRIENTS = ['calories', 'protein', 'carbs', 'fat'];

const round = (value) => Math.round(value * 10) / 10;

function toAmount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? round(number) : 0;
}

export function sanitizeFoodLogs(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result = {};
  for (const [day, items] of Object.entries(raw)) {
    if (!Array.isArray(items)) continue;
    result[day] = items
      .filter((item) => item && typeof item === 'object' && String(item.name || '').trim())
      .map((item, index) => ({
        id: String(item.id || `food-${day}-${index}`),
        meal: MEALS.includes(item.meal) ? item.meal : 'Snack',
        name: String(item.name).trim(),
        calories: toAmount(item.calories),
        protein: toAmount(item.protein),
        carbs: toAmount(item.carbs),
        fat: toAmount(item.fat),
      }));
  }
  return result;
}

export function normalizeFood(form) {
  const name = String(form.name || '').trim();
  if (!name) return { error: 'Enter a food name.' };
  const values = {};
  for (const field of NUTRIENTS) {
    const text = String(form[field] ?? '').trim();
    if (text !== '' && !(Number(text) >= 0)) return { error: 'Calories and macros must be zero or more.' };
    values[field] = toAmount(text);
  }
  return { food: { meal: MEALS.includes(form.meal) ? form.meal : 'Snack', name, ...values } };
}

export function totalsFor(foods = []) {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const food of foods) {
    for (const field of NUTRIENTS) totals[field] += Number(food[field]) || 0;
  }
  for (const field of NUTRIENTS) totals[field] = round(totals[field]);
  return totals;
}

export function addFood(logs, day, food, id) {
  return { ...logs, [day]: [...(logs[day] || []), { ...food, id }] };
}

export function updateFood(logs, day, id, food) {
  return { ...logs, [day]: (logs[day] || []).map((item) => (item.id === id ? { ...item, ...food, id } : item)) };
}

export function deleteFood(logs, day, id) {
  return { ...logs, [day]: (logs[day] || []).filter((item) => item.id !== id) };
}
