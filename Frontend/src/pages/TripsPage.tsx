import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleDot, Clock, Plus, Trash2 } from 'lucide-react';
import { deleteTrip, listTrips } from '@/services/trip';
import { TripCard } from '@/components/TripCard';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { BottomSheet } from '@/components/BottomSheet';
import { ListToolbar, Pill, type ToolbarOption } from '@/components/ListToolbar';
import { SectionHeader } from '@/components/SectionHeader';
import { Button } from '@/components/ui/button';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useToast } from '@/hooks/use-toast';
import { TRIP_STATUS_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { ListTripsQuery, TripStatus, TripSummary } from '@/types';

type GroupBy = 'phase' | 'none' | 'status' | 'country';

const GROUP_OPTIONS: ToolbarOption<GroupBy>[] = [
  { value: 'phase', label: 'Trip phase' },
  { value: 'status', label: 'Status' },
  { value: 'country', label: 'Destination' },
  { value: 'none', label: 'No grouping' },
];

const SORT_OPTIONS: ToolbarOption<NonNullable<ListTripsQuery['sortBy']>>[] = [
  { value: 'startDate', label: 'Departure date' },
  { value: 'createdAt', label: 'Recently created' },
  { value: 'name', label: 'Name' },
];

const FILTERS: { value: NonNullable<ListTripsQuery['filter']>; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'past', label: 'Past' },
];

const STATUSES = Object.keys(TRIP_STATUS_LABELS) as TripStatus[];

/**
 * Screen 6 — "User Trip Listing".
 *
 * The wireframe groups trips under Ongoing / Up-coming / Completed headings
 * rather than showing one flat list, so "Trip phase" is the default grouping.
 * The phase comes from the trip's own dates, not its status field, so a trip
 * left as PLANNED still files under Completed once it has ended.
 */
function phaseOf(trip: TripSummary): 'ongoing' | 'upcoming' | 'completed' {
  const today = new Date().toISOString().slice(0, 10);
  if (trip.endDate < today) return 'completed';
  if (trip.startDate > today) return 'upcoming';
  return 'ongoing';
}

const PHASE_META = {
  ongoing: { label: 'Ongoing', icon: CircleDot },
  upcoming: { label: 'Up-coming', icon: Clock },
  completed: { label: 'Completed', icon: CircleDot },
} as const;

