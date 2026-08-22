import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BedDouble, Check, Loader2, MapPin, Sparkles, TrendingUp, Utensils } from 'lucide-react';
import { searchCities } from '@/services/city';
import { estimateStop } from '@/services/estimate';
import { createStop } from '@/services/stop';
import { BottomSheet } from '@/components/BottomSheet';
import { SearchBar } from '@/components/SearchBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useToast } from '@/hooks/use-toast';
import { costLevel, fallbackImage, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { City, ComfortTier, TripDetail } from '@/types';

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
  const [tier, setTier] = useState<ComfortTier>('MID');

  // Reset whenever the sheet reopens, so a previous attempt never leaks in.
  useEffect(() => {
    if (!open) return;
    setSearch('');
    setSelected(null);
    setArrivalDate(defaultArrival);
    setDepartureDate(trip.endDate);
    setTier('MID');
  }, [open, defaultArrival, trip.endDate]);

  const { data, isLoading } = useQuery({
    queryKey: ['cities', { search: debounced }],
    queryFn: () => searchCities({ search: debounced || undefined, limit: 20 }),
    enabled: open,
  });

  /**
   * Live cost estimate for the chosen city, dates and comfort level. This is
   * what removes the guesswork — the traveller picks a tier and the nightly
   * rate, meals and the transport leg from the previous stop all follow.
   */
  const estimate = useQuery({
    queryKey: ['estimate', selected?.id, arrivalDate, departureDate, trip.travelers, tier, lastStop?.city.id],
    queryFn: () =>
      estimateStop({
        cityId: selected!.id,
        arrivalDate,
        departureDate,
        travelers: trip.travelers,
        tier,
        fromCityId: lastStop?.city.id,
      }),
    enabled: !!selected && !!arrivalDate && !!departureDate,
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
        // Costs come from the engine rather than the keyboard.
        accommodationCost: estimate.data?.suggested.accommodationCost ?? 0,
        transportCost: estimate.data?.suggested.transportCost ?? 0,
        mealsPerDayCost: estimate.data?.suggested.mealsPerDayCost ?? 0,
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
          <SearchBar
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cities or countries…"
              aria-label="Search cities"
              autoFocus
          />

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

          {/* Comfort level — drives every number below it */}
          <div className="space-y-2">
            <Label>Comfort level</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['BUDGET', 'MID', 'LUXURY'] as ComfortTier[]).map((option) => {
                const band = estimate.data?.accommodation.options.find((o) => o.tier === option);
                return (
                  <button
                    key={option}
                    onClick={() => setTier(option)}
                    className={cn(
                      'rounded-2xl border px-2 py-2.5 text-center transition-colors',
                      tier === option
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted',
                    )}
                    aria-pressed={tier === option}
                  >
                    <span className="block text-xs font-semibold capitalize">
                      {option.toLowerCase()}
                    </span>
                    <span className="mt-0.5 block text-[11px] tabular-nums text-muted-foreground">
                      {band ? `${formatMoney(band.nightlyRate, trip.currency)}/night` : '—'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* What that works out to */}
          {estimate.isLoading ? (
            <div className="h-28 animate-pulse rounded-2xl bg-muted" />
          ) : estimate.data ? (
            <div className="space-y-2 rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Estimated automatically
                </span>
                <span className="text-muted-foreground">{estimate.data.season.label}</span>
              </div>

              <EstimateRow
                icon={BedDouble}
                label={`Stay · ${estimate.data.nights} ${estimate.data.nights === 1 ? 'night' : 'nights'} × ${estimate.data.rooms} room${estimate.data.rooms === 1 ? '' : 's'}`}
                value={formatMoney(estimate.data.accommodation.total, trip.currency)}
              />
              <EstimateRow
                icon={Utensils}
                label={`Meals · ${estimate.data.days} days × ${estimate.data.travelers}`}
                value={formatMoney(estimate.data.meals.total, trip.currency)}
              />
              {estimate.data.transport && (
                <EstimateRow
                  icon={TrendingUp}
                  label={`${estimate.data.transport.fromCity} → ${selected.name} · ${estimate.data.transport.distanceKm}km by ${estimate.data.transport.mode.toLowerCase()}`}
                  value={formatMoney(estimate.data.transport.total, trip.currency)}
                />
              )}

              <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
                <span>Total for this stop</span>
                <span className="tabular-nums">
                  {formatMoney(estimate.data.total, trip.currency)}
                </span>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Based on typical {selected.name} rates for this time of year. You can adjust any
                figure later from the builder.
              </p>
            </div>
          ) : null}

          {dateError && (
            <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
              {dateError}
            </p>
          )}

          <Button
            className="w-full rounded-2xl"
            size="lg"
            disabled={!!dateError || mutation.isPending || estimate.isLoading}
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

function EstimateRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BedDouble;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{label}</span>
      <span className="shrink-0 font-medium tabular-nums">{value}</span>
    </div>
  );
}

/** Re-exported for the empty-state illustration in the builder. */
export const AddStopIcon = MapPin;
