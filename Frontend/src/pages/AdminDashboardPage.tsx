import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Activity as ActivityIcon,
  Building2,
  Link2,
  Map,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getAnalytics, listUsers } from '@/services/admin';
import { GlassCard } from '@/components/GlassCard';
import { CountUp } from '@/components/CountUp';
import { SectionHeader } from '@/components/SectionHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorState } from '@/components/ErrorState';
import { ACTIVITY_TYPE_LABELS, TRIP_STATUS_LABELS } from '@/lib/constants';
import { fallbackImage, formatDate, formatDateShort, formatMoney, initials } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TripStatus } from '@/types';

const WINDOWS = [7, 30, 90] as const;

export function AdminDashboardPage() {
  const [days, setDays] = useState<number>(30);

  const analytics = useQuery({
    queryKey: ['admin', 'analytics', days],
    queryFn: () => getAnalytics(days),
  });

  const users = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => listUsers({ limit: 10 }),
  });

  if (analytics.isLoading) return <LoadingSkeleton count={6} />;

  if (analytics.isError || !analytics.data) {
    return (
      <ErrorState title="Could not load analytics" onRetry={() => void analytics.refetch()} />
    );
  }

  const data = analytics.data;

  const growthSeries = data.userGrowth.map((point, index) => ({
    date: formatDateShort(point.date),
    users: point.cumulative,
    trips: data.tripGrowth[index]?.cumulative ?? 0,
  }));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Admin</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Platform analytics · generated {formatDate(data.generatedAt)}
          </p>
        </div>

        <div className="flex gap-2">
          {WINDOWS.map((value) => (
            <button
              key={value}
              onClick={() => setDays(value)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                days === value
                  ? 'bg-primary text-primary-foreground'
                  : 'glass text-muted-foreground hover:text-foreground',
              )}
              aria-pressed={days === value}
            >
              {value}d
            </button>
          ))}
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={Users}
          label="Total users"
          value={data.totals.users}
          delta={`+${data.users.newInWindow} in ${days}d`}
        />
        <Kpi
          icon={Map}
          label="Total trips"
          value={data.totals.trips}
          delta={`+${data.trips.newInWindow} in ${days}d`}
        />
        <Kpi
          icon={ActivityIcon}
          label="Scheduled activities"
          value={data.totals.scheduledActivities}
          delta={`${data.trips.averageActivitiesPerTrip} avg/trip`}
        />
        <Kpi
          icon={Link2}
          label="Share links"
          value={data.totals.activeShareLinks}
          delta={`${data.engagement.totalTripCopies} copies`}
        />
      </section>

      {/* Engagement */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Activation rate"
          value={`${data.users.activationRate}%`}
          hint="Users with ≥1 trip"
        />
        <MetricCard
          label="Active users"
          value={`${data.users.activeRate}%`}
          hint={`Signed in within ${days}d`}
        />
        <MetricCard
          label="Avg trip budget"
          value={formatMoney(data.engagement.avgTripBudget)}
          hint="Across all trips"
        />
        <MetricCard
          label="Share views"
          value={data.engagement.totalShareViews.toLocaleString()}
          hint="Public itinerary opens"
        />
      </section>

      {/* Growth */}
      <section className="space-y-3">
        <SectionHeader title="Growth" icon={TrendingUp} />
        <GlassCard className="rounded-3xl p-5">
          {growthSeries.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No signups in this window.
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthSeries} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="usersFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="tripsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 16,
                      border: '1px solid var(--border)',
                      background: 'var(--popover)',
                      color: 'var(--popover-foreground)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="users"
                    name="Users"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#usersFill)"
                  />
                  <Area
                    type="monotone"
                    dataKey="trips"
                    name="Trips"
                    stroke="var(--chart-3)"
                    strokeWidth={2}
                    fill="url(#tripsFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>
      </section>

      {/* Trips by status */}
      <section className="space-y-3">
        <SectionHeader title="Trips by status" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(Object.keys(data.trips.byStatus) as TripStatus[]).map((status) => (
            <GlassCard key={status} className="rounded-2xl p-4 text-center">
              <p className="text-xl font-semibold tabular-nums">
                {data.trips.byStatus[status]}
              </p>
              <p className="text-xs text-muted-foreground">{TRIP_STATUS_LABELS[status]}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Popular cities + activities */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <SectionHeader title="Popular cities" icon={Building2} />
          <GlassCard className="rounded-3xl p-2">
            {data.popularCities.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <ol>
                {data.popularCities.map((city, index) => (
                  <li
                    key={city.id}
                    className="flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-muted"
                  >
                    <span className="w-5 shrink-0 text-center text-sm font-semibold text-muted-foreground tabular-nums">
                      {index + 1}
                    </span>
                    <img
                      src={city.imageUrl ?? fallbackImage(city.name, 80, 80)}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-xl object-cover"
                      loading="lazy"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{city.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {city.country}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {city.tripCount}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </GlassCard>
        </div>

        <div className="space-y-3">
          <SectionHeader title="Popular activities" icon={ActivityIcon} />
          <GlassCard className="rounded-3xl p-2">
            {data.popularActivities.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <ol>
                {data.popularActivities.map((activity, index) => (
                  <li
                    key={activity.id}
                    className="flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-muted"
                  >
                    <span className="w-5 shrink-0 text-center text-sm font-semibold text-muted-foreground tabular-nums">
                      {index + 1}
                    </span>
                    <img
                      src={activity.imageUrl ?? fallbackImage(activity.name, 80, 80)}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-xl object-cover"
                      loading="lazy"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{activity.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {ACTIVITY_TYPE_LABELS[activity.type]} · {activity.city}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {activity.timesAdded}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </GlassCard>
        </div>
      </section>

      {/* Users table */}
      <section className="space-y-3">
        <SectionHeader
          title="Users"
          icon={Users}
          subtitle={users.data ? `${users.data.total} total` : undefined}
        />
        <GlassCard className="overflow-hidden rounded-3xl">
          {users.isLoading ? (
            <div className="p-4">
              <LoadingSkeleton count={3} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">User</th>
                    <th scope="col" className="px-4 py-3 font-medium">Role</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Trips</th>
                    <th scope="col" className="px-4 py-3 font-medium">Last seen</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.data?.items.map((user) => (
                    <tr key={user.id} className="transition-colors hover:bg-muted">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {initials(user.name)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{user.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {user.email}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'rounded-full px-2.5 py-1 text-xs font-medium',
                            user.role === 'ADMIN'
                              ? 'bg-accent/15 text-accent'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{user.tripCount}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 text-xs font-medium',
                            user.isActive ? 'text-success' : 'text-destructive',
                          )}
                        >
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              user.isActive ? 'bg-success' : 'bg-destructive',
                            )}
                          />
                          {user.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </section>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  delta,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  delta: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard className="rounded-2xl p-4">
        <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-2xl font-semibold tabular-nums">
          <CountUp value={value} />
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-[11px] font-medium text-primary">{delta}</p>
      </GlassCard>
    </motion.div>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <GlassCard className="rounded-2xl p-4">
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs font-medium">{label}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </GlassCard>
  );
}
