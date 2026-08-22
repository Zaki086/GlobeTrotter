import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Clock, MapPin, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import { getPopularActivities, searchActivities } from '@/services/activity';
import { GlassCard } from '@/components/GlassCard';
import { BottomSheet } from '@/components/BottomSheet';
import { SearchBar } from '@/components/SearchBar';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { SectionHeader } from '@/components/SectionHeader';
import { Button } from '@/components/ui/button';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { ACTIVITY_TYPE_LABELS } from '@/lib/constants';
import { fallbackImage, formatDuration, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Activity, ActivityType } from '@/types';

const TYPES = Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[];

const DURATIONS = [
  { label: 'Any length', value: undefined },
  { label: 'Under 1h', value: 60 },
  { label: 'Under 3h', value: 180 },
  { label: 'Half day', value: 360 },
] as const;

const BUDGETS = [
  { label: 'Any price', value: undefined },
  { label: 'Free', value: 0 },
  { label: 'Under $25', value: 25 },
  { label: 'Under $75', value: 75 },
] as const;

export function ActivitySearchPage() {
  const [params] = useSearchParams();

  const [search, setSearch] = useState('');
  const [type, setType] = useState<ActivityType | undefined>();
  const [maxDuration, setMaxDuration] = useState<number | undefined>();
  const [maxCost, setMaxCost] = useState<number | undefined>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Activity | null>(null);

  const cityId = params.get('cityId') ?? undefined;
  const debounced = useDebouncedValue(search, 300);

  const isFiltering =
    debounced.length > 0 || !!type || maxDuration !== undefined || maxCost !== undefined || !!cityId;

  const popular = useQuery({
    queryKey: ['activities', 'popular'],
    queryFn: () => getPopularActivities(12),
    enabled: !isFiltering,
  });

  const results = useQuery({
    queryKey: ['activities', { search: debounced, type, maxDuration, maxCost, cityId }],
    queryFn: () =>
      searchActivities({
        search: debounced || undefined,
        type,
        maxDuration,
        maxCost,
        cityId,
        limit: 40,
      }),
    enabled: isFiltering,
  });

  const activities = isFiltering ? results.data?.items ?? [] : popular.data ?? [];
  const isLoading = isFiltering ? results.isLoading : popular.isLoading;
  const isError = isFiltering ? results.isError : popular.isError;

  const activeFilterCount = useMemo(
    () => [type, maxDuration, maxCost].filter((v) => v !== undefined).length,
    [type, maxDuration, maxCost],
  );

  const reset = () => {
    setSearch('');
    setType(undefined);
    setMaxDuration(undefined);
    setMaxCost(undefined);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Things to do</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Sightseeing, food tours, adventure and more.
        </p>
      </header>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <SearchBar
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activities…"
              aria-label="Search activities"
              className="pl-10"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => setFiltersOpen(true)}
            className={cn(
              'touch-target relative flex items-center justify-center rounded-2xl border border-border px-3 transition-colors hover:bg-muted',
              activeFilterCount > 0 && 'border-primary text-primary',
            )}
            aria-label="Filters"
          >
            <SlidersHorizontal className="h-5 w-5" />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Category chips — horizontally scrollable, per design.md */}
        <div className="snap-x-rail -mx-4 px-4 md:mx-0 md:px-0">
          <CategoryChip active={!type} onClick={() => setType(undefined)}>
            All
          </CategoryChip>
          {TYPES.map((value) => (
            <CategoryChip
              key={value}
              active={type === value}
              onClick={() => setType(type === value ? undefined : value)}
            >
              {ACTIVITY_TYPE_LABELS[value]}
            </CategoryChip>
          ))}
        </div>
      </div>

      {/* Results */}
      <section className="space-y-3">
        <SectionHeader
          title={isFiltering ? 'Results' : 'Most added'}
          icon={isFiltering ? Search : Star}
          subtitle={isFiltering && results.data ? `${results.data.total} activities` : undefined}
        />

        {isLoading ? (
          <LoadingSkeleton count={4} />
        ) : isError ? (
          <ErrorState
            title="Search failed"
            onRetry={() => void (isFiltering ? results.refetch() : popular.refetch())}
          />
        ) : activities.length === 0 ? (
          <EmptyState
            title="Nothing matches those filters"
            message="Try widening the price or duration."
            action={
              <Button variant="outline" className="rounded-2xl" onClick={reset}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {activities.map((activity, index) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                index={index}
                onClick={() => setSelected(activity)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Filters sheet */}
      <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        <div className="space-y-6 pb-2">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Duration</legend>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((item) => (
                <CategoryChip
                  key={item.label}
                  active={maxDuration === item.value}
                  onClick={() => setMaxDuration(item.value)}
                >
                  {item.label}
                </CategoryChip>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Price</legend>
            <div className="flex flex-wrap gap-2">
              {BUDGETS.map((item) => (
                <CategoryChip
                  key={item.label}
                  active={maxCost === item.value}
                  onClick={() => setMaxCost(item.value)}
                >
                  {item.label}
                </CategoryChip>
              ))}
            </div>
          </fieldset>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 rounded-2xl" onClick={reset}>
              Reset
            </Button>
            <Button className="flex-1 rounded-2xl" onClick={() => setFiltersOpen(false)}>
              Show results
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Detail sheet */}
      <BottomSheet open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ''}>
        {selected && (
          <div className="space-y-4 pb-2">
            <div className="relative h-40 overflow-hidden rounded-2xl">
              <img
                src={selected.imageUrl ?? fallbackImage(selected.name)}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Tag>{ACTIVITY_TYPE_LABELS[selected.type]}</Tag>
              <Tag>
                <Clock className="mr-1 inline h-3 w-3" />
                {formatDuration(selected.durationMinutes)}
              </Tag>
              <Tag>
                <MapPin className="mr-1 inline h-3 w-3" />
                {selected.city.name}
              </Tag>
            </div>

            {selected.description && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {selected.description}
              </p>
            )}

            <GlassCard className="flex items-center justify-between rounded-2xl p-4">
              <span className="text-sm text-muted-foreground">Estimated cost</span>
              <span className="text-lg font-semibold tabular-nums">
                {formatMoney(selected.estimatedCost, selected.currency)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">/ person</span>
              </span>
            </GlassCard>

            <p className="text-center text-xs text-muted-foreground">
              Add this from your trip's itinerary builder to schedule it on a day.
            </p>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

function ActivityCard({
  activity,
  index,
  onClick,
}: {
  activity: Activity;
  index: number;
  onClick: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
      onClick={onClick}
      className="group overflow-hidden rounded-3xl border border-border text-left transition-shadow hover:shadow-lg"
    >
      <div className="relative h-36 overflow-hidden">
        <img
          src={activity.imageUrl ?? fallbackImage(activity.name)}
          alt=""
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
          {ACTIVITY_TYPE_LABELS[activity.type]}
        </span>
      </div>

      <div className="space-y-1.5 p-4">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug">{activity.name}</h3>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {activity.city.name}, {activity.city.country}
        </p>
        <div className="flex items-center justify-between pt-1">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDuration(activity.durationMinutes)}
          </span>
          <span className="text-sm font-semibold tabular-nums">
            {activity.estimatedCost === 0
              ? 'Free'
              : formatMoney(activity.estimatedCost, activity.currency)}
          </span>
        </div>
      </div>
    </motion.button>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'border border-border text-muted-foreground hover:text-foreground',
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}
