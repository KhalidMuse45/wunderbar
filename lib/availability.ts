import type { Member } from './model';
import { localDay, monday, wallTimeToUtc } from './date';

export function localSlot(instant: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  const part = (key: string) => parts.find((p) => p.type === key)?.value;
  return `${part('weekday')}-${part('hour')}:${part('minute')}`;
}

// Suggestions help the administrator choose; the database still validates and
// locks both profiles when creating the match, including booking conflicts.
export function sharedStarts(host: Member, guest: Member, now = new Date(), days = 14) {
  const starts: string[] = [];
  const first = new Date(`${localDay(now, host.timezone)}T12:00:00Z`);
  for (let offset = 0; offset < days; offset++) {
    const date = new Date(first);
    date.setUTCDate(date.getUTCDate() + offset);
    const day = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' }).format(
      date,
    );
    for (const slot of host.availability.filter((slot) => slot.startsWith(`${day}-`))) {
      try {
        const instant = wallTimeToUtc(
          date.toISOString().slice(0, 10),
          slot.slice(4),
          host.timezone,
        );
        if (
          Date.parse(instant) <= now.getTime() ||
          !guest.availability.includes(localSlot(instant, guest.timezone))
        )
          continue;
        const guestDate = localDay(new Date(instant), guest.timezone);
        // This also rejects a repeated DST hour in the guest's timezone.
        if (
          wallTimeToUtc(guestDate, localSlot(instant, guest.timezone).slice(4), guest.timezone) !==
          instant
        )
          continue;
        if (
          host.skipWeeks.includes(monday(new Date(instant), host.timezone)) ||
          guest.skipWeeks.includes(monday(new Date(instant), guest.timezone))
        )
          continue;
        starts.push(instant);
      } catch {
        /* Skip nonexistent or ambiguous local start times. */
      }
    }
  }
  return [...new Set(starts)].sort();
}
