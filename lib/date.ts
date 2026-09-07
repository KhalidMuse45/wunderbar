import type { Session } from './model';
export function dateLabel(instant: string, timezone = 'America/Chicago', long = false) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    month: long ? 'long' : 'short',
    day: 'numeric',
    ...(long ? { weekday: 'long' as const } : {}),
  }).format(new Date(instant));
}
export function timeLabel(instant: string, timezone = 'America/Chicago') {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(instant));
}
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function monday(date = new Date()) {
  const value = new Date(date);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return localDay(value);
}
export function wallTimeToUtc(date: string, time: string, timezone: string): string {
  const expected = `${date}T${time}:00`;
  const desired = Date.parse(`${expected}Z`);
  if (!Number.isFinite(desired)) throw new Error('Choose a valid date and time.');
  const wall = (instant: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(instant);
    const part = (type: string) => parts.find((p) => p.type === type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
  };
  let candidate = desired;
  for (let pass = 0; pass < 4; pass++) candidate += desired - Date.parse(`${wall(candidate)}Z`);
  if (wall(candidate) !== expected)
    throw new Error(
      'That local time does not exist because the clocks change. Choose another time.',
    );
  // Repeated local hours require an unambiguous selection. Reject rather than guess.
  if (
    [-7200000, -3600000, -1800000, 1800000, 3600000, 7200000].some(
      (offset) => wall(candidate + offset) === expected,
    )
  )
    throw new Error('That time occurs twice because the clocks change. Choose a different time.');
  return new Date(candidate).toISOString();
}
export function calendarFile(session: Session) {
  const stamp = (date: Date) =>
    date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  const escape = (text: string) =>
    text.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wunderbar//Practice//EN',
    'BEGIN:VEVENT',
    `UID:${session.id}@wunderbar.local`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(new Date(session.startsAt))}`,
    `DTEND:${stamp(new Date(Date.parse(session.startsAt) + 3600000))}`,
    `SUMMARY:${escape(`Wunderbar practice with ${session.partner}`)}`,
    `DESCRIPTION:${escape(`A peer behavioral interview focused on ${session.focus.toLowerCase()}. Take turns and leave each other one specific next step.`)}`,
    `LOCATION:${escape(session.link || 'Add your Meet or Zoom link in Wunderbar')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
export function download(content: string, name: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase() || 'Y'
  );
}
