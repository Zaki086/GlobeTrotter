import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpDown, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { deleteTrip, listTrips } from '@/services/trip';
import { TripCard } from '@/components/TripCard';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { BottomSheet } from '@/components/BottomSheet';
import { SearchBar } from '@/components/SearchBar';
import { Button } from '@/components/ui/button';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useToast } from '@/hooks/use-toast';
import { TRIP_STATUS_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { ListTripsQuery, TripStatus } from '@/types';

const FILTERS: { value: NonNullable<ListTripsQuery['filter']>; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'past', label: 'Past' },
];

const SORTS: { value: NonNullable<ListTripsQuery['sortBy']>; label: string }[] = [
  { value: 'startDate', label: 'Departure date' },
  { value: 'createdAt', label: 'Recently created' },
  { value: 'name', label: 'Name' },
];

const STATUSES = Object.keys(TRIP_STATUS_LABELS) as TripStatus[];

export function TripsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<NonNullable<ListTripsQuery['filter']>>('all');
  const [status, setStatus] = useState<TripStatus | undefined>();
  const [sortBy, setSortBy] = useState<NonNullable<ListTripsQuery['sortBy']>>('startDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  // Avoids a request per keystroke while the user is still typing.
  const debouncedSearch = useDebouncedValue(search, 300);

  const query = useMemo<ListTripsQuery>(
    () => ({
      search: debouncedSearch || undefined,
      filter,
      status,
      sortBy,
      sortOrder,
      limit: 50,
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

  const activeFilterCount = (status ? 1 : 0) + (sortBy !== 'startDate' ? 1 : 0);
  const trips = data?.items ?? [];

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

      {/* Search + filter controls */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <SearchBar
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search trips…"
              aria-label="Search trips"
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
            onClick={() => setSheetOpen(true)}
            className={cn(
              'touch-target relative flex items-center justify-center rounded-2xl border border-border px-3 transition-colors hover:bg-muted',
              activeFilterCount > 0 && 'border-primary text-primary',
            )}
            aria-label="Filters and sorting"
          >
            <SlidersHorizontal className="h-5 w-5" />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        <div className="snap-x-rail">
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
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
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
            debouncedSearch ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setFilter('all');
                  setStatus(undefined);
                }}
                className="rounded-2xl"
              >
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
      ) : (
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
                <TripCard trip={trip} onClick={() => navigate(`/trips/${trip.id}`)} />

                {trip.role === 'OWNER' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDelete({ id: trip.id, name: trip.name });
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
      )}

      {/* Filter / sort sheet */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Filter & sort">
        <div className="space-y-6 pb-2">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Status</legend>
            <div className="flex flex-wrap gap-2">
              <FilterPill active={!status} onClick={() => setStatus(undefined)}>
                Any
              </FilterPill>
              {STATUSES.map((value) => (
                <FilterPill
                  key={value}
                  active={status === value}
                  onClick={() => setStatus(status === value ? undefined : value)}
                >
                  {TRIP_STATUS_LABELS[value]}
                </FilterPill>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Sort by</legend>
            <div className="flex flex-wrap gap-2">
              {SORTS.map((item) => (
                <FilterPill
                  key={item.value}
                  active={sortBy === item.value}
                  onClick={() => setSortBy(item.value)}
                >
                  {item.label}
                </FilterPill>
              ))}
            </div>
          </fieldset>

          <button
            onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
            className="flex w-full items-center justify-between rounded-2xl border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <span className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4" />
              Order
            </span>
            <span className="text-muted-foreground">
              {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            </span>
          </button>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 rounded-2xl"
              onClick={() => {
                setStatus(undefined);
                setSortBy('startDate');
                setSortOrder('asc');
              }}
            >
              Reset
            </Button>
            <Button className="flex-1 rounded-2xl" onClick={() => setSheetOpen(false)}>
              Show {trips.length} {trips.length === 1 ? 'trip' : 'trips'}
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Delete confirmation */}
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

function FilterPill({
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
        'rounded-full px-4 py-2 text-sm font-medium transition-colors',
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
