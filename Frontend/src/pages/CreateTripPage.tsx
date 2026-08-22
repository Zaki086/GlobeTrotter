import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  Image as ImageIcon,
  Lightbulb,
  Loader2,
  MapPin,
  Users,
  Wallet,
} from 'lucide-react';
import { createTrip } from '@/services/trip';
import { getPopularCities } from '@/services/city';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CURRENCIES, DEFAULT_CURRENCY } from '@/lib/constants';
import { fallbackImage, formatDateRange, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Trip creation as a stepper rather than one long form — design.md replaces
 * "traditional forms" with a step-per-screen flow on mobile.
 *
 * Each step validates only its own field, so the user is never blocked by an
 * error belonging to a screen they have not reached yet.
 */
const STEPS = [
  { id: 'name', title: 'What should we call it?', icon: MapPin },
  { id: 'dates', title: 'When are you going?', icon: Calendar },
  { id: 'travelers', title: 'Who is coming?', icon: Users },
  { id: 'budget', title: "What's your budget?", icon: Wallet },
  { id: 'cover', title: 'Pick a cover', icon: ImageIcon },
  { id: 'review', title: 'Ready to go?', icon: Check },
] as const;

const COVER_PRESETS = [
  { label: 'Coastline', seed: 'cover-coast' },
  { label: 'Mountains', seed: 'cover-mountain' },
  { label: 'City lights', seed: 'cover-city' },
  { label: 'Desert', seed: 'cover-desert' },
  { label: 'Forest', seed: 'cover-forest' },
  { label: 'Islands', seed: 'cover-island' },
];

interface FormState {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  travelers: number;
  currency: string;
  plannedTotal: string;
  coverImageUrl: string;
}

function todayPlus(days: number): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days))
    .toISOString()
    .slice(0, 10);
}

