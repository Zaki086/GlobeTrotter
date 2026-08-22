import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ItineraryActivityBlock } from '@/types';

interface TimelineTileProps {
  activity: ItineraryActivityBlock;
  isLast?: boolean;
}

export function TimelineTile({ activity, isLast }: TimelineTileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex gap-4"
    >
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 text-white">
          <MapPin className="h-4 w-4" />
        </div>
        {!isLast && <div className="mt-1 h-full w-0.5 bg-border" />}
      </div>
      <div
        className={cn(
          'mb-4 flex-1 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">{activity.name}</p>
            {activity.startTime && (
              <p className="text-sm text-muted-foreground">
                {activity.startTime}
                {activity.endTime ? ` - ${activity.endTime}` : ''} · {Math.round(activity.durationMinutes / 60)}h
              </p>
            )}
          </div>
          <span className="text-sm font-medium text-sky-600 dark:text-sky-400">
            ${activity.cost}
          </span>
        </div>
        {activity.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{activity.description}</p>
        )}
      </div>
    </motion.div>
  );
}
