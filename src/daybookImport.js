const QUESTIONS = ['What stood out today?', 'What did that moment bring up for you?', 'What do you want to carry into tomorrow?'];
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const date = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};

export function importDaybook(data, shadow) {
  if (!object(data) || !object(data.entries)) throw new Error('This is not a Daybook 2027 JSON backup.');
  const entries = Object.entries(data.entries);
  if (entries.some(([day, entry]) => !date(day) || !object(entry) || !Array.isArray(entry.answers) || entry.answers.some((answer) => typeof answer !== 'string'))) {
    throw new Error('The Daybook backup contains invalid records; nothing was imported.');
  }

  const result = {
    ...shadow,
    entries: { ...shadow.entries },
    daybookImports: { ...shadow.daybookImports },
  };
  let imported = 0;
  for (const [day, entry] of entries) {
    const sections = entry.answers.slice(0, QUESTIONS.length)
      .map((answer, index) => answer.trim() && `${QUESTIONS[index]}\n${answer.trim()}`)
      .filter(Boolean);
    if (!sections.length) continue;
    const text = sections.join('\n\n');
    if (result.daybookImports[day]?.includes(text)) continue;
    const existing = result.entries[day] || {};
    const previous = existing.journal || '';
    const block = `--- Imported from Daybook 2027 ---\n${text}`;
    result.entries[day] = { ...existing, journal: previous ? `${previous}\n\n${block}` : block };
    result.daybookImports[day] = [...(result.daybookImports[day] || []), text];
    imported += 1;
  }
  return { shadow: result, imported };
}
