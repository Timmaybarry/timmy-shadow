export const PILLARS = ['Character', 'Health', 'Relationships', 'Work & skills', 'Calm & focus'];
export const LEVEL_NAMES = ['', 'Beginner', 'Basic', 'Competent', 'Strong', 'Expert'];
export const VISION_QUESTIONS = [
  ['IDENTITY', 'Five years from now, how would a friend describe you in one sentence?', 'Think character first: how you treat people, handle pressure, show up.'],
  ['DAILY LIFE', 'What does an ordinary Tuesday look like for that person?', "Wake-up time, work, relationships, movement, rest, what's on their phone."],
  ['VALUES', 'What three values does that person refuse to compromise on?', 'Where would you see those values in their choices?'],
  ['WORK', 'What do they do, and what are they known for being good at?', "Skills, impact, the kind of problems they're trusted with."],
  ['RELATIONSHIPS', 'Who is around them, and how do they show up for those people?', 'Who do you want to be closer to, and who do you need to distance yourself from?'],
  ['HEALTH', 'How do they treat their body, energy and mind?', 'Sleep, exercise, food, stress, stillness.'],
  ['GAP', 'What do you do today that that person would no longer do?', 'Be honest and kind. These become entries in Old habits.'],
  ['GAP', "What can that person do that you can't yet?", 'These become entries in Skills.'],
  ['FEARS', 'What is most likely to stop you, and what will you do when it shows up?', 'Name the excuse in advance so you recognise it.'],
  ['NEXT 90 DAYS', 'What is one visible thing you will have changed 90 days from now?', 'Small enough to measure, big enough to matter.'],
  ['LETTER', 'Write a short note from you in 5 years to you today.', 'What would they thank you for starting now?'],
];

export const emptyGrowth = { vision: {}, skills: [], oldHabits: [], checkins: [] };

