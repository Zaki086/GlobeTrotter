import { Calendar, MapPin, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { TRIP_STATUS_LABELS } from '@/lib/constants';
import type { DashboardTripCard, TripSummary } from '@/types';

interface TripCardProps {
  trip: DashboardTripCard | TripSummary;
  onClick?: () => void;
}

export function TripCard({ trip, onClick }: TripCardProps) {
  const hero = trip.coverImageUrl ?? (('heroImage' in trip ? trip.heroImage : null) as string | null);
  const cities = 'cities' in trip ? trip.cities : trip.destinations;
  return (
    <motion.div
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group cursor-pointer overflow-hidden rounded-3xl bg-white shadow-sm transition-shadow hover:shadow-xl dark:bg-slate-900"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={hero ?? '/placeholder.svg'}
          alt={trip.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-4 top-4">
          <Badge variant="default" className="bg-white/90 text-foreground backdrop-blur-sm">
            {TRIP_STATUS_LABELS[trip.status]}
          </Badge>
        </div>
      </div>
      <div className="p-4">
        <h3 className="truncate text-lg font-semibold">{trip.name}</h3>
        <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {format(parseISO(trip.startDate), 'MMM d')} - {format(parseISO(trip.endDate), 'MMM d, yyyy')}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {cities?.length ? cities.join(', ') : 'No stops'}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-4 w-4" />
            {trip.travelers}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm font-medium text-sky-600 dark:text-sky-400">
            {trip.currency} {Math.round(trip.estimatedTotal).toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">
            {trip.durationDays} days
          </span>
        </div>
      </div>
    </motion.div>
  );
}
