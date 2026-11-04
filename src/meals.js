export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
export const DEFAULT_NUTRITION_GOALS = { calories: 2000, protein: 150, carbs: 200, fat: 65 };
const FIELDS = ['calories', 'protein', 'carbs', 'fat'];

export function sanitizeMeals(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  Object.entries(value).forEach(([day, items]) => {
    if (!Array.isArray(items)) return;
    result[day] = items.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string'
      && FIELDS.every((field) => Number.isFinite(Number(item[field]))));
  });
  return result;
}

export function sanitizeGoals(value) {
  const goals = { ...DEFAULT_NUTRITION_GOALS };
  FIELDS.forEach((field) => {
    const number = Number(value?.[field]);
    if (Number.isFinite(number) && number > 0) goals[field] = number;
  });
  return goals;
}

// Returns { error } or { item } for the raw string form values.
export function validateFoodItem(form) {
  const name = (form.name || '').trim();
  if (!name) return { error: 'Enter a food name.' };
  const values = {};
  for (const field of FIELDS) {
    const raw = String(form[field] ?? '').trim();
    if (raw === '') {
      if (field === 'calories') return { error: 'Enter calories for this food.' };
      values[field] = 0;
      continue;
    }
    const number = Number(raw);
    if (!Number.isFinite(number) || number < 0) return { error: `${field[0].toUpperCase()}${field.slice(1)} must be a number of 0 or more.` };
    if (number > 10000) return { error: `${field[0].toUpperCase()}${field.slice(1)} must be 10,000 or less.` };
    values[field] = Math.round(number * 10) / 10;
  }
  const mealType = MEAL_TYPES.includes(form.mealType) ? form.mealType : MEAL_TYPES[0];
  return { item: { name: name.slice(0, 80), mealType, ...values } };
}

export function totalsFor(items = []) {
  return items.reduce((sum, item) => {
    FIELDS.forEach((field) => { sum[field] = Math.round((sum[field] + Number(item[field] || 0)) * 10) / 10; });
    return sum;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}