const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v) => typeof v === 'string';
const isDate = (v) => {
  if (!text(v) || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const parsed = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === v;
};
const level = (v) => Number.isInteger(v) && v >= 1 && v <= 5;
const list = (v) => (Array.isArray(v) ? v : []);

export const growthOf = (planner) => ({ ...emptyGrowth, ...(object(planner?.growth) ? planner.growth : {}) });

export function daysBetween(a, b) {
  return Math.floor((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
}

export const skillGap = (skill) => Math.max(0, skill.target - skill.current);
export const skillMinutes = (skill) => list(skill.log).reduce((sum, entry) => sum + (entry.minutes || 0), 0);

export const slipStreak = (habit, asOf) => daysBetween(list(habit.slips)[0]?.date || habit.created, asOf);

export function bestSlipRun(habit, asOf) {
  const dates = [habit.created, ...list(habit.slips).map((slip) => slip.date).reverse(), asOf];
  let best = 0;
  for (let i = 1; i < dates.length; i += 1) best = Math.max(best, daysBetween(dates[i - 1], dates[i]));
  return best;
}

export function topTrigger(habit) {
  const counts = {};
  for (const slip of list(habit.slips)) {
    const trigger = (slip.trigger || '').trim().toLowerCase();
    if (trigger) counts[trigger] = (counts[trigger] || 0) + 1;
  }
  const [best] = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return best && best[1] > 1 ? { trigger: best[0], count: best[1] } : null;
}

export const checkinScore = (checkin) => {
  const values = Object.values(checkin.scores || {}).filter(level);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
};

export function journalStats(entries, asOf) {
  const days = new Set(Object.entries(entries || {}).filter(([day, entry]) => isDate(day) && entry?.journal?.trim()).map(([day]) => day));
  let streak = 0;
  let day = days.has(asOf) ? asOf : shift(asOf, -1);
  while (days.has(day)) { streak += 1; day = shift(day, -1); }
  const cutoff = shift(asOf, -29);
  return { streak, recent: [...days].filter((d) => d >= cutoff && d <= asOf).length };
}

function shift(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function progressSummary(growth, entries, asOf) {
  const average = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
  const skills = list(growth.skills);
  const checkins = list(growth.checkins);
  const runs = list(growth.oldHabits).map((habit) => slipStreak(habit, asOf));
  const latest = checkins[0];
  const previous = checkins[1];
  return {
    ...journalStats(entries, asOf),
    visionAnswered: Object.values(growth.vision || {}).filter((v) => text(v) && v.trim()).length,
    skillPercent: skills.length ? Math.round(average(skills.map((s) => Math.min(1, s.current / s.target))) * 100) : null,
    openGaps: skills.filter((s) => s.target > s.current).length,
    longestRun: runs.length ? Math.max(...runs) : null,
    latestScore: latest ? checkinScore(latest) : null,
    scoreChange: latest && previous ? checkinScore(latest) - checkinScore(previous) : null,
  };
}

// Validates a growth-2027.json export from Daybook 2027 (jibun-techo-2027) and converts it to stable-ID records.
export function importGrowth(data, growth) {
  if (!object(data) || !object(data.vision) || !Array.isArray(data.skills) || !Array.isArray(data.habits) || !Array.isArray(data.checkins)) {
    throw new Error('This is not a Daybook 2027 growth export.');
  }
  const validSkill = (s) => object(s) && text(s.name) && s.name.trim() && level(s.current) && level(s.target) && isDate(s.created) && Array.isArray(s.log)
    && s.log.every((l) => object(l) && isDate(l.date) && text(l.note) && Number.isFinite(l.minutes) && l.minutes >= 0 && level(l.level));
  const validHabit = (h) => object(h) && text(h.name) && h.name.trim() && text(h.replacement) && isDate(h.created) && Array.isArray(h.slips)
    && h.slips.every((s) => object(s) && isDate(s.date) && text(s.trigger) && text(s.plan));
  const validCheckin = (c) => object(c) && isDate(c.date) && object(c.scores) && PILLARS.every((p) => level(c.scores[p])) && text(c.win) && text(c.lesson) && text(c.focus);
  if (Object.entries(data.vision).some(([k, v]) => !/^\d+$/.test(k) || +k >= VISION_QUESTIONS.length || !text(v))
    || !data.skills.every(validSkill) || !data.habits.every(validHabit) || !data.checkins.every(validCheckin)) {
    throw new Error('The growth export contains invalid records; nothing was imported.');
  }
  const result = { ...growth, vision: { ...growth.vision }, skills: [...list(growth.skills)], oldHabits: [...list(growth.oldHabits)], checkins: [...list(growth.checkins)] };
  const counts = { vision: 0, skills: 0, oldHabits: 0, checkins: 0 };
  for (const [index, value] of Object.entries(data.vision)) {
    if (!value.trim() || (result.vision[index] || '').includes(value.trim())) continue;
    const previous = result.vision[index] || '';
    result.vision[index] = previous ? `${previous}\n\n--- Imported from Daybook 2027 ---\n${value}` : value;
    counts.vision += 1;
  }
  const idOf = (kind, record) => `daybook-growth:${kind}:${[record.created || record.date, record.name || record.focus || record.win || '', JSON.stringify(record.scores || '')].join('|')}`;
  const withIds = (kind, record, children) => ({ ...record, id: idOf(kind, record), ...(children ? { [children.key]: children.items.map((c, i) => ({ ...c, id: `${idOf(kind, record)}:${children.key}:${i}` })) } : {}) });
  for (const skill of data.skills) {
    const record = withIds('skill', skill, { key: 'log', items: skill.log });
    if (!result.skills.some((s) => s.id === record.id)) { result.skills.push(record); counts.skills += 1; }
  }
  for (const habit of data.habits) {
    const { slips, ...rest } = habit;
    const record = withIds('habit', rest, { key: 'slips', items: slips });
    if (!result.oldHabits.some((h) => h.id === record.id)) { result.oldHabits.push(record); counts.oldHabits += 1; }
  }
  for (const checkin of data.checkins) {
    const record = withIds('checkin', checkin);
    if (!result.checkins.some((c) => c.id === record.id)) { result.checkins.push(record); counts.checkins += 1; }
  }
  result.checkins.sort((a, b) => b.date.localeCompare(a.date));
  return { growth: result, counts };
}
