import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, Reorder, motion, useDragControls } from 'framer-motion';
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  GripVertical,
  MapPin,
  Moon,
  Plus,
  Sun,
  Sunrise,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { getTrip } from '@/services/trip';
import { deleteStop, removeStopActivity, reorderStops } from '@/services/stop';
import { GlassCard } from '@/components/GlassCard';
import { BottomSheet } from '@/components/BottomSheet';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { AddStopSheet } from '@/features/itinerary/AddStopSheet';
import { AddActivitySheet } from '@/features/itinerary/AddActivitySheet';
import { RoutePreview } from '@/features/itinerary/RoutePreview';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  fallbackImage,
  formatDateRange,
  formatDateShort,
  formatDuration,
  formatMoney,
  formatTime,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Stop, StopActivity } from '@/types';

/**
 * The itinerary builder — the core screen.
 *
 * Stops are reordered by dragging. The backend requires the COMPLETE ordered
 * id list for a trip (a partial list is rejected), so the local order is sent
 * in full on drop, and rolled back if the request fails.
 */

type TimeBlock = 'morning' | 'afternoon' | 'evening';

const BLOCKS: { id: TimeBlock; label: string; icon: typeof Sun; from: number; to: number }[] = [
  { id: 'morning', label: 'Morning', icon: Sunrise, from: 0, to: 12 * 60 },
  { id: 'afternoon', label: 'Afternoon', icon: Sun, from: 12 * 60, to: 17 * 60 },
  { id: 'evening', label: 'Evening', icon: Moon, from: 17 * 60, to: 24 * 60 },
];

function minutesOf(time: string | null): number | null {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m;
}

/** Unscheduled activities fall into Morning so nothing is ever invisible. */
function blockFor(activity: StopActivity): TimeBlock {
  const minutes = minutesOf(activity.startTime);
  if (minutes === null) return 'morning';
  const block = BLOCKS.find((b) => minutes >= b.from && minutes < b.to);
  return block?.id ?? 'morning';
}

