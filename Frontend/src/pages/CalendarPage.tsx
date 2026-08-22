import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  LayoutGrid,
  List,
  MapPin,
  Plane,
  Moon,
} from 'lucide-react';
import { getTripCalendar, listTrips } from '@/services/trip';
import { GlassCard } from '@/components/GlassCard';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { formatDateWithWeekday, formatMoney, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CalendarDay, CalendarEvent } from '@/types';

type Mode = 'month' | 'agenda';

const EVENT_STYLES: Record<CalendarEvent['kind'], { dot: string; icon: typeof Plane }> = {
  travel: { dot: 'bg-primary', icon: Plane },
  stay: { dot: 'bg-chart-4', icon: Moon },
  activity: { dot: 'bg-accent', icon: MapPin },
};

/**
 * Notion-Calendar-inspired: a month grid and an agenda list, minimal dividers,
 * expandable days. When no trip is in the URL the user picks one first.
 */
export function CalendarPage() {
  const { tripId: routeTripId } = useParams();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('agenda');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);

  const tripsQuery = useQuery({
    queryKey: ['trips', { filter: 'all', limit: 50 }],
    queryFn: () => listTrips({ filter: 'all', limit: 50 }),
    enabled: !routeTripId,
  });

  // Default to the first trip when the route has none.
  const tripId = routeTripId ?? tripsQuery.data?.items[0]?.id;

  const calendar = useQuery({
    queryKey: ['calendar', tripId],
    queryFn: () => getTripCalendar(tripId!),
    enabled: !!tripId,
  });

  const days = useMemo(() => calendar.data?.days ?? [], [calendar.data]);

  const monthGrid = useMemo(() => {
    if (days.length === 0) return null;

    const first = new Date(`${days[0].date}T00:00:00Z`);
    const anchor = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + monthOffset, 1),
    );

    const year = anchor.getUTCFullYear();
    const month = anchor.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    // Monday-first, matching most of the world's calendars.
    const startWeekday = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;

    const byDate = new Map(days.map((d) => [d.date, d]));
    const cells: ({ date: string; day: CalendarDay | undefined } | null)[] = [];

    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ date, day: byDate.get(date) });
    }

    return {
      label: anchor.toLocaleString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      cells,
    };
  }, [days, monthOffset]);

  const selectedDay = days.find((d) => d.date === selectedDate) ?? null;

  if (!routeTripId && tripsQuery.isLoading) return <LoadingSkeleton count={4} />;

  if (!tripId) {
    return (
      <EmptyState
        title="No trips to show"
        message="Create a trip and its calendar will appear here."
        action={
          <Button onClick={() => navigate('/trips/new')} className="rounded-2xl">
            Create a trip
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Calendar</h1>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {calendar.data?.tripName ?? 'Loading…'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ModeButton active={mode === 'agenda'} onClick={() => setMode('agenda')} icon={List}>
            Agenda
          </ModeButton>
          <ModeButton active={mode === 'month'} onClick={() => setMode('month')} icon={LayoutGrid}>
            Month
          </ModeButton>
        </div>
      </header>

      {/* Trip switcher when browsing globally */}
      {!routeTripId && (tripsQuery.data?.items.length ?? 0) > 1 && (
        <div className="snap-x-rail -mx-4 px-4 md:mx-0 md:px-0">
          {tripsQuery.data?.items.map((trip) => (
            <button
              key={trip.id}
              onClick={() => navigate(`/trips/${trip.id}/calendar`)}
              className={cn(
                'whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors',
                trip.id === tripId
                  ? 'bg-primary text-primary-foreground'
                  : 'glass text-muted-foreground hover:text-foreground',
              )}
            >
              {trip.name}
            </button>
          ))}
        </div>
      )}

      {calendar.isLoading ? (
        <LoadingSkeleton count={5} />
      ) : calendar.isError ? (
        <ErrorState title="Could not load the calendar" onRetry={() => void calendar.refetch()} />
      ) : days.length === 0 ? (
        <EmptyState title="Nothing scheduled" message="Add stops and activities to fill it in." />
      ) : mode === 'month' ? (
        <GlassCard className="rounded-3xl p-4 md:p-5">
          {/* Month header */}
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => setMonthOffset((o) => o - 1)}
              className="touch-target flex items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <p className="text-base font-semibold">{monthGrid?.label}</p>
            <button
              onClick={() => setMonthOffset((o) => o + 1)}
              className="touch-target flex items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Next month"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Weekday header */}
          <div className="mb-1 grid grid-cols-7 gap-1 text-center">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
              <span key={label} className="text-[11px] font-medium text-muted-foreground">
                {label}
              </span>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {monthGrid?.cells.map((cell, index) =>
              cell === null ? (
                <span key={`pad-${index}`} />
              ) : (
                <button
                  key={cell.date}
                  onClick={() => cell.day && setSelectedDate(cell.date)}
                  disabled={!cell.day}
                  className={cn(
                    'flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-sm transition-colors',
                    cell.day
                      ? 'font-medium hover:bg-muted'
                      : 'text-muted-foreground/40 cursor-default',
                    selectedDate === cell.date && 'bg-primary text-primary-foreground',
                  )}
                >
                  <span className="tabular-nums">{Number(cell.date.slice(-2))}</span>
                  {cell.day && cell.day.eventCount > 0 && (
                    <span className="flex gap-0.5">
                      {[...new Set(cell.day.events.map((e) => e.kind))].slice(0, 3).map((kind) => (
                        <span
                          key={kind}
                          className={cn('h-1 w-1 rounded-full', EVENT_STYLES[kind].dot)}
                        />
                      ))}
                    </span>
                  )}
                </button>
              ),
            )}
          </div>

          {/* Selected day detail */}
          <AnimatePresence>
            {selectedDay && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-4 border-t border-border pt-4">
                  <DayEvents day={selectedDay} currency={calendar.data?.currency ?? 'USD'} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {days.map((day) => (
            <AgendaDay
              key={day.date}
              day={day}
              currency={calendar.data?.currency ?? 'USD'}
              expanded={selectedDate === day.date}
              onToggle={() => setSelectedDate(selectedDate === day.date ? null : day.date)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AgendaDay({
  day,
  currency,
  expanded,
  onToggle,
}: {
  day: CalendarDay;
  currency: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isEmpty = day.eventCount === 0;

  return (
    <GlassCard className={cn('overflow-hidden rounded-2xl', isEmpty && 'opacity-60')}>
      <button
        onClick={onToggle}
        disabled={isEmpty}
        className="flex w-full items-center gap-4 p-4 text-left"
        aria-expanded={expanded}
      >
        <div className="w-12 shrink-0 text-center">
          <p className="text-[11px] font-medium uppercase text-muted-foreground">
            {day.weekday.slice(0, 3)}
          </p>
          <p className="text-xl font-semibold tabular-nums">{Number(day.date.slice(-2))}</p>
        </div>

        <div className="min-w-0 flex-1">
          {isEmpty ? (
            <p className="text-sm text-muted-foreground">Free day</p>
          ) : (
            <>
              <p className="truncate text-sm font-medium">
                {day.events[0].title}
                {day.eventCount > 1 && (
                  <span className="text-muted-foreground"> +{day.eventCount - 1} more</span>
                )}
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{day.eventCount} events</span>
                {day.totalCost > 0 && <span>{formatMoney(day.totalCost, currency)}</span>}
              </p>
            </>
          )}
        </div>

        {!isEmpty && (
          <ChevronRight
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              expanded && 'rotate-90',
            )}
          />
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && !isEmpty && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border p-4">
              <DayEvents day={day} currency={currency} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

function DayEvents({ day, currency }: { day: CalendarDay; currency: string }) {
  return (
    <>
      <p className="mb-3 flex items-center gap-2 text-sm font-medium">
        <CalendarDays className="h-4 w-4 text-primary" />
        {formatDateWithWeekday(day.date)}
      </p>

      <ul className="space-y-2">
        {day.events.map((event) => {
          const style = EVENT_STYLES[event.kind];
          const Icon = style.icon;
          return (
            <li key={event.id} className="flex items-start gap-3">
              <span
                className={cn(
                  'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white',
                  style.dot,
                )}
              >
                <Icon className="h-4 w-4" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{event.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {event.allDay
                    ? 'All day'
                    : `${formatTime(event.startTime) ?? ''}${
                        event.endTime ? ` – ${formatTime(event.endTime)}` : ''
                      }`}
                  {event.city && ` · ${event.city}`}
                </span>
              </span>

              {event.cost > 0 && (
                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {formatMoney(event.cost, currency)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof List;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'glass text-muted-foreground hover:text-foreground',
      )}
      aria-pressed={active}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
