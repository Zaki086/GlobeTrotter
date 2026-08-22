import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Clock, Loader2, Search } from 'lucide-react';
import { searchActivities } from '@/services/activity';
import { addStopActivity } from '@/services/stop';
import { BottomSheet } from '@/components/BottomSheet';
import { SearchBar } from '@/components/SearchBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useToast } from '@/hooks/use-toast';
import { ACTIVITY_TYPE_LABELS } from '@/lib/constants';
import { fallbackImage, formatDuration, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Activity, ActivityType, Stop } from '@/types';

interface AddActivitySheetProps {
  open: boolean;
  onClose: () => void;
  stop: Stop | null;
  currency: string;
  onAdded: () => void;
}

const TYPES = Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[];

/**
 * Activity picker, scoped to the stop's city — the backend rejects an activity
 * that belongs to a different city, so filtering here prevents a confusing
 * server-side error.
 */
export function AddActivitySheet({
  open,
  onClose,
  stop,
  currency,
  onAdded,
}: AddActivitySheetProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<ActivityType | undefined>();
  const [selected, setSelected] = useState<Activity | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const debounced = useDebouncedValue(search, 300);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setType(undefined);
    setSelected(null);
    setScheduledDate(stop?.arrivalDate ?? '');
    setStartTime('');
  }, [open, stop?.arrivalDate]);

  const { data, isLoading } = useQuery({
    queryKey: ['activities', { cityId: stop?.city.id, search: debounced, type }],
    queryFn: () =>
      searchActivities({
        cityId: stop!.city.id,
        search: debounced || undefined,
        type,
        limit: 30,
      }),
    enabled: open && !!stop,
  });

  const alreadyAdded = useMemo(
    () => new Set(stop?.activities.map((a) => a.activityId) ?? []),
    [stop?.activities],
  );

  const dateError = useMemo(() => {
    if (!stop || !scheduledDate) return null;
    if (Date.parse(scheduledDate) < Date.parse(stop.arrivalDate))
      return 'That date is before you arrive.';
    if (Date.parse(scheduledDate) > Date.parse(stop.departureDate))
      return 'That date is after you leave.';
    return null;
  }, [scheduledDate, stop]);

  const mutation = useMutation({
    mutationFn: () =>
      addStopActivity(stop!.id, {
        activityId: selected!.id,
        scheduledDate: scheduledDate || undefined,
        startTime: startTime || undefined,
      }),
    onSuccess: () => {
      onAdded();
      toast(`${selected?.name} added`, 'success');
      onClose();
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  if (!stop) return null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={selected ? 'Schedule it' : `Things to do in ${stop.city.name}`}
    >
      {!selected ? (
        <div className="space-y-4 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <SearchBar
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activities…"
              aria-label="Search activities"
              className="pl-10"
            />
          </div>

          <div className="snap-x-rail">
            <button
              onClick={() => setType(undefined)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
                !type
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border text-muted-foreground',
              )}
            >
              All
            </button>
            {TYPES.map((value) => (
              <button
                key={value}
                onClick={() => setType(type === value ? undefined : value)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
                  type === value
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border text-muted-foreground',
                )}
              >
                {ACTIVITY_TYPE_LABELS[value]}
              </button>
            ))}
          </div>

          <div className="max-h-[45vh] space-y-2 overflow-y-auto">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
              ))
            ) : (data?.items.length ?? 0) === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nothing found in {stop.city.name}.
              </p>
            ) : (
              data?.items.map((activity) => {
                const added = alreadyAdded.has(activity.id);
                return (
                  <button
                    key={activity.id}
                    onClick={() => !added && setSelected(activity)}
                    disabled={added}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl border border-border p-3 text-left transition-colors',
                      added
                        ? 'cursor-not-allowed opacity-50'
                        : 'hover:border-primary/40 hover:bg-muted',
                    )}
                  >
                    <img
                      src={activity.imageUrl ?? fallbackImage(activity.name, 120, 120)}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-xl object-cover"
                      loading="lazy"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{activity.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {ACTIVITY_TYPE_LABELS[activity.type]} ·{' '}
                        {formatDuration(activity.durationMinutes)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {added ? 'Added' : formatMoney(activity.estimatedCost, currency)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4 pb-2">
          <button
            onClick={() => setSelected(null)}
            className="flex w-full items-center gap-3 rounded-2xl border border-border p-3 text-left"
          >
            <img
              src={selected.imageUrl ?? fallbackImage(selected.name, 120, 120)}
              alt=""
              className="h-12 w-12 rounded-xl object-cover"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{selected.name}</span>
              <span className="block text-xs text-muted-foreground">
                {formatMoney(selected.estimatedCost, currency)} ·{' '}
                {formatDuration(selected.durationMinutes)}
              </span>
            </span>
            <span className="text-xs font-medium text-primary">Change</span>
          </button>

          {selected.description && (
            <p className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              {selected.description}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="activity-date">Day</Label>
              <Input
                id="activity-date"
                type="date"
                min={stop.arrivalDate}
                max={stop.departureDate}
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="activity-time">
                <Clock className="mr-1 inline h-3.5 w-3.5" />
                Start time
              </Label>
              <Input
                id="activity-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="rounded-2xl"
              />
            </div>
          </div>

          {dateError && (
            <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
              {dateError}
            </p>
          )}

          <Button
            className="w-full rounded-2xl"
            size="lg"
            disabled={!!dateError || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding…
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Add to itinerary
              </>
            )}
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}