export function ItineraryPage() {
  const { tripId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [order, setOrder] = useState<Stop[]>([]);
  const [addStopOpen, setAddStopOpen] = useState(false);
  const [activityTarget, setActivityTarget] = useState<Stop | null>(null);
  const [pendingStopDelete, setPendingStopDelete] = useState<Stop | null>(null);

  const { data: trip, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => getTrip(tripId),
    enabled: !!tripId,
  });

  // Mirror server order into local state so dragging feels instant.
  useEffect(() => {
    if (trip?.stops) setOrder(trip.stops);
  }, [trip?.stops]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
    void queryClient.invalidateQueries({ queryKey: ['budget', tripId] });
    void queryClient.invalidateQueries({ queryKey: ['itinerary', tripId] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const reorder = useMutation({
    mutationFn: (stopIds: string[]) => reorderStops({ tripId, stopIds }),
    onSuccess: () => {
      invalidate();
      toast('Itinerary reordered', 'success');
    },
    onError: (err: Error) => {
      // Snap back to the server's truth rather than leaving a lie on screen.
      if (trip?.stops) setOrder(trip.stops);
      toast(err.message, 'error');
    },
  });

  const removeStop = useMutation({
    mutationFn: (id: string) => deleteStop(id),
    onSuccess: () => {
      invalidate();
      setPendingStopDelete(null);
      toast('Stop removed', 'success');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const removeActivity = useMutation({
    mutationFn: ({ stopId, activityId }: { stopId: string; activityId: string }) =>
      removeStopActivity(stopId, activityId),
    onSuccess: () => {
      invalidate();
      toast('Activity removed', 'success');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const totals = useMemo(() => {
    const activities = order.reduce((n, s) => n + s.activities.length, 0);
    const cost = order.reduce(
      (sum, s) =>
        sum +
        s.accommodationCost +
        s.transportCost +
        s.activities.reduce((a, act) => a + act.cost, 0),
      0,
    );
    return { activities, cost };
  }, [order]);

  if (isLoading) return <LoadingSkeleton count={5} />;

  if (isError || !trip) {
    return (
      <ErrorState
        title="We couldn't load this trip"
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => void refetch()}
      />
    );
  }

  const handleReorderEnd = () => {
    const ids = order.map((s) => s.id);
    const original = trip.stops.map((s) => s.id);
    if (ids.length === original.length && ids.every((id, i) => id === original[i])) return;
    reorder.mutate(ids);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-3">
        <button
          onClick={() => navigate(`/trips/${tripId}`)}
          className="-ml-2 flex items-center gap-1 rounded-xl px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to trip
        </button>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">
              {trip.name}
            </h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                {formatDateRange(trip.startDate, trip.endDate)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {order.length} {order.length === 1 ? 'stop' : 'stops'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Wallet className="h-4 w-4" />
                {formatMoney(totals.cost, trip.currency)}
              </span>
            </p>
          </div>

          {trip.canEdit && (
            <Button onClick={() => setAddStopOpen(true)} className="rounded-2xl">
              <Plus className="mr-1.5 h-4 w-4" />
              Add stop
            </Button>
          )}
        </div>
      </header>

      {/* Route preview */}
      {order.length > 0 && <RoutePreview stops={order} />}

      {/* Stops */}
      {order.length === 0 ? (
        <EmptyState
          title="No stops yet"
          message="Add your first city to start building the itinerary."
          action={
            trip.canEdit ? (
              <Button onClick={() => setAddStopOpen(true)} className="rounded-2xl">
                <Plus className="mr-1.5 h-4 w-4" />
                Add your first stop
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Reorder.Group
          axis="y"
          values={order}
          onReorder={setOrder}
          className="space-y-4"
          as="ol"
        >
          {order.map((stop, index) => (
            <StopRow
              key={stop.id}
              stop={stop}
              index={index}
              currency={trip.currency}
              canEdit={trip.canEdit}
              onDragEnd={handleReorderEnd}
              onAddActivity={() => setActivityTarget(stop)}
              onDeleteStop={() => setPendingStopDelete(stop)}
              onRemoveActivity={(activityId) =>
                removeActivity.mutate({ stopId: stop.id, activityId })
              }
            />
          ))}
        </Reorder.Group>
      )}

      {reorder.isPending && (
        <p className="text-center text-sm text-muted-foreground">Saving new order…</p>
      )}

      {/* Sheets */}
      <AddStopSheet
        open={addStopOpen}
        onClose={() => setAddStopOpen(false)}
        trip={trip}
        onCreated={invalidate}
      />

      <AddActivitySheet
        open={!!activityTarget}
        onClose={() => setActivityTarget(null)}
        stop={activityTarget}
        currency={trip.currency}
        onAdded={invalidate}
      />

      <BottomSheet
        open={!!pendingStopDelete}
        onClose={() => setPendingStopDelete(null)}
        title="Remove this stop?"
      >
        <div className="space-y-4 pb-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {pendingStopDelete?.city.name}
            </span>{' '}
            and its {pendingStopDelete?.activities.length ?? 0} scheduled{' '}
            {pendingStopDelete?.activities.length === 1 ? 'activity' : 'activities'} will be
            removed from the itinerary.
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 rounded-2xl"
              onClick={() => setPendingStopDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1 rounded-2xl"
              disabled={removeStop.isPending}
              onClick={() => pendingStopDelete && removeStop.mutate(pendingStopDelete.id)}
            >
              {removeStop.isPending ? 'Removing…' : 'Remove stop'}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

function StopRow({
  stop,
  index,
  currency,
  canEdit,
  onDragEnd,
  onAddActivity,
  onDeleteStop,
  onRemoveActivity,
}: {
  stop: Stop;
  index: number;
  currency: string;
  canEdit: boolean;
  onDragEnd: () => void;
  onAddActivity: () => void;
  onDeleteStop: () => void;
  onRemoveActivity: (activityId: string) => void;
}) {
  const controls = useDragControls();
  const [expanded, setExpanded] = useState(true);

  const grouped = useMemo(() => {
    const map: Record<TimeBlock, StopActivity[]> = { morning: [], afternoon: [], evening: [] };
    for (const activity of stop.activities) map[blockFor(activity)].push(activity);
    for (const key of Object.keys(map) as TimeBlock[]) {
      map[key].sort((a, b) => (minutesOf(a.startTime) ?? 1e9) - (minutesOf(b.startTime) ?? 1e9));
    }
    return map;
  }, [stop.activities]);

  return (
    <Reorder.Item
      value={stop}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      as="li"
      whileDrag={{ scale: 1.02, zIndex: 20 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className="list-none"
    >
      <GlassCard className="overflow-hidden rounded-3xl">
        {/* Stop header */}
        <div className="relative h-32 md:h-40">
          <img
            src={stop.city.imageUrl ?? fallbackImage(stop.city.name)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          <div className="hero-scrim absolute inset-0" />

          {canEdit && (
            <button
              onPointerDown={(e) => controls.start(e)}
              className="absolute left-3 top-3 cursor-grab touch-none rounded-xl bg-black/40 p-2 text-white backdrop-blur-md active:cursor-grabbing"
              aria-label={`Reorder ${stop.city.name}`}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}

          {canEdit && (
            <button
              onClick={onDeleteStop}
              className="absolute right-3 top-3 rounded-xl bg-black/40 p-2 text-white backdrop-blur-md transition-colors hover:bg-destructive"
              aria-label={`Remove ${stop.city.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}

          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
            <div className="min-w-0">
              <span className="mb-1 inline-flex items-center rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md">
                Stop {index + 1}
              </span>
              <h3 className="truncate text-lg font-semibold text-white">
                {stop.city.name}
                <span className="ml-1.5 text-sm font-normal text-white/80">
                  {stop.city.country}
                </span>
              </h3>
            </div>
            <p className="shrink-0 text-right text-xs text-white/85">
              {formatDateShort(stop.arrivalDate)} – {formatDateShort(stop.departureDate)}
              <br />
              {stop.nights} {stop.nights === 1 ? 'night' : 'nights'}
            </p>
          </div>
        </div>

        {/* Costs */}
        <div className="grid grid-cols-3 divide-x divide-border border-b border-border text-center">
          <CostCell label="Transport" value={formatMoney(stop.transportCost, currency)} />
          <CostCell label="Stay" value={formatMoney(stop.accommodationCost, currency)} />
          <CostCell label="Meals / day" value={formatMoney(stop.mealsPerDayCost, currency)} />
        </div>

        {/* Activities */}
        <div className="p-4">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mb-3 flex w-full items-center justify-between text-sm font-medium"
            aria-expanded={expanded}
          >
            <span>
              {stop.activities.length}{' '}
              {stop.activities.length === 1 ? 'activity' : 'activities'}
            </span>
            <span className="text-xs text-muted-foreground">{expanded ? 'Hide' : 'Show'}</span>
          </button>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="space-y-4">
                  {BLOCKS.map((block) => {
                    const items = grouped[block.id];
                    if (items.length === 0) return null;
                    return (
                      <div key={block.id}>
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <block.icon className="h-3.5 w-3.5" />
                          {block.label}
                        </p>
                        <ul className="space-y-2">
                          {items.map((activity) => (
                            <li
                              key={activity.id}
                              className="group flex items-start gap-3 rounded-2xl border border-border p-3"
                            >
                              <img
                                src={activity.imageUrl ?? fallbackImage(activity.name, 120, 120)}
                                alt=""
                                className="h-12 w-12 shrink-0 rounded-xl object-cover"
                                loading="lazy"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{activity.name}</p>
                                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                                  {activity.startTime && (
                                    <span className="inline-flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {formatTime(activity.startTime)}
                                    </span>
                                  )}
                                  <span>{formatDuration(activity.durationMinutes)}</span>
                                  <span className="font-medium text-foreground">
                                    {formatMoney(activity.cost, currency)}
                                  </span>
                                </p>
                              </div>
                              {canEdit && (
                                <button
                                  onClick={() => onRemoveActivity(activity.activityId)}
                                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                                  aria-label={`Remove ${activity.name}`}
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}

                  {stop.activities.length === 0 && (
                    <p className="rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
                      Nothing planned here yet.
                    </p>
                  )}

                  {stop.notes && (
                    <p className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                      {stop.notes}
                    </p>
                  )}

                  {canEdit && (
                    <Button
                      variant="outline"
                      onClick={onAddActivity}
                      className="w-full rounded-2xl"
                    >
                      <Plus className="mr-1.5 h-4 w-4" />
                      Add activity in {stop.city.name}
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </GlassCard>
    </Reorder.Item>
  );
}

function CostCell({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn('px-2 py-3')}>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
