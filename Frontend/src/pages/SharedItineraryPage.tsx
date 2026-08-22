import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  Check,
  Copy,
  Compass,
  Eye,
  Link2,
  MapPin,
  QrCode,
  Users,
  Wallet,
} from 'lucide-react';
import { copySharedItinerary, getSharedItinerary } from '@/services/share';
import { GlassCard } from '@/components/GlassCard';
import { BottomSheet } from '@/components/BottomSheet';
import { TimelineTile } from '@/components/TimelineTile';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorState } from '@/components/ErrorState';
import { QrCanvas } from '@/components/QrCanvas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { fallbackImage, formatDateRange, formatDateWithWeekday, formatMoney } from '@/lib/format';

/**
 * The public, read-only itinerary — the "storytelling" surface from design.md.
 * Full-bleed hero, animated route, day-by-day timeline, and a copy CTA.
 */
export function SharedItineraryPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [copyOpen, setCopyOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStart, setNewStart] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['public-itinerary', slug],
    queryFn: () => getSharedItinerary(slug),
    enabled: !!slug,
  });

  const copyTrip = useMutation({
    mutationFn: () =>
      copySharedItinerary(slug, {
        name: newName.trim() || undefined,
        startDate: newStart || undefined,
      }),
    onSuccess: (trip) => {
      toast('Itinerary copied to your trips', 'success');
      navigate(`/trips/${trip.id}`);
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4">
        <div className="h-72 animate-pulse rounded-3xl bg-muted" />
        <LoadingSkeleton count={3} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorState
          title="This itinerary isn't available"
          message={
            error instanceof Error
              ? error.message
              : 'The link may have been revoked or expired.'
          }
          onRetry={() => void refetch()}
        />
        <Button
          variant="outline"
          className="mt-4 w-full rounded-2xl"
          onClick={() => navigate('/')}
        >
          Go to GlobeTrotter
        </Button>
      </div>
    );
  }

  const { trip, summary, timeline, budget } = data;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(data.shareUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast('Could not copy the link', 'error');
    }
  };

  return (
    <div className="pb-16">
      {/* Cinematic hero */}
      <div className="relative h-[60vh] min-h-[380px] w-full overflow-hidden">
        <motion.img
          src={trip.coverImageUrl ?? fallbackImage(trip.name)}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          initial={{ scale: 1.08, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="hero-scrim absolute inset-0" />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 rounded-full bg-black/35 px-3 py-2 text-sm font-medium text-white backdrop-blur-md"
          >
            <Compass className="h-4 w-4" />
            GlobeTrotter
          </button>
          <span className="rounded-full bg-black/35 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md">
            <Eye className="mr-1 inline h-3 w-3" />
            {data.viewCount} views
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="absolute inset-x-0 bottom-0 mx-auto max-w-4xl p-6 md:p-8"
        >
          <span className="mb-3 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
            Shared by {data.sharedBy}
          </span>
          <h1 className="text-3xl font-semibold leading-tight text-white text-balance md:text-5xl">
            {trip.name}
          </h1>
          {trip.description && (
            <p className="mt-2 max-w-2xl text-sm text-white/85 md:text-base">
              {trip.description}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/85">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              {formatDateRange(trip.startDate, trip.endDate)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {summary.totalCities} cities
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {trip.travelers} travelers
            </span>
          </div>
        </motion.div>
      </div>

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 md:px-8">
        {/* Route */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">The route</h2>
          <div className="flex flex-wrap items-center gap-2">
            {data.list.map((stop, index) => (
              <motion.span
                key={stop.stopId}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08, duration: 0.28 }}
                className="flex items-center gap-2"
              >
                {index > 0 && <span className="text-muted-foreground">→</span>}
                <span className="rounded-full bg-primary/10 px-3.5 py-1.5 text-sm font-medium text-primary">
                  {stop.city.name}
                </span>
              </motion.span>
            ))}
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Days" value={String(summary.totalDays)} />
          <Stat label="Cities" value={String(summary.totalCities)} />
          <Stat label="Activities" value={String(summary.totalActivities)} />
          <Stat
            label="Estimated"
            value={budget ? formatMoney(budget.total, budget.currency) : '—'}
          />
        </section>

        {/* Budget */}
        {budget && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Wallet className="h-5 w-5 text-primary" />
              Cost summary
            </h2>
            <GlassCard className="rounded-3xl p-5">
              <p className="text-3xl font-semibold tabular-nums">
                {formatMoney(budget.total, budget.currency)}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {formatMoney(budget.perDayAverage, budget.currency)} per day
              </p>

              <div className="mt-4 space-y-2">
                {(
                  [
                    ['Transport', budget.breakdown.transport],
                    ['Stay', budget.breakdown.stay],
                    ['Meals', budget.breakdown.meals],
                    ['Activities', budget.breakdown.activities],
                    ['Other', budget.breakdown.other],
                  ] as const
                )
                  .filter(([, value]) => value > 0)
                  .map(([label, value]) => {
                    const percent = budget.total > 0 ? (value / budget.total) * 100 : 0;
                    return (
                      <div key={label}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium tabular-nums">
                            {formatMoney(value, budget.currency)}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <motion.div
                            className="h-full rounded-full bg-primary"
                            initial={{ width: 0 }}
                            whileInView={{ width: `${percent}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </GlassCard>
          </section>
        )}

        {/* Day timeline */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Day by day</h2>

          {timeline.map((day, index) => (
            <motion.div
              key={day.date}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.2) }}
            >
              <GlassCard className="rounded-3xl p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-primary">
                      Day {day.dayNumber}
                    </p>
                    <h3 className="text-base font-semibold">{formatDateWithWeekday(day.date)}</h3>
                    {day.city && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {day.city.name}
                      </p>
                    )}
                  </div>
                  {day.dayCost > 0 && (
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatMoney(day.dayCost, trip.currency)}
                    </p>
                  )}
                </div>

                {day.activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">A free day.</p>
                ) : (
                  <ol>
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
          ))}
        </section>

        {/* Share + copy */}
        <section className="grid gap-3 sm:grid-cols-2">
          <GlassCard className="rounded-3xl p-5">
            <h3 className="mb-2 flex items-center gap-2 text-base font-semibold">
              <Link2 className="h-4 w-4 text-primary" />
              Share this trip
            </h3>
            <div className="flex items-center gap-2 rounded-2xl border border-border p-3">
              <span className="min-w-0 flex-1 truncate text-xs">{data.shareUrl}</span>
              <button
                onClick={() => void copyLink()}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Copy link"
              >
                {linkCopied ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            <Button
              variant="outline"
              className="mt-3 w-full rounded-2xl"
              onClick={() => setQrOpen(true)}
            >
              <QrCode className="mr-2 h-4 w-4" />
              Show QR code
            </Button>
          </GlassCard>

          <GlassCard className="flex flex-col justify-between rounded-3xl p-5">
            <div>
              <h3 className="mb-1 text-base font-semibold">Make it yours</h3>
              <p className="text-sm text-muted-foreground">
                {data.allowCopy
                  ? 'Copy this plan into your account and edit it freely.'
                  : 'The owner has not enabled copying for this itinerary.'}
              </p>
            </div>
            <Button
              className="mt-4 w-full rounded-2xl"
              size="lg"
              disabled={!data.allowCopy}
              onClick={() => (isAuthenticated ? setCopyOpen(true) : navigate('/login'))}
            >
              <Copy className="mr-2 h-4 w-4" />
              {isAuthenticated ? 'Copy this trip' : 'Sign in to copy'}
            </Button>
          </GlassCard>
        </section>

        <p className="text-center text-xs text-muted-foreground">
          Read-only view · {data.copyCount} {data.copyCount === 1 ? 'traveler has' : 'travelers have'}{' '}
          copied this
        </p>
      </div>

      {/* QR sheet */}
      <BottomSheet open={qrOpen} onClose={() => setQrOpen(false)} title="Scan to open">
        <div className="flex flex-col items-center gap-4 pb-4">
          <div className="rounded-3xl bg-white p-4">
            <QrCanvas value={data.shareUrl} size={200} />
          </div>
          <p className="text-center text-sm text-muted-foreground">{data.shareUrl}</p>
        </div>
      </BottomSheet>

      {/* Copy sheet */}
      <BottomSheet open={copyOpen} onClose={() => setCopyOpen(false)} title="Copy this itinerary">
        <div className="space-y-4 pb-2">
          <p className="text-sm text-muted-foreground">
            You'll get your own private draft with every stop and activity. Change anything you
            like.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="copy-name">Trip name</Label>
            <Input
              id="copy-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`${trip.name} (copy)`}
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="copy-start">New start date (optional)</Label>
            <Input
              id="copy-start"
              type="date"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
              className="rounded-2xl"
            />
            <p className="text-xs text-muted-foreground">
              The whole plan shifts together, keeping the gaps between stops.
            </p>
          </div>

          <Button
            className="w-full rounded-2xl"
            size="lg"
            disabled={copyTrip.isPending}
            onClick={() => copyTrip.mutate()}
          >
            {copyTrip.isPending ? 'Copying…' : 'Copy to my trips'}
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard className="rounded-2xl p-4 text-center">
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </GlassCard>
  );
}