export function CreateTripPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [form, setForm] = useState<FormState>({
    name: '',
    description: '',
    startDate: todayPlus(30),
    endDate: todayPlus(37),
    travelers: 2,
    currency: DEFAULT_CURRENCY,
    plannedTotal: '',
    coverImageUrl: '',
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const nights = useMemo(() => {
    const from = Date.parse(form.startDate);
    const to = Date.parse(form.endDate);
    if (Number.isNaN(from) || Number.isNaN(to)) return 0;
    return Math.max(0, Math.round((to - from) / 86_400_000));
  }, [form.startDate, form.endDate]);

  /** Per-step validation — returns an error message, or null when valid. */
  const stepError = useMemo<string | null>(() => {
    switch (STEPS[step].id) {
      case 'name':
        if (form.name.trim().length < 2) return 'Give your trip a name of at least 2 characters.';
        return null;
      case 'dates':
        if (!form.startDate || !form.endDate) return 'Pick both a start and an end date.';
        if (Date.parse(form.endDate) < Date.parse(form.startDate))
          return 'The end date must be on or after the start date.';
        if (nights > 730) return 'A trip may not span more than 730 days.';
        return null;
      case 'travelers':
        if (form.travelers < 1) return 'At least one traveler is required.';
        if (form.travelers > 50) return 'That is more than 50 travelers.';
        return null;
      case 'budget':
        if (form.plannedTotal && Number(form.plannedTotal) < 0)
          return 'A budget cannot be negative.';
        return null;
      default:
        return null;
    }
  }, [step, form, nights]);

  // Popular destinations, shown on the review step as a starting point.
  const suggestions = useQuery({
    queryKey: ['cities', 'popular'],
    queryFn: () => getPopularCities(6),
  });

  const mutation = useMutation({
    mutationFn: () =>
      createTrip({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        coverImageUrl: form.coverImageUrl || undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        travelers: form.travelers,
        currency: form.currency,
        plannedTotal: form.plannedTotal ? Number(form.plannedTotal) : undefined,
      }),
    onSuccess: (trip) => {
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast('Trip created — now add your first stop', 'success');
      navigate(`/trips/${trip.id}/build`);
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const goNext = () => {
    if (stepError) return;
    if (step === STEPS.length - 1) {
      mutation.mutate();
      return;
    }
    setDirection(1);
    setStep((s) => s + 1);
  };

  const goBack = () => {
    if (step === 0) {
      navigate(-1);
      return;
    }
    setDirection(-1);
    setStep((s) => s - 1);
  };

  const CurrentIcon = STEPS[step].icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col">
      {/* Progress */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={goBack}
            className="touch-target -ml-2 flex items-center gap-1 rounded-xl px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <span className="text-sm tabular-nums text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </span>
        </div>

        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-label="Trip creation progress"
        >
          <motion.div
            className="h-full rounded-full bg-primary"
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      <GlassCard className="flex flex-1 flex-col rounded-3xl p-6 md:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CurrentIcon className="h-5 w-5" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-balance md:text-2xl">
            {STEPS[step].title}
          </h1>
        </div>

        <div className="flex-1">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={STEPS[step].id}
              custom={direction}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-5"
            >
              {STEPS[step].id === 'name' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="trip-name">Trip name</Label>
                    <Input
                      id="trip-name"
                      value={form.name}
                      onChange={(e) => set('name', e.target.value)}
                      placeholder="Cherry Blossom Japan"
                      autoFocus
                      maxLength={160}
                      className="rounded-2xl text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trip-description">Description (optional)</Label>
                    <textarea
                      id="trip-description"
                      value={form.description}
                      onChange={(e) => set('description', e.target.value)}
                      placeholder="Two weeks from Tokyo down to Osaka, timed for the sakura."
                      rows={4}
                      maxLength={5000}
                      className="w-full resize-none rounded-2xl border border-input bg-transparent px-4 py-3 text-sm outline-none transition-colors focus-visible:border-primary"
                    />
                  </div>
                </>
              )}

              {STEPS[step].id === 'dates' && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="start-date">Start date</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={form.startDate}
                        onChange={(e) => set('startDate', e.target.value)}
                        className="rounded-2xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end-date">End date</Label>
                      <Input
                        id="end-date"
                        type="date"
                        min={form.startDate}
                        value={form.endDate}
                        onChange={(e) => set('endDate', e.target.value)}
                        className="rounded-2xl"
                      />
                    </div>
                  </div>

                  {nights > 0 && !stepError && (
                    <p className="rounded-2xl bg-primary/10 px-4 py-3 text-sm text-primary">
                      {nights + 1} days · {nights} {nights === 1 ? 'night' : 'nights'}
                    </p>
                  )}
                </>
              )}

              {STEPS[step].id === 'travelers' && (
                <div className="space-y-4">
                  <Label>Travelers</Label>
                  <div className="flex items-center justify-center gap-6">
                    <button
                      onClick={() => set('travelers', Math.max(1, form.travelers - 1))}
                      className="touch-target flex items-center justify-center rounded-2xl border border-border text-xl font-medium transition-colors hover:bg-muted disabled:opacity-40"
                      disabled={form.travelers <= 1}
                      aria-label="Fewer travelers"
                    >
                      −
                    </button>
                    <span className="w-16 text-center text-4xl font-semibold tabular-nums">
                      {form.travelers}
                    </span>
                    <button
                      onClick={() => set('travelers', Math.min(50, form.travelers + 1))}
                      className="touch-target flex items-center justify-center rounded-2xl border border-border text-xl font-medium transition-colors hover:bg-muted disabled:opacity-40"
                      disabled={form.travelers >= 50}
                      aria-label="More travelers"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    Activity and meal costs are multiplied by this number.
                  </p>
                </div>
              )}

              {STEPS[step].id === 'budget' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <div className="snap-x-rail">
                      {CURRENCIES.map((code) => (
                        <button
                          key={code}
                          onClick={() => set('currency', code)}
                          className={cn(
                            'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                            form.currency === code
                              ? 'bg-primary text-primary-foreground'
                              : 'border border-border text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="planned-total">Planned budget (optional)</Label>
                    <Input
                      id="planned-total"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={form.plannedTotal}
                      onChange={(e) => set('plannedTotal', e.target.value)}
                      placeholder="5000"
                      className="rounded-2xl text-base"
                    />
                    <p className="text-xs text-muted-foreground">
                      We'll warn you when the itinerary goes over this.
                    </p>
                  </div>
                </>
              )}

              {STEPS[step].id === 'cover' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {COVER_PRESETS.map((preset) => {
                      const url = fallbackImage(preset.seed, 600, 400);
                      const selected = form.coverImageUrl === url;
                      return (
                        <button
                          key={preset.seed}
                          onClick={() => set('coverImageUrl', selected ? '' : url)}
                          className={cn(
                            'relative aspect-[3/2] overflow-hidden rounded-2xl ring-offset-2 ring-offset-background transition-all',
                            selected ? 'ring-2 ring-primary' : 'hover:opacity-90',
                          )}
                          aria-pressed={selected}
                        >
                          <img src={url} alt={preset.label} className="h-full w-full object-cover" loading="lazy" />
                          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-left text-xs font-medium text-white">
                            {preset.label}
                          </span>
                          {selected && (
                            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cover-url">Or paste an image URL</Label>
                    <Input
                      id="cover-url"
                      type="url"
                      value={form.coverImageUrl}
                      onChange={(e) => set('coverImageUrl', e.target.value)}
                      placeholder="https://…"
                      className="rounded-2xl"
                    />
                  </div>
                </div>
              )}

              {STEPS[step].id === 'review' && (
                <div className="space-y-4">
                  {/* Wireframe screen 4: "Suggestions for places to visit /
                      activities to perform" sit alongside the trip form so the
                      traveler has somewhere to start once the trip exists. */}
                  {(suggestions.data?.length ?? 0) > 0 && (
                    <div className="space-y-2">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <Lightbulb className="h-4 w-4 text-accent" />
                        Places you could add
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {suggestions.data?.slice(0, 6).map((city) => (
                          <div
                            key={city.id}
                            className="relative aspect-[4/3] overflow-hidden rounded-xl"
                            title={`${city.name}, ${city.country}`}
                          >
                            <img
                              src={city.imageUrl ?? fallbackImage(city.name)}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                            <div className="hero-scrim absolute inset-0" />
                            <span className="absolute inset-x-0 bottom-0 truncate p-1.5 text-[11px] font-medium text-white">
                              {city.name}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        You'll pick your stops right after creating the trip.
                      </p>
                    </div>
                  )}

                  <div className="relative h-40 overflow-hidden rounded-2xl">
                    <img
                      src={form.coverImageUrl || fallbackImage(form.name || 'trip')}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <div className="hero-scrim absolute inset-0" />
                    <p className="absolute inset-x-0 bottom-0 p-4 text-lg font-semibold text-white">
                      {form.name}
                    </p>
                  </div>

                  <dl className="divide-y divide-border rounded-2xl border border-border">
                    <ReviewRow label="Dates" value={formatDateRange(form.startDate, form.endDate)} />
                    <ReviewRow label="Duration" value={`${nights + 1} days`} />
                    <ReviewRow label="Travelers" value={String(form.travelers)} />
                    <ReviewRow
                      label="Budget"
                      value={
                        form.plannedTotal
                          ? formatMoney(Number(form.plannedTotal), form.currency)
                          : `Not set (${form.currency})`
                      }
                    />
                  </dl>

                  {form.description && (
                    <p className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                      {form.description}
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {stepError && (
          <p className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
            {stepError}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          {step > 0 && (
            <Button variant="outline" className="rounded-2xl" onClick={goBack}>
              Back
            </Button>
          )}
          <Button
            className="flex-1 rounded-2xl"
            onClick={goNext}
            disabled={!!stepError || mutation.isPending}
            size="lg"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : isLast ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Create trip
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}
