import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/GlassCard';
import type { Stop } from '@/types';

interface RoutePreviewProps {
  stops: Stop[];
}

/**
 * Route map preview.
 *
 * Rather than pulling in a tile provider (and an API key), this projects the
 * stops' real latitude/longitude onto an equirectangular SVG and draws the
 * path between them — enough to convey the shape of the journey, works
 * offline, and costs nothing. The polyline animates in, per design.md's
 * "route drawing" motion.
 */
export function RoutePreview({ stops }: RoutePreviewProps) {
  const { points, viewBox } = useMemo(() => {
    if (stops.length === 0) return { points: [], viewBox: '0 0 100 60' };

    const coords = stops.map((s) => ({
      id: s.id,
      name: s.city.name,
      // Equirectangular: x from longitude, y from latitude (inverted).
      x: s.city.longitude,
      y: -s.city.latitude,
    }));

    const xs = coords.map((c) => c.x);
    const ys = coords.map((c) => c.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // A single stop (or a perfectly straight line) would give a zero-width
    // range and divide by zero, so pad the extent to a sane minimum.
    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    const pad = 12;
    const width = 100;
    const height = 60;

    const projected = coords.map((c) => ({
      ...c,
      px: pad + ((c.x - minX) / spanX) * (width - pad * 2),
      py: pad + ((c.y - minY) / spanY) * (height - pad * 2),
    }));

    return { points: projected, viewBox: `0 0 ${width} ${height}` };
  }, [stops]);

  if (points.length === 0) return null;

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.px} ${p.py}`).join(' ');

  return (
    <GlassCard className="overflow-hidden rounded-3xl p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Your route
      </p>

      <svg
        viewBox={viewBox}
        className="h-32 w-full md:h-40"
        role="img"
        aria-label={`Route through ${points.map((p) => p.name).join(', ')}`}
      >
        {points.length > 1 && (
          <motion.path
            d={path}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={0.8}
            strokeLinecap="round"
            strokeDasharray="2 2"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: 'easeInOut' }}
          />
        )}

        {points.map((point, index) => (
          <g key={point.id}>
            <motion.circle
              cx={point.px}
              cy={point.py}
              r={1.8}
              fill="var(--primary)"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 + index * 0.12, duration: 0.3 }}
            />
            <motion.text
              x={point.px}
              y={point.py - 3}
              textAnchor="middle"
              fill="currentColor"
              className="fill-foreground"
              style={{ fontSize: 3.2 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 + index * 0.12 }}
            >
              {point.name}
            </motion.text>
          </g>
        ))}
      </svg>

      <ol className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
        {points.map((point, index) => (
          <li key={point.id} className="flex items-center gap-1.5">
            {index > 0 && <span aria-hidden>→</span>}
            <span>{point.name}</span>
          </li>
        ))}
      </ol>
    </GlassCard>
  );
}