export function TripsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<NonNullable<ListTripsQuery['filter']>>('all');
  const [status, setStatus] = useState<TripStatus | undefined>();
  const [groupBy, setGroupBy] = useState<GroupBy>('phase');
  const [sortBy, setSortBy] = useState<NonNullable<ListTripsQuery['sortBy']>>('startDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  const query = useMemo<ListTripsQuery>(
    () => ({
      search: debouncedSearch || undefined,
      filter,
      status,
      sortBy,
      sortOrder,
      limit: 100,
    }),
    [debouncedSearch, filter, status, sortBy, sortOrder],
  );

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['trips', query],
    queryFn: () => listTrips(query),
  });

  const removeTrip = useMutation({
    mutationFn: (id: string) => deleteTrip(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast('Trip deleted', 'success');
      setPendingDelete(null);
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const trips = useMemo(() => data?.items ?? [], [data]);

  const groups = useMemo(() => {
    if (groupBy === 'none') return null;

    if (groupBy === 'phase') {
      const order: Array<keyof typeof PHASE_META> = ['ongoing', 'upcoming', 'completed'];
      return order
        .map((phase) => ({
          key: phase as string,
          label: PHASE_META[phase].label,
          icon: PHASE_META[phase].icon,
          trips: trips.filter((t) => phaseOf(t) === phase),
        }))
        .filter((g) => g.trips.length > 0);
    }

    const buckets = new Map<string, TripSummary[]>();
    for (const trip of trips) {
      const keys =
        groupBy === 'status'
          ? [TRIP_STATUS_LABELS[trip.status]]
          : trip.cities.length
            ? [...new Set(trip.cities)]
            : ['No destinations yet'];
      for (const key of keys) buckets.set(key, [...(buckets.get(key) ?? []), trip]);
    }

    return [...buckets.entries()]
      .map(([key, items]) => ({ key, label: key, icon: undefined, trips: items }))
      .sort((a, b) => b.trips.length - a.trips.length || a.label.localeCompare(b.label));
  }, [trips, groupBy]);

  const activeFilterCount = (status ? 1 : 0) + (filter !== 'all' ? 1 : 0);

  const reset = () => {
    setStatus(undefined);
    setFilter('all');
    setGroupBy('phase');
    setSortBy('startDate');
    setSortOrder('asc');
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">My trips</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {data ? `${data.total} ${data.total === 1 ? 'trip' : 'trips'}` : 'Loading…'}
          </p>
        </div>
        <Button onClick={() => navigate('/trips/new')} className="rounded-2xl">
          <Plus className="mr-1.5 h-4 w-4" />
          New
        </Button>
      </header>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search trips…"
        groupBy={groupBy}
        groupOptions={GROUP_OPTIONS}
        onGroupByChange={setGroupBy}
        sortBy={sortBy}
        sortOptions={SORT_OPTIONS}
        onSortByChange={setSortBy}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        activeFilterCount={activeFilterCount}
        onResetFilters={reset}
        resultCount={data?.total}
        filters={
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Status</legend>
            <div className="flex flex-wrap gap-2">
              <Pill active={!status} onClick={() => setStatus(undefined)}>
                Any
              </Pill>
              {STATUSES.map((value) => (
                <Pill
                  key={value}
                  active={status === value}
                  onClick={() => setStatus(status === value ? undefined : value)}
                >
                  {TRIP_STATUS_LABELS[value]}
                </Pill>
              ))}
            </div>
          </fieldset>
        }
      />

      <div className="snap-x-rail -mx-4 px-4 md:mx-0 md:px-0">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            onClick={() => setFilter(item.value)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              filter === item.value
                ? 'bg-primary text-primary-foreground'
                : 'glass text-muted-foreground hover:text-foreground',
            )}
            aria-pressed={filter === item.value}
          >
            {item.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSkeleton count={4} />
      ) : isError ? (
        <ErrorState
          title="We couldn't load your trips"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      ) : trips.length === 0 ? (
        <EmptyState
          title={debouncedSearch ? 'No trips match that search' : 'No trips yet'}
          message={
            debouncedSearch
              ? 'Try a different name or clear the filters.'
              : 'Plan your first multi-city adventure.'
          }
          action={
            debouncedSearch || activeFilterCount ? (
              <Button variant="outline" onClick={reset} className="rounded-2xl">
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => navigate('/trips/new')} className="rounded-2xl">
                <Plus className="mr-1.5 h-4 w-4" />
                Create a trip
              </Button>
            )
          }
        />
      ) : groups ? (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.key} className="space-y-3">
              <SectionHeader
                title={group.label}
                subtitle={`${group.trips.length} ${group.trips.length === 1 ? 'trip' : 'trips'}`}
                icon={group.icon}
              />
              <TripGrid
                trips={group.trips}
                onOpen={(id) => navigate(`/trips/${id}`)}
                onDelete={setPendingDelete}
              />
            </section>
          ))}
        </div>
      ) : (
        <TripGrid
          trips={trips}
          onOpen={(id) => navigate(`/trips/${id}`)}
          onDelete={setPendingDelete}
        />
      )}

      <BottomSheet
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Delete this trip?"
      >
        <div className="space-y-4 pb-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{pendingDelete?.name}</span> and all of
            its stops, activities and expenses will be permanently removed. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 rounded-2xl"
              onClick={() => setPendingDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1 rounded-2xl"
              disabled={removeTrip.isPending}
              onClick={() => pendingDelete && removeTrip.mutate(pendingDelete.id)}
            >
              {removeTrip.isPending ? 'Deleting…' : 'Delete trip'}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

function TripGrid({
  trips,
  onOpen,
  onDelete,
}: {
  trips: TripSummary[];
  onOpen: (id: string) => void;
  onDelete: (trip: { id: string; name: string }) => void;
}) {
  return (
    <motion.div layout className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <AnimatePresence mode="popLayout">
        {trips.map((trip) => (
          <motion.div
            key={trip.id}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="group relative"
          >
            <TripCard trip={trip} onClick={() => onOpen(trip.id)} />

            {trip.role === 'OWNER' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete({ id: trip.id, name: trip.name });
                }}
                className="absolute right-3 top-3 z-10 rounded-full bg-black/40 p-2 text-white opacity-0 backdrop-blur-md transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                aria-label={`Delete ${trip.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
