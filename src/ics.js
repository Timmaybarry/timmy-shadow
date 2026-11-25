const escapeText = (text) => String(text).replace(/\\/g, '\\\\').replace(/[;,]/g, '\\$&').replace(/\r?\n/g, '\\n');
const compact = (date) => date.replaceAll('-', '');
const clock = (time) => `${time.replace(':', '')}00`;
const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

function nextDay(date) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

const allDay = (date) => [`DTSTART;VALUE=DATE:${compact(date)}`, `DTEND;VALUE=DATE:${compact(nextDay(date))}`];

// Floating local times, so Google Calendar shows them at the same clock time wherever they are imported.
export function toIcs(planner, stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z') {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Timmy Life Journal//EN'];
  for (const event of planner.events || []) {
    if (!validDate(event.date)) continue;
    lines.push('BEGIN:VEVENT', `UID:${event.id}@timmy-shadow`, `DTSTAMP:${stamp}`, `SUMMARY:${escapeText(event.title)}`);
    if (event.start) {
      lines.push(`DTSTART:${compact(event.date)}T${clock(event.start)}`);
      if (event.end && event.end > event.start) lines.push(`DTEND:${compact(event.date)}T${clock(event.end)}`);
    } else {
      lines.push(...allDay(event.date));
    }
    lines.push('END:VEVENT');
  }
  for (const task of planner.todos || []) {
    if (!validDate(task.date)) continue;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${task.id}@timmy-shadow`,
      `DTSTAMP:${stamp}`,
      `SUMMARY:${escapeText(`${task.done ? '☑' : '☐'} ${task.text}`)}`,
      ...allDay(task.date),
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
