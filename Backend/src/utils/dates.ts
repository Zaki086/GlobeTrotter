/**
 * Trip planning is date-based, not instant-based: a stop on "2026-04-02"
 * means that calendar day everywhere. All helpers here work in UTC and treat
 * a date as midnight UTC so day arithmetic never drifts across timezones.
 */

export const MS_PER_DAY = 86_400_000;

/** Parses "YYYY-MM-DD" (or a Date) into midnight UTC. */
export function toUtcDate(value: Date | string): Date {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

/** Formats a Date as "YYYY-MM-DD". */
export function toDateString(value: Date | string): string {
  return toUtcDate(value).toISOString().slice(0, 10);
}

export function addDays(value: Date | string, days: number): Date {
  return new Date(toUtcDate(value).getTime() + days * MS_PER_DAY);
}

/** Whole days between two dates (end - start). */
export function diffInDays(start: Date | string, end: Date | string): number {
  return Math.round((toUtcDate(end).getTime() - toUtcDate(start).getTime()) / MS_PER_DAY);
}

/**
 * Inclusive day count — a trip from the 1st to the 3rd lasts 3 days.
 * Used for per-day budget averages and itinerary day numbering.
 */
export function inclusiveDayCount(start: Date | string, end: Date | string): number {
  return Math.max(1, diffInDays(start, end) + 1);
}

/** Every calendar date from start to end inclusive, as "YYYY-MM-DD". */
export function enumerateDates(start: Date | string, end: Date | string): string[] {
  const total = inclusiveDayCount(start, end);
  const first = toUtcDate(start);
  return Array.from({ length: total }, (_, i) => toDateString(addDays(first, i)));
}

/** Days from today until `date`; negative once the date has passed. */
export function daysUntil(date: Date | string): number {
  return diffInDays(new Date(), date);
}

export function isWithinRange(date: Date | string, start: Date | string, end: Date | string): boolean {
  const t = toUtcDate(date).getTime();
  return t >= toUtcDate(start).getTime() && t <= toUtcDate(end).getTime();
}

/** True when [aStart,aEnd] and [bStart,bEnd] share at least one day. */
export function rangesOverlap(
  aStart: Date | string,
  aEnd: Date | string,
  bStart: Date | string,
  bEnd: Date | string,
): boolean {
  return (
    toUtcDate(aStart).getTime() <= toUtcDate(bEnd).getTime() &&
    toUtcDate(bStart).getTime() <= toUtcDate(aEnd).getTime()
  );
}

/** "HH:MM" -> minutes since midnight; null for malformed input. */
export function timeToMinutes(time?: string | null): number | null {
  if (!time) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesToTime(minutes: number): string {
  const clamped = ((minutes % 1440) + 1440) % 1440;
  const h = String(Math.floor(clamped / 60)).padStart(2, '0');
  const m = String(clamped % 60).padStart(2, '0');
  return `${h}:${m}`;
}
