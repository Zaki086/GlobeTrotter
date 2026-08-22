import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Copy,
  LayoutList,
  Link2,
  ListTree,
  MapPin,
  Pencil,
  Share2,
  Users,
  Wallet,
} from 'lucide-react';
import { getTrip, getTripItinerary, createShareLink } from '@/services/trip';
import { GlassCard } from '@/components/GlassCard';
import { TimelineTile } from '@/components/TimelineTile';
import { BottomSheet } from '@/components/BottomSheet';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { STATUS_COLORS, TRIP_STATUS_LABELS } from '@/lib/constants';
import {
  fallbackImage,
  formatDateRange,
  formatDateShort,
  formatDateWithWeekday,
  formatMoney,
} from '@/lib/format';
import { cn } from '@/lib/utils';

type ViewMode = 'timeline' | 'list';

export function ItineraryViewPage() {
  const { tripId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [view, setView] = useState<ViewMode>('timeline');
  const [activeDay, setActiveDay] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const tripQuery = useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => getTrip(tripId),
    enabled: !!tripId,
  });

  const itineraryQuery = useQuery({
    queryKey: ['itinerary', tripId],
    queryFn: () => getTripItinerary(tripId, 'timeline'),
    enabled: !!tripId,
  });

  const share = useMutation({
    mutationFn: () => createShareLink(tripId, { allowCopy: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      toast('Share link created', 'success');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const trip = tripQuery.data;
  const itinerary = itineraryQuery.data;

  const activeShare = useMemo(
    () => trip?.shares.find((s) => s.isActive) ?? null,
    [trip?.shares],
  );

  if (tripQuery.isLoading || itineraryQuery.isLoading) return <LoadingSkeleton count={5} />;

  if (tripQuery.isError || !trip) {
    return (
      <ErrorState
        title="We couldn't load this trip"
        message={tripQuery.error instanceof Error ? tripQuery.error.message : undefined}
        onRetry={() => void tripQuery.refetch()}
      />
    );
  }

  const days = itinerary?.timeline ?? [];
  const stopGroups = itinerary?.list ?? [];
  const day = days[activeDay];

  const copyShareUrl = async () => {
    if (!activeShare) return;
    try {
      await navigator.clipboard.writeText(activeShare.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('Could not copy the link', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative -mx-4 h-56 overflow-hidden md:mx-0 md:h-72 md:rounded-3xl">
        <img
          src={trip.coverImageUrl ?? fallbackImage(trip.name)}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="hero-scrim absolute inset-0" />

        <button
          onClick={() => navigate('/trips')}
          className="absolute left-4 top-4 rounded-full bg-black/40 p-2.5 text-white backdrop-blur-md transition-colors hover:bg-black/60"
          aria-label="Back to trips"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
          <span
            className={cn(
              'mb-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold',
              STATUS_COLORS[trip.status],
            )}
          >
            {TRIP_STATUS_LABELS[trip.status]}
          </span>
          <h1 className="text-2xl font-semibold text-white text-balance md:text-3xl">
            {trip.name}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/85">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              {formatDateRange(trip.startDate, trip.endDate)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {trip.stops.length} {trip.stops.length === 1 ? 'stop' : 'stops'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {trip.travelers}
            </span>
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {trip.canEdit && (
          <Button onClick={() => navigate(`/trips/${tripId}/build`)} className="rounded-2xl">
            <Pencil className="mr-1.5 h-4 w-4" />
            Edit itinerary
          </Button>
        )}
        <Button
          variant="outline"
          className="rounded-2xl"
          onClick={() => navigate(`/trips/${tripId}/budget`)}
        >
          <Wallet className="mr-1.5 h-4 w-4" />
          Budget
        </Button>
        <Button
          variant="outline"
          className="rounded-2xl"
          onClick={() => navigate(`/trips/${tripId}/calendar`)}
        >
          <CalendarDays className="mr-1.5 h-4 w-4" />
          Calendar
        </Button>
        {trip.role === 'OWNER' && (
          <Button variant="outline" className="rounded-2xl" onClick={() => setShareOpen(true)}>
            <Share2 className="mr-1.5 h-4 w-4" />
            Share
          </Button>
        )}
      </div>

      {/* Summary */}
      {itinerary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryTile label="Days" value={String(itinerary.summary.totalDays)} />
          <SummaryTile label="Cities" value={String(itinerary.summary.totalCities)} />
          <SummaryTile label="Activities" value={String(itinerary.summary.totalActivities)} />
          <SummaryTile
            label="Estimated"
            value={formatMoney(trip.budget?.grandTotal ?? 0, trip.currency)}
          />
        </div>
      )}

      {/* View toggle */}
      <div className="flex items-center gap-2">
        <ToggleButton active={view === 'timeline'} onClick={() => setView('timeline')} icon={ListTree}>
          Timeline
        </ToggleButton>
        <ToggleButton active={view === 'list'} onClick={() => setView('list')} icon={LayoutList}>
          By city
        </ToggleButton>
      </div>

      {/* Content */}
      {trip.stops.length === 0 ? (
        <EmptyState
          title="This itinerary is empty"
          message="Add cities and activities to bring it to life."
          action={
            trip.canEdit ? (
              <Button onClick={() => navigate(`/trips/${tripId}/build`)} className="rounded-2xl">
                Start building
              </Button>
            ) : undefined
          }
        />
      ) : view === 'timeline' ? (
        <div className="space-y-4">
          {/* Day tabs */}
          <div className="snap-x-rail -mx-4 px-4 md:mx-0 md:px-0">
            {days.map((d, index) => (
              <button
                key={d.date}
                onClick={() => setActiveDay(index)}
                className={cn(
                  'flex min-w-[4.5rem] flex-col items-center rounded-2xl px-3 py-2.5 text-center transition-colors',
                  index === activeDay
                    ? 'bg-primary text-primary-foreground'
                    : 'glass text-muted-foreground hover:text-foreground',
                )}
                aria-pressed={index === activeDay}
              >
                <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">
                  {d.weekday.slice(0, 3)}
                </span>
                <span className="text-base font-semibold tabular-nums">
                  {formatDateShort(d.date).split(' ')[0]}
                </span>
                <span className="text-[10px] opacity-80">Day {d.dayNumber}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {day && (
              <motion.div
                key={day.date}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                <GlassCard className="rounded-3xl p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {formatDateWithWeekday(day.date)}
                      </h2>
                      {day.city && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {day.city.name}, {day.city.country}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatMoney(day.dayCost, trip.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {day.activities.length}{' '}
                        {day.activities.length === 1 ? 'activity' : 'activities'}
                      </p>
                    </div>
                  </div>

                  {(day.isArrivalDay || day.isDepartureDay) && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {day.isArrivalDay && (
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          Arrival day
                        </span>
                      )}
                      {day.isDepartureDay && (
                        <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                          Departure day
                        </span>
                      )}
                    </div>
                  )}

                  {day.activities.length === 0 ? (
                    <p className="rounded-2xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
                      A free day — nothing scheduled.
                    </p>
                  ) : (
                    <ol className="space-y-0">
                      {day.activities.map((activity, i) => (
                        <TimelineTile
                          key={activity.id}
                          activity={activity}
                          isLast={i === day.activities.length - 1}
                        />
                      ))}
                    </ol>
                  )}
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="space-y-4">
          {stopGroups.map((group) => (
            <GlassCard key={group.stopId} className="overflow-hidden rounded-3xl">
              <div className="relative h-32">
                <img
                  src={group.city.imageUrl ?? fallbackImage(group.city.name)}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
                <div className="hero-scrim absolute inset-0" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{group.city.name}</h3>
                    <p className="text-xs text-white/80">
                      {formatDateShort(group.arrivalDate)} – {formatDateShort(group.departureDate)}{' '}
                      · {group.nights} {group.nights === 1 ? 'night' : 'nights'}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-white">
                    {formatMoney(group.costs.total, trip.currency)}
                  </p>
                </div>
              </div>

              <div className="p-4">
                {group.activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activities planned here.</p>
                ) : (
                  <ul className="space-y-2">
                    {group.activities.map((activity) => (
                      <li key={activity.id} className="flex items-center gap-3">
                        <img
                          src={activity.imageUrl ?? fallbackImage(activity.name, 100, 100)}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-xl object-cover"
                          loading="lazy"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">{activity.name}</span>
                        <span className="shrink-0 text-sm font-medium tabular-nums">
                          {formatMoney(activity.cost, trip.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Share sheet */}
      <BottomSheet open={shareOpen} onClose={() => setShareOpen(false)} title="Share this itinerary">
        <div className="space-y-4 pb-2">
          {activeShare ? (
            <>
              <p className="text-sm text-muted-foreground">
                Anyone with this link can view the itinerary. Members, expenses and your email
                stay private.
              </p>

              <div className="flex items-center gap-2 rounded-2xl border border-border p-3">
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm">{activeShare.url}</span>
                <button
                  onClick={() => void copyShareUrl()}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Copy share link"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-2xl bg-muted p-3">
                  <p className="text-xl font-semibold tabular-nums">{activeShare.viewCount}</p>
                  <p className="text-xs text-muted-foreground">Views</p>
                </div>
                <div className="rounded-2xl bg-muted p-3">
                  <p className="text-xl font-semibold tabular-nums">{activeShare.copyCount}</p>
                  <p className="text-xs text-muted-foreground">Copies</p>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full rounded-2xl"
                onClick={() => navigate(`/public/${activeShare.slug}`)}
              >
                Preview public page
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Create a public link so friends can view — and copy — this itinerary.
              </p>
              <Button
                className="w-full rounded-2xl"
                size="lg"
                disabled={share.isPending}
                onClick={() => share.mutate()}
              >
                {share.isPending ? 'Creating…' : 'Create share link'}
              </Button>
            </>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard className="rounded-2xl p-3.5 text-center">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </GlassCard>
  );
}

function ToggleButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof ListTree;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-medium transition-colors',
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
