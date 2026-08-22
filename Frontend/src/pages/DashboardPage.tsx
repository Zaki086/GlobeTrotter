import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarDays,
  Compass,
  MapPin,
  Plus,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { getDashboard } from '@/services/dashboard';
import { GlassCard } from '@/components/GlassCard';
import { TripCard } from '@/components/TripCard';
import { DestinationChip } from '@/components/DestinationChip';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { CountUp } from '@/components/CountUp';
import { SectionHeader } from '@/components/SectionHeader';
import { formatCountdown, formatDateRange, formatMoney, fallbackImage } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { DashboardTripCard } from '@/types';

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const riseIn = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const } },
};

export function DashboardPage() {
  const navigate = useNavigate();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  });

  // The nearest upcoming trip drives the hero; fall back to an ongoing one.
  const featured = useMemo<DashboardTripCard | undefined>(
    () => data?.ongoingTrips[0] ?? data?.upcomingTrips[0],
    [data],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-64 animate-pulse rounded-3xl bg-muted md:h-80" />
        <LoadingSkeleton count={3} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <ErrorState
        title="We couldn't load your dashboard"
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => void refetch()}
      />
    );
  }

  const { stats, budgetSummary, countdowns, recommendedCities, recentTrips, upcomingTrips } = data;
  const hasTrips = stats.totalTrips > 0;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-10">
      {/* ---------------------------------------------------------------- */}
      {/* Hero — the next trip, or a prompt to create the first one         */}
      {/* ---------------------------------------------------------------- */}
      <motion.section variants={riseIn}>
        {featured ? (
          <button
            onClick={() => navigate(`/trips/${featured.id}`)}
            className="group relative block h-72 w-full overflow-hidden rounded-3xl text-left md:h-96"
          >
            <img
              src={featured.heroImage ?? fallbackImage(featured.name)}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              loading="eager"
            />
            <div className="hero-scrim absolute inset-0" />

            <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
              <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5" />
                {formatCountdown(featured.daysUntilStart)}
              </span>

              <h1 className="text-2xl font-semibold leading-tight text-white text-balance md:text-4xl">
                {featured.name}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/85">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {formatDateRange(featured.startDate, featured.endDate)}
                </span>
                {featured.destinations.length > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {featured.destinations.slice(0, 3).join(' · ')}
                    {featured.destinations.length > 3 && ` +${featured.destinations.length - 3}`}
                  </span>
                )}
              </div>
            </div>
          </button>
        ) : (
          <GlassCard className="flex flex-col items-center gap-4 rounded-3xl px-6 py-14 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
              <Compass className="h-8 w-8" />
            </span>
            <div>
              <h1 className="text-xl font-semibold md:text-2xl">{data.welcomeMessage}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Your next adventure starts with a single stop.
              </p>
            </div>
            <Button onClick={() => navigate('/trips/new')} size="lg" className="rounded-2xl">
              <Plus className="mr-2 h-4 w-4" />
              Plan your first trip
            </Button>
          </GlassCard>
        )}
      </motion.section>

      {/* ---------------------------------------------------------------- */}
      {/* Welcome + quick actions                                           */}
      {/* ---------------------------------------------------------------- */}
      {featured && (
        <motion.section variants={riseIn} className="space-y-4">
          <h2 className="text-lg font-semibold text-balance md:text-xl">{data.welcomeMessage}</h2>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <QuickAction icon={Plus} label="New trip" onClick={() => navigate('/trips/new')} primary />
            <QuickAction icon={Compass} label="Explore" onClick={() => navigate('/cities')} />
            <QuickAction
              icon={CalendarDays}
              label="Calendar"
              onClick={() => navigate('/calendar')}
            />
            <QuickAction icon={Wallet} label="Budget" onClick={() => navigate('/budget')} />
          </div>
        </motion.section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Stats                                                             */}
      {/* ---------------------------------------------------------------- */}
      {hasTrips && (
        <motion.section variants={riseIn} className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Total trips" value={stats.totalTrips} />
          <StatTile label="Upcoming" value={stats.upcomingTrips} />
          <StatTile label="Ongoing" value={stats.ongoingTrips} />
          <StatTile label="Completed" value={stats.completedTrips} />
        </motion.section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Countdowns                                                        */}
      {/* ---------------------------------------------------------------- */}
      {countdowns.length > 0 && (
        <motion.section variants={riseIn} className="space-y-4">
          <SectionHeader title="Counting down" icon={Sparkles} />
          <div className="snap-x-rail -mx-4 px-4 md:mx-0 md:px-0">
            {countdowns.map((item) => (
              <button
                key={item.tripId}
                onClick={() => navigate(`/trips/${item.tripId}`)}
                className="group relative h-44 w-64 overflow-hidden rounded-3xl text-left"
              >
                <img
                  src={item.coverImageUrl ?? fallbackImage(item.tripName)}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="hero-scrim absolute inset-0" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p className="text-3xl font-semibold tabular-nums text-white">
                    <CountUp value={Math.max(item.daysRemaining, 0)} />
                    <span className="ml-1 text-sm font-normal text-white/80">days</span>
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium text-white">{item.tripName}</p>
                  {item.firstCity && (
                    <p className="truncate text-xs text-white/75">{item.firstCity}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </motion.section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Continue planning                                                 */}
      {/* ---------------------------------------------------------------- */}
      {upcomingTrips.length > 0 && (
        <motion.section variants={riseIn} className="space-y-4">
          <SectionHeader
            title="Continue planning"
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/trips')}>
                All trips
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            }
          />
          <div className="grid gap-4 md:grid-cols-2">
            {upcomingTrips.slice(0, 4).map((trip) => (
              <TripCard key={trip.id} trip={trip} onClick={() => navigate(`/trips/${trip.id}`)} />
            ))}
          </div>
        </motion.section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Budget overview                                                   */}
      {/* ---------------------------------------------------------------- */}
      {hasTrips && (
        <motion.section variants={riseIn} className="space-y-4">
          <SectionHeader
            title="Budget overview"
            icon={Wallet}
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/budget')}>
                Details
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            }
          />

          <GlassCard className="rounded-3xl p-5 md:p-6">
            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Estimated
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  <CountUp value={budgetSummary.totalEstimated} format={(v) => formatMoney(v)} />
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Planned
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {budgetSummary.totalPlanned > 0 ? formatMoney(budgetSummary.totalPlanned) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Avg / day
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {formatMoney(budgetSummary.averagePerDay)}
                </p>
              </div>
            </div>

            {budgetSummary.highlights.length > 0 && (
              <div className="mt-5 space-y-2 border-t border-border pt-4">
                {budgetSummary.highlights.map((h) => (
                  <button
                    key={h.tripId}
                    onClick={() => navigate(`/trips/${h.tripId}/budget`)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{h.tripName}</span>
                      {h.planned !== null && (
                        <span className="block text-xs text-muted-foreground">
                          of {formatMoney(h.planned, h.currency)} planned
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 text-sm font-semibold tabular-nums',
                        h.isOverBudget ? 'text-destructive' : 'text-foreground',
                      )}
                    >
                      {formatMoney(h.estimated, h.currency)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </GlassCard>
        </motion.section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Recent trips                                                      */}
      {/* ---------------------------------------------------------------- */}
      {recentTrips.length > 0 ? (
        <motion.section variants={riseIn} className="space-y-4">
          <SectionHeader title="Recent trips" icon={TrendingUp} />
          <div className="grid gap-4 md:grid-cols-2">
            {recentTrips.slice(0, 4).map((trip) => (
              <TripCard key={trip.id} trip={trip} onClick={() => navigate(`/trips/${trip.id}`)} />
            ))}
          </div>
        </motion.section>
      ) : (
        hasTrips && (
          <EmptyState
            title="No recent activity"
            message="Trips you edit will show up here."
          />
        )
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Recommended destinations                                          */}
      {/* ---------------------------------------------------------------- */}
      {recommendedCities.length > 0 && (
        <motion.section variants={riseIn} className="space-y-4">
          <SectionHeader
            title="Where to next"
            icon={Compass}
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/cities')}>
                Explore
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            }
          />
          <div className="snap-x-rail -mx-4 px-4 md:mx-0 md:px-0">
            {recommendedCities.map((city) => (
              <DestinationChip
                key={city.id}
                name={`${city.name}, ${city.country}`}
                imageUrl={city.imageUrl}
                onClick={() => navigate(`/cities?city=${city.id}`)}
              />
            ))}
          </div>
        </motion.section>
      )}
    </motion.div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
  primary,
}: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-2xl px-3 py-4 text-sm font-medium transition-all active:scale-[0.97]',
        primary
          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
          : 'glass text-foreground hover:border-primary/30',
      )}
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <GlassCard className="rounded-2xl p-4">
      <p className="text-2xl font-semibold tabular-nums">
        <CountUp value={value} />
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </GlassCard>
  );
}
