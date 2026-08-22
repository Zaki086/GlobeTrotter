import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, MapPin } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { TimelineTile } from './TimelineTile';
import type { ItineraryDay } from '@/types';

interface DayAccordionProps {
  day: ItineraryDay;
}

export function DayAccordion({ day }: DayAccordionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-slate-900">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-4 text-left"
        aria-expanded={open}
      >
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Day {day.dayNumber} · {day.weekday}
          </p>
          <p className="text-lg font-semibold">
            {format(parseISO(day.date), 'MMMM d')}
            {day.city && (
              <span className="ml-2 inline-flex items-center text-sm font-normal text-sky-600">
                <MapPin className="mr-1 h-3.5 w-3.5" />
                {day.city.name}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {day.activities.length} activities
          </span>
          <motion.div animate={{ rotate: open ? 180 : 0 }}>
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          </motion.div>
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border p-4">
              {day.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activities planned.</p>
              ) : (
                day.activities.map((activity, idx) => (
                  <TimelineTile
                    key={activity.id}
                    activity={activity}
                    isLast={idx === day.activities.length - 1}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
