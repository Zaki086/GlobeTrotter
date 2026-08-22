import { useEffect, useState } from 'react';
import { Loader2, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NightsStepperProps {
  nights: number;
  onChange: (nights: number) => void;
  disabled?: boolean;
  pending?: boolean;
  max?: number;
  className?: string;
}

/**
 * The "− 4 nights +" control.
 *
 * Tapping it changes the length of a stay, and the server re-flows every later
 * stop's dates. Because that is a whole-itinerary write, the taps are debounced
 * and the displayed count updates optimistically — otherwise holding "+" would
 * fire a cascade per press and the number would visibly lag the finger.
 */
export function NightsStepper({
  nights,
  onChange,
  disabled,
  pending,
  max = 60,
  className,
}: NightsStepperProps) {
  const [local, setLocal] = useState(nights);

  // Re-sync when the server's value changes underneath us (another edit, a
  // refetch, or the mutation settling on a different number).
  useEffect(() => setLocal(nights), [nights]);

  useEffect(() => {
    if (local === nights) return;
    const timer = window.setTimeout(() => onChange(local), 500);
    return () => window.clearTimeout(timer);
  }, [local, nights, onChange]);

  const step = (delta: number) =>
    setLocal((current) => Math.min(max, Math.max(0, current + delta)));

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-full border border-border bg-card px-1 py-1',
        disabled && 'opacity-50',
        className,
      )}
    >
      <button
        onClick={() => step(-1)}
        disabled={disabled || local <= 0}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
        aria-label="One night fewer"
      >
        <Minus className="h-4 w-4" />
      </button>

      <span className="flex min-w-[3.75rem] flex-col items-center leading-none">
        <span className="flex items-center gap-1 text-sm font-semibold tabular-nums">
          {local}
          {pending && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
        </span>
        <span className="mt-0.5 text-[10px] text-muted-foreground">
          {local === 1 ? 'night' : 'nights'}
        </span>
      </span>

      <button
        onClick={() => step(1)}
        disabled={disabled || local >= max}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
        aria-label="One night more"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
