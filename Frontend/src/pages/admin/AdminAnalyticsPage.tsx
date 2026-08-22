import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity as ActivityIcon, Building2 } from 'lucide-react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getAnalytics } from '@/services/admin';
import {
  AdminButton,
  AdminHeading,
  AdminSkeleton,
  DataTable,
  Panel,
  PanelHeader,
  StatCard,
  Td,
} from '@/features/admin/AdminPrimitives';
import { ErrorState } from '@/components/ErrorState';
import { ACTIVITY_TYPE_LABELS, TRIP_STATUS_LABELS } from '@/lib/constants';
import { formatMoney } from '@/lib/format';
import type { TripStatus } from '@/types';

const WINDOWS = [7, 30, 90] as const;

/** Deep analytics — popular cities and activities, engagement, status mix. */
export function AdminAnalyticsPage() {
  const [days, setDays] = useState<number>(30);

  const analytics = useQuery({
    queryKey: ['admin', 'analytics', days],
    queryFn: () => getAnalytics(days),
  });

  if (analytics.isLoading) return <AdminSkeleton rows={8} />;
  if (analytics.isError || !analytics.data) {
    return <ErrorState title="Could not load analytics" onRetry={() => void analytics.refetch()} />;
  }

  const d = analytics.data;
  const activityChart = d.popularActivities.slice(0, 8).map((a) => ({
    name: a.name.length > 22 ? `${a.name.slice(0, 21)}…` : a.name,
    added: a.timesAdded,
  }));

  return (
    <>
      <AdminHeading
        title="Analytics"
        subtitle="Where travellers actually go, and what they book"
        action={
          <div className="flex gap-1.5">
            {WINDOWS.map((w) => (
              <AdminButton key={w} variant={days === w ? 'accent' : 'default'} onClick={() => setDays(w)}>
                {w}d
              </AdminButton>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={ActivityIcon} label="Avg trip budget" value={formatMoney(d.engagement.avgTripBudget, 'INR')} />
        <StatCard icon={ActivityIcon} label="Total planned spend" value={formatMoney(d.engagement.totalPlannedSpend, 'INR')} />
        <StatCard icon={ActivityIcon} label="Share views" value={d.engagement.totalShareViews.toLocaleString()} />
        <StatCard icon={ActivityIcon} label="Trip copies" value={d.engagement.totalTripCopies} tone="positive" />
      </div>

      <Panel className="mt-6">
        <PanelHeader title="Trips by status" />
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-5">
          {(Object.keys(d.trips.byStatus) as TripStatus[]).map((status) => (
            <div key={status} className="rounded-xl bg-white/5 p-3 text-center">
              <p className="text-lg font-semibold tabular-nums text-slate-100">
                {d.trips.byStatus[status]}
              </p>
              <p className="text-[11px] text-slate-500">{TRIP_STATUS_LABELS[status]}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Popular destinations" subtitle="By number of trips" />
          <DataTable columns={['#', 'City', 'Region', 'Trips']} empty={d.popularCities.length === 0}>
            {d.popularCities.map((c, i) => (
              <tr key={c.id} className="transition-colors hover:bg-white/5">
                <Td className="w-10 text-slate-600">{i + 1}</Td>
                <Td>
                  <span className="font-medium text-slate-100">{c.name}</span>
                </Td>
                <Td>
                  <span className="text-xs text-slate-500">{c.region}</span>
                </Td>
                <Td align="right">{c.tripCount}</Td>
              </tr>
            ))}
          </DataTable>
        </Panel>

        <Panel>
          <PanelHeader title="Most added activities" />
          <div className="p-5">
            {activityChart.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">No data yet.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityChart} layout="vertical" margin={{ left: 4, right: 12 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      contentStyle={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: '#0f172a', color: '#e2e8f0' }}
                    />
                    <Bar dataKey="added" radius={[0, 4, 4, 0]}>
                      {activityChart.map((_, i) => (
                        <Cell key={i} fill={i % 2 ? '#38bdf8' : '#f97316'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Panel className="mt-4">
        <PanelHeader title="Top activities in detail" />
        <DataTable columns={['#', 'Activity', 'Type', 'City', 'Price', 'Added']} empty={d.popularActivities.length === 0}>
          {d.popularActivities.map((a, i) => (
            <tr key={a.id} className="transition-colors hover:bg-white/5">
              <Td className="w-10 text-slate-600">{i + 1}</Td>
              <Td>
                <span className="block max-w-[18rem] truncate font-medium text-slate-100">{a.name}</span>
              </Td>
              <Td>
                <span className="text-xs text-slate-500">
                  {ACTIVITY_TYPE_LABELS[a.type] ?? a.type}
                </span>
              </Td>
              <Td>
                <span className="text-xs text-slate-400">{a.city}</span>
              </Td>
              <Td align="right">{formatMoney(a.estimatedCost, 'INR')}</Td>
              <Td align="right">{a.timesAdded}</Td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
        <Building2 className="h-3 w-3" />
        {d.totals.catalogCities} destinations · {d.totals.catalogActivities} attractions in the catalog
      </p>
    </>
  );
}
