import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Shared building blocks for the admin console.
 *
 * These deliberately do NOT reuse GlassCard and friends — the console runs on
 * its own dark slate palette so an operator can never mistake it for the
 * traveller app, and the traveller components are theme-reactive.
 */

export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-2xl border border-white/10 bg-slate-900/60', className)}>
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 border-b border-white/10 px-5 py-4">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold text-slate-100">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function AdminHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-100 md:text-2xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  tone = 'default',
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  delta?: string;
  tone?: 'default' | 'accent' | 'positive' | 'negative';
}) {
  const toneClass = {
    default: 'text-slate-300 bg-white/5',
    accent: 'text-accent bg-accent/15',
    positive: 'text-emerald-400 bg-emerald-400/10',
    negative: 'text-rose-400 bg-rose-400/10',
  }[tone];

  return (
    <Panel className="p-4">
      <span className={cn('mb-3 flex h-8 w-8 items-center justify-center rounded-lg', toneClass)}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="text-2xl font-semibold tabular-nums text-slate-100">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
      {delta && <p className="mt-1 text-[11px] font-medium text-accent">{delta}</p>}
    </Panel>
  );
}

/** Dense, scrollable table shell — the console's primary data surface. */
export function DataTable({
  columns,
  children,
  empty,
}: {
  columns: string[];
  children: React.ReactNode;
  empty?: boolean;
}) {
  if (empty) {
    return <p className="px-5 py-10 text-center text-sm text-slate-500">Nothing to show.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <thead className="border-b border-white/10 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((col) => (
              <th key={col} scope="col" className="px-5 py-3 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({
  children,
  className,
  align = 'left',
}: {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'right';
}) {
  return (
    <td
      className={cn(
        'px-5 py-3 text-slate-300',
        align === 'right' && 'text-right tabular-nums',
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Tag({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'accent' | 'positive' | 'negative';
}) {
  const toneClass = {
    neutral: 'bg-white/5 text-slate-400',
    accent: 'bg-accent/15 text-accent',
    positive: 'bg-emerald-400/10 text-emerald-400',
    negative: 'bg-rose-400/10 text-rose-400',
  }[tone];

  return (
    <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-medium', toneClass)}>
      {children}
    </span>
  );
}

export function AdminSearch({
  value,
  onChange,
  placeholder = 'Search…',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="h-9 w-full max-w-xs rounded-lg border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-600 focus-visible:border-accent"
    />
  );
}

export function AdminButton({
  children,
  onClick,
  variant = 'default',
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'accent' | 'danger' | 'ghost';
  disabled?: boolean;
  className?: string;
}) {
  const variants = {
    default: 'border border-white/10 text-slate-300 hover:bg-white/5',
    accent: 'bg-accent text-white hover:opacity-90',
    danger: 'bg-rose-500/90 text-white hover:bg-rose-500',
    ghost: 'text-slate-400 hover:text-slate-100',
  }[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40',
        variants,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function AdminSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-white/5" />
      ))}
    </div>
  );
}
