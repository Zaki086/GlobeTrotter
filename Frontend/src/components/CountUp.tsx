import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  value: number;
  /** Milliseconds; design.md puts motion in the 250–300ms band. */
  duration?: number;
  format?: (value: number) => string;
  className?: string;
}

/**
 * Animates a number from its previous value to the next one — the "budget
 * update: count animation" in design.md.
 *
 * Uses requestAnimationFrame rather than a CSS transition because the value
 * is text, and eases out so the final digits settle rather than snapping.
 * Honours `prefers-reduced-motion` by jumping straight to the value.
 */
export function CountUp({ value, duration = 700, format, className }: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    const from = previous.current;
    const to = value;
    previous.current = value;

    if (from === to) {
      setDisplay(to);
      return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setDisplay(to);
      return;
    }

    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);

      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        setDisplay(to);
      }
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    };
  }, [value, duration]);

  const rendered = format ? format(display) : Math.round(display).toLocaleString();

  return (
    <span className={className} aria-label={format ? format(value) : String(value)}>
      {rendered}
    </span>
  );
}
