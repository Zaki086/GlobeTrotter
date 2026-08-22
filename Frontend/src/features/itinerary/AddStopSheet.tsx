import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Loader2, MapPin, Search } from 'lucide-react';
import { searchCities } from '@/services/city';
import { createStop } from '@/services/stop';
import { BottomSheet } from '@/components/BottomSheet';
import { SearchBar } from '@/components/SearchBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useToast } from '@/hooks/use-toast';
import { costLevel, fallbackImage } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { City, TripDetail } from '@/types';

interface AddStopSheetProps {
  open: boolean;
  onClose: () => void;
  trip: TripDetail;
  onCreated: () => void;
}

/**
 * Two-step sheet: pick a city, then set the dates and costs.
 *
 * Dates default to the day after the last stop ends (or the trip start), which
 * is almost always what the traveler wants and keeps them inside the trip
 * range the backend enforces.
 */
export function AddStopSheet({ open, onClose, trip, onCreated }: AddStopSheetProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<City | null>(null);
  const debounced = useDebouncedValue(search, 300);

  const lastStop = trip.stops[trip.stops.length - 1];
  const defaultArrival = lastStop?.departureDate ?? trip.startDate;

  const [arrivalDate, setArrivalDate] = useState(defaultArrival);
  const [departureDate, setDepartureDate] = useState(trip.endDate);
  const [accommodationCost, setAccommodationCost] = useState('');
  const [transportCost, setTransportCost] = useState('');
  const [mealsPerDayCost, setMealsPerDayCost] = useState('');

  // Reset whenever the sheet reopens, so a previous attempt never leaks in.
  useEffect(() => {
    if (!open) return;
    setSearch('');
    setSelected(null);
    setArrivalDate(defaultArrival);
    setDepartureDate(trip.endDate);
    setAccommodationCost('');
    setTransportCost('');
    setMealsPerDayCost('');
  }, [open, defaultArrival, trip.endDate]);

  const { data, isLoading } = useQuery({
    queryKey: ['cities', { search: debounced }],
    queryFn: () => searchCities({ search: debounced || undefined, limit: 20 }),
    enabled: open,
  });

  const dateError = useMemo(() => {
    if (!arrivalDate || !departureDate) return 'Pick both dates.';
    if (Date.parse(departureDate) < Date.parse(arrivalDate))
      return 'Departure must be on or after arrival.';
    if (Date.parse(arrivalDate) < Date.parse(trip.startDate))
      return `Arrival cannot be before the trip starts (${trip.startDate}).`;
    if (Date.parse(departureDate) > Date.parse(trip.endDate))
      return `Departure cannot be after the trip ends (${trip.endDate}).`;
    return null;
  }, [arrivalDate, departureDate, trip.startDate, trip.endDate]);

  const mutation = useMutation({
    mutationFn: () =>
      createStop(trip.id, {
        cityId: selected!.id,
        arrivalDate,
        departureDate,
        accommodationCost: accommodationCost ? Number(accommodationCost) : 0,
        transportCost: transportCost ? Number(transportCost) : 0,
        mealsPerDayCost: mealsPerDayCost ? Number(mealsPerDayCost) : 0,
      }),
    onSuccess: () => {
      onCreated();
      toast(`${selected?.name} added to your itinerary`, 'success');
      onClose();
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={selected ? `Add ${selected.name}` : 'Add a stop'}
    >
      {!selected ? (
        <div className="space-y-4 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <SearchBar
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cities or countries…"
              aria-label="Search cities"
              className="pl-10"
              autoFocus
            />
          </div>

          <div className="max-h-[45vh] space-y-2 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            ) : (data?.items.length ?? 0) === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No cities match “{search}”.
              </p>
            ) : (
              data?.items.map((city) => {
                const cost = costLevel(city.costIndex);
                return (
                  <button
                    key={city.id}
                    onClick={() => setSelected(city)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted"
                  >
                    <img
                      src={city.imageUrl ?? fallbackImage(city.name, 120, 120)}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-xl object-cover"
                      loading="lazy"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{city.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {city.country} · {city.activityCount} activities
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-primary">
                      {cost.symbols}
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
            className="flex items-center gap-2 rounded-2xl border border-border p-3 text-left"
          >
            <img
              src={selected.imageUrl ?? fallbackImage(selected.name, 120, 120)}
              alt=""
              className="h-10 w-10 rounded-xl object-cover"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{selected.name}</span>
              <span className="block text-xs text-muted-foreground">{selected.country}</span>
            </span>
            <span className="text-xs font-medium text-primary">Change</span>
          </button>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="stop-arrival">Arrival</Label>
              <Input
                id="stop-arrival"
                type="date"
                min={trip.startDate}
                max={trip.endDate}
                value={arrivalDate}
                onChange={(e) => setArrivalDate(e.target.value)}
                className="rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stop-departure">Departure</Label>
              <Input
                id="stop-departure"
                type="date"
                min={arrivalDate}
                max={trip.endDate}
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                className="rounded-2xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <CostField
              id="stop-transport"
              label="Transport"
              value={transportCost}
              onChange={setTransportCost}
            />
            <CostField
              id="stop-stay"
              label="Stay"
              value={accommodationCost}
              onChange={setAccommodationCost}
            />
            <CostField
              id="stop-meals"
              label="Meals/day"
              value={mealsPerDayCost}
              onChange={setMealsPerDayCost}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Meals are per person, per day. Everything is in {trip.currency}.
          </p>

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
                Add stop
              </>
            )}
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}

function CostField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn('rounded-2xl')}
      />
    </div>
  );
}

/** Re-exported for the empty-state illustration in the builder. */
export const AddStopIcon = MapPin;
