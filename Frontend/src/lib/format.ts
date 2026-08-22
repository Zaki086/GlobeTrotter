import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';

/**
 * Formatting helpers shared by every screen, so currency and dates never
 * render inconsistently between, say, a trip card and the budget screen.
 */

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string, compact: boolean): Intl.NumberFormat {
  const key = `${currency}:${compact}`;
  let formatter = currencyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 0,
    });
    currencyFormatters.set(key, formatter);
  }
  return formatter;
}

/** `formatMoney(8220, 'USD')` → "$8,220". Falls back gracefully on a bad code. */
export function formatMoney(amount: number, currency = 'USD', compact = false): string {
  try {
    return formatterFor(currency, compact).format(amount ?? 0);
  } catch {
    return `${currency} ${Math.round(amount ?? 0).toLocaleString()}`;
  }
}

/** Two-decimal variant for expense rows where precision matters. */
export function formatMoneyPrecise(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount ?? 0);
  } catch {
    return `${currency} ${(amount ?? 0).toFixed(2)}`;
  }
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === 'string' ? parseISO(value) : value;
  return isValid(date) ? date : null;
}

/** "6 Oct 2026" */
export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? format(date, 'd MMM yyyy') : '—';
}

/** "6 Oct" — for tight card layouts. */
export function formatDateShort(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? format(date, 'd MMM') : '—';
}

/** "Mon 6 Oct" */
export function formatDateWithWeekday(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? format(date, 'EEE d MMM') : '—';
}

/**
 * "6 – 19 Oct 2026", collapsing the repeated month and year where possible so
 * date ranges stay readable at 390px.
 */
export function formatDateRange(start: string | Date, end: string | Date): string {
  const from = toDate(start);
  const to = toDate(end);
  if (!from || !to) return '—';

  const sameYear = from.getFullYear() === to.getFullYear();
  const sameMonth = sameYear && from.getMonth() === to.getMonth();

  if (sameMonth) return `${format(from, 'd')} – ${format(to, 'd MMM yyyy')}`;
  if (sameYear) return `${format(from, 'd MMM')} – ${format(to, 'd MMM yyyy')}`;
  return `${format(from, 'd MMM yyyy')} – ${format(to, 'd MMM yyyy')}`;
}

/** "in 45 days" / "3 days ago" */
export function formatRelative(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  const distance = formatDistanceToNowStrict(date);
  return date.getTime() > Date.now() ? `in ${distance}` : `${distance} ago`;
}

/** Turns a countdown into human copy for the dashboard hero. */
export function formatCountdown(days: number): string {
  if (days < 0) return 'Completed';
  if (days === 0) return 'Starts today';
  if (days === 1) return 'Starts tomorrow';
  if (days < 7) return `${days} days to go`;
  if (days < 30) return `${Math.round(days / 7)} weeks to go`;
  return `${Math.round(days / 30)} months to go`;
}

/** 150 → "2h 30m" */
export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins}m`;
  if (!mins) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/** "09:30" → "9:30 AM" for display, leaving the stored 24h value untouched. */
export function formatTime(time: string | null | undefined): string | null {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Maps a 0-100 cost index onto a coarse, human label.
 *
 * The symbol follows the catalog's currency — the destinations are Indian, so
 * a rupee sign reads far more naturally than a dollar one. An undefined index
 * yields "Unrated" rather than silently falling into the top band.
 */
export function costLevel(
  costIndex: number | null | undefined,
  symbol = '₹',
): { label: string; symbols: string } {
  if (costIndex === null || costIndex === undefined || Number.isNaN(costIndex)) {
    return { label: 'Unrated', symbols: '—' };
  }
  if (costIndex < 30) return { label: 'Budget', symbols: symbol };
  if (costIndex < 55) return { label: 'Moderate', symbols: symbol.repeat(2) };
  if (costIndex < 78) return { label: 'Premium', symbols: symbol.repeat(3) };
  return { label: 'Luxury', symbols: symbol.repeat(4) };
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Deterministic placeholder so a trip without a cover still looks intentional. */
export function fallbackImage(seed: string, width = 800, height = 600): string {
  const slug = seed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'globetrotter';
  return `https://picsum.photos/seed/${slug}/${width}/${height}`;
}
