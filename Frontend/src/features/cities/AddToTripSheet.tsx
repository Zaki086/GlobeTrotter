import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, Loader2, MapPin, Plus } from 'lucide-react';
import { listTrips, getTrip } from '@/services/trip';
import { createStop } from '@/services/stop';
import { BottomSheet } from '@/components/BottomSheet';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { fallbackImage, formatDateRange } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { City } from '@/types';

interface AddToTripSheetProps {
  open: boolean;
  onClose: () => void;
  city: Pick<City, 'id' | 'name' | 'country' | 'imageUrl'> | null;
}

/**
 * The PRD's "Add to Trip" button on city search.
 *
 * Picks one of the traveller's editable trips, then appends this city as a
 * stop. Dates default to the day the previous stop ends — the same rule the
 * itinerary builder uses — and are clamped to the trip range the backend
 * enforces, so the common case needs no date entry at all.
 */
export function AddToTripSheet({ open, onClose, city }: AddToTripSheetProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [tripId, setTripId] = useState<string | null>(null);
  const [arrivalDate, setArrivalDate] = useState('');
  const [departureDate, setDepartureDate] = useState('');

  const trips = useQuery({
    queryKey: ['trips', { filter: 'all', limit: 50 }],
    queryFn: () => listTrips({ filter: 'all', limit: 50 }),
    enabled: open,
  });

  // Only trips the user can actually edit can receive a stop.
  const editable = useMemo(
    () => (trips.data?.items ?? []).filter((t) => t.role === 'OWNER' || t.role === 'EDITOR'),
    [trips.data],
  );

  const selected = useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => getTrip(tripId!),
    enabled: !!tripId,
  });

  // Seed the dates once the chosen trip loads.
  const trip = selected.data;
  const suggested = useMemo(() => {
    if (!trip) return null;
    const last = trip.stops[trip.stops.length - 1];
    return { from: last?.departureDate ?? trip.startDate, to: trip.endDate };
  }, [trip]);

  const from = arrivalDate || suggested?.from || '';
  const to = departureDate || suggested?.to || '';

  const dateError = useMemo(() => {
    if (!trip || !from || !to) return null;
    if (Date.parse(to) < Date.parse(from)) return 'Departure must be on or after arrival.';
    if (Date.parse(from) < Date.parse(trip.startDate))
      return `This trip starts on ${trip.startDate}.`;
    if (Date.parse(to) > Date.parse(trip.endDate)) return `This trip ends on ${trip.endDate}.`;
    return null;
  }, [trip, from, to]);

  const add = useMutation({
    mutationFn: () =>
      createStop(tripId!, { cityId: city!.id, arrivalDate: from, departureDate: to }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast(`${city?.name} added to your trip`, 'success');
      onClose();
      navigate(`/trips/${tripId}/build`);
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const reset = () => {
    setTripId(null);
    setArrivalDate('');
    setDepartureDate('');
  };

  if (!city) return null;

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={`Add ${city.name} to a trip`}
    >
      <div className="space-y-4 pb-2">
        {trips.isLoading ? (
          <LoadingSkeleton count={3} />
        ) : editable.length === 0 ? (
          <EmptyState
            title="No trips to add to"
            message="Create a trip first, then add cities to it."
            action={
              <Button
                className="rounded-2xl"
                onClick={() => {
                  onClose();
                  navigate('/trips/new');
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Create a trip
              </Button>
            }
          />
        ) : (
          <>
            <div className="space-y-2">
              <Label>Choose a trip</Label>
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {editable.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTripId(t.id);
                      setArrivalDate('');
                      setDepartureDate('');
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors',
                      tripId === t.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted',
                    )}
                    aria-pressed={tripId === t.id}
                  >
                    <img
                      src={t.coverImageUrl ?? fallbackImage(t.name, 100, 100)}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-xl object-cover"
                      loading="lazy"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{t.name}</span>
                      <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />
                        {formatDateRange(t.startDate, t.endDate)}
                        <span aria-hidden>·</span>
                        <MapPin className="h-3 w-3" />
                        {t.stopCount}
                      </span>
                    </span>
                    {tripId === t.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                ))}
              </div>
            </div>

            {tripId && trip && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="add-arrival">Arrival</Label>
                    <Input
                      id="add-arrival"
                      type="date"
                      min={trip.startDate}
                      max={trip.endDate}
                      value={from}
                      onChange={(e) => setArrivalDate(e.target.value)}
                      className="rounded-2xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="add-departure">Departure</Label>
                    <Input
                      id="add-departure"
                      type="date"
                      min={from}
                      max={trip.endDate}
                      value={to}
                      onChange={(e) => setDepartureDate(e.target.value)}
                      className="rounded-2xl"
                    />
                  </div>
                </div>

                {dateError && (
                  <p
                    className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
                    role="alert"
                  >
                    {dateError}
                  </p>
                )}

                <Button
                  className="w-full rounded-2xl"
                  size="lg"
                  disabled={!!dateError || add.isPending || !from || !to}
                  onClick={() => add.mutate()}
                >
                  {add.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding…
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add stop
                    </>
                  )}
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  );
}
