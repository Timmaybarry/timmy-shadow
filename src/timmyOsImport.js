const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const date = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};
const time = (value) => typeof value === 'string' && (value === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(value));
const id = (value) => typeof value === 'string' && value.length > 0;

export function importTimmyOs(data, planner, shadow) {
  if (!object(data) || !object(data.journal) || !Array.isArray(data.tasks) || !Array.isArray(data.events) || !Array.isArray(data.habits)) {
    throw new Error('This is not a Timmy OS JSON backup.');
  }
  if (Object.entries(data.journal).some(([day, text]) => !date(day) || typeof text !== 'string') ||
      data.tasks.some((item) => !object(item) || !id(item.id) || !date(item.date) || typeof item.text !== 'string' || typeof item.done !== 'boolean') ||
      data.events.some((item) => !object(item) || !id(item.id) || !date(item.date) || typeof item.title !== 'string' || !time(item.start) || !time(item.end)) ||
      data.habits.some((item) => !object(item) || !id(item.id) || typeof item.name !== 'string' || !Array.isArray(item.checkins) || item.checkins.some((day) => !date(day))) ||
      [data.tasks, data.events, data.habits].some((items) => new Set(items.map((item) => item.id)).size !== items.length)) {
    throw new Error('The Timmy OS backup contains invalid or duplicate records; nothing was imported.');
  }

  const resultPlanner = { ...planner, events: [...planner.events], todos: [...planner.todos] };
  const resultShadow = {
    ...shadow,
    entries: { ...shadow.entries },
    habitsByDate: { ...shadow.habitsByDate },
    habitDefinitions: [...shadow.habitDefinitions],
    timmyOsJournalImports: { ...shadow.timmyOsJournalImports },
  };
  for (const [day, text] of Object.entries(data.journal)) {
    if (!text || resultShadow.timmyOsJournalImports[day]?.includes(text)) continue;
    const entry = resultShadow.entries[day] || {};
    const previous = entry.journal || '';
    resultShadow.entries[day] = { ...entry, journal: previous && previous !== text ? `${previous}\n\n--- Imported from Timmy OS ---\n${text}` : text };
    resultShadow.timmyOsJournalImports[day] = [...(resultShadow.timmyOsJournalImports[day] || []), text];
  }
  for (const item of data.tasks) {
    const importedId = `timmy-os:${item.id}`;
    if (!resultPlanner.todos.some((existing) => existing.id === importedId)) resultPlanner.todos.push({ ...item, id: importedId });
  }
  for (const item of data.events) {
    const importedId = `timmy-os:${item.id}`;
    if (!resultPlanner.events.some((existing) => existing.id === importedId)) resultPlanner.events.push({ ...item, id: importedId, color: '#e56b6f' });
  }
  for (const habit of data.habits) {
    const importedId = `timmy-os:${habit.id}`;
    if (!resultShadow.habitDefinitions.some((existing) => existing.id === importedId)) {
      resultShadow.habitDefinitions.push({ id: importedId, name: habit.name, icon: '✨' });
    }
    for (const day of habit.checkins) {
      if (resultShadow.habitsByDate[day]?.[importedId] === undefined) {
        resultShadow.habitsByDate[day] = { ...resultShadow.habitsByDate[day], [importedId]: true };
      }
    }
  }
  return { planner: resultPlanner, shadow: resultShadow };
}
