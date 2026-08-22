import { motion } from 'framer-motion';
import { ArrowDown, Clock } from 'lucide-react';
import { formatDuration, formatMoney, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ItineraryActivityBlock } from '@/types';

interface DayExpenseTableProps {
  activities: ItineraryActivityBlock[];
  currency: string;
  travelers: number;
}

/**
 * Screen 9 — "Itinerary view with budget section".
 *
 * The wireframe puts the day's activities in a left column and their expense
 * in a right column, with arrows chaining one activity to the next. This is
 * that layout: a two-column flow rather than a plain list, so the cost of each
 * step sits directly beside it and the day total reconciles at the bottom.
 *
 * Costs are per person in the catalog, so they are multiplied by the party
 * size here — matching how the budget screen totals them.
 */
export function DayExpenseTable({ activities, currency, travelers }: DayExpenseTableProps) {
  if (activities.length === 0) {
    return (
      <p className="rounded-2xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
        A free day — nothing scheduled.
      </p>
    );
  }

  const total = activities.reduce((sum, a) => sum + a.cost * travelers, 0);

  return (
    <div className="space-y-3">
      {/* Column headers, as in the wireframe */}
      <div className="flex items-end justify-between px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Physical activity</span>
        <span>Expense</span>
      </div>

      <ol className="space-y-0">
        {activities.map((activity, index) => (
          <li key={activity.id}>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(index * 0.05, 0.3) }}
              className="flex items-stretch gap-3"
            >
              {/* Activity block */}
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border bg-card/60 p-3">
                {activity.imageUrl && (
                  <img
                    src={activity.imageUrl}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-xl object-cover"
                    loading="lazy"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{activity.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    {activity.startTime && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(activity.startTime)}
                        {activity.endTime && ` – ${formatTime(activity.endTime)}`}
                      </span>
                    )}
                    <span>{formatDuration(activity.durationMinutes)}</span>
                  </p>
                </div>
              </div>

              {/* Expense block */}
              <div
                className={cn(
                  'flex w-24 shrink-0 flex-col items-end justify-center rounded-2xl border border-border p-3 text-right',
                  activity.cost === 0 ? 'bg-muted/50' : 'bg-card/60',
                )}
              >
                <span className="text-sm font-semibold tabular-nums">
                  {activity.cost === 0 ? 'Free' : formatMoney(activity.cost * travelers, currency)}
                </span>
                {activity.cost > 0 && travelers > 1 && (
                  <span className="text-[10px] text-muted-foreground">
                    {formatMoney(activity.cost, currency)} pp
                  </span>
                )}
              </div>
            </motion.div>

            {/* Connector arrow between consecutive activities */}
            {index < activities.length - 1 && (
              <div className="flex justify-start py-1 pl-6" aria-hidden>
                <ArrowDown className="h-4 w-4 text-muted-foreground/50" />
              </div>
            )}
          </li>
        ))}
      </ol>

      {/* Day total */}
      <div className="flex items-center justify-between rounded-2xl bg-primary/10 px-4 py-3">
        <span className="text-sm font-medium text-primary">Day total</span>
        <span className="text-base font-semibold tabular-nums text-primary">
          {formatMoney(total, currency)}
        </span>
      </div>
    </div>
  );
}
