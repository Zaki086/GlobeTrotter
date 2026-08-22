import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Activity as ActivityIcon,
  Building2,
  Link2,
  Map,
  MessageSquare,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getAnalytics, listAllTrips, listAllPosts } from '@/services/admin';
import {
  AdminButton,
  AdminHeading,
  AdminSkeleton,
  DataTable,
  Panel,
  PanelHeader,
  StatCard,
  Tag,
  Td,
} from '@/features/admin/AdminPrimitives';
import { ErrorState } from '@/components/ErrorState';
import { formatDate, formatDateShort, formatMoney, initials } from '@/lib/format';

/** The console landing page — platform health at a glance. */
export function AdminOverviewPage() {
  const navigate = useNavigate();

  const analytics = useQuery({
    queryKey: ['admin', 'analytics', 30],
    queryFn: () => getAnalytics(30),
  });
  const trips = useQuery({
    queryKey: ['admin', 'trips', { limit: 6 }],
    queryFn: () => listAllTrips({ limit: 6 }),
  });
  const posts = useQuery({
    queryKey: ['admin', 'posts', { limit: 5 }],
    queryFn: () => listAllPosts({ limit: 5 }),
  });

  if (analytics.isLoading) return <AdminSkeleton rows={8} />;
  if (analytics.isError || !analytics.data) {
    return <ErrorState title="Could not load analytics" onRetry={() => void analytics.refetch()} />;
  }

  const d = analytics.data;
  const growth = d.userGrowth.map((point, i) => ({
    date: formatDateShort(point.date),
    users: point.cumulative,
    trips: d.tripGrowth[i]?.cumulative ?? 0,
  }));

  return (
    <>
      <AdminHeading
        title="Overview"
        subtitle={`Platform health · generated ${formatDate(d.generatedAt)}`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="Users" value={d.totals.users} delta={`+${d.users.newInWindow} in 30d`} tone="accent" />
        <StatCard icon={Map} label="Trips" value={d.totals.trips} delta={`+${d.trips.newInWindow} in 30d`} />
        <StatCard icon={ActivityIcon} label="Activities booked" value={d.totals.scheduledActivities} delta={`${d.trips.averageActivitiesPerTrip}/trip`} />
        <StatCard icon={Link2} label="Public itineraries" value={d.totals.activeShareLinks} delta={`${d.engagement.totalTripCopies} copies`} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={TrendingUp} label="Activation rate" value={`${d.users.activationRate}%`} tone="positive" />
        <StatCard icon={Users} label="Active in 30d" value={`${d.users.activeRate}%`} />
        <StatCard icon={Building2} label="Destinations" value={d.totals.catalogCities} />
        <StatCard icon={ActivityIcon} label="Attractions" value={d.totals.catalogActivities} />
      </div>

      {/* Growth */}
      <Panel className="mt-6">
        <PanelHeader title="Growth" subtitle="Cumulative users and trips over the last 30 days" />
        <div className="p-5">
          {growth.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No signups in this window.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growth} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="aU" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="aT" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: '#0f172a', color: '#e2e8f0' }} />
                  <Area type="monotone" dataKey="users" name="Users" stroke="#f97316" strokeWidth={2} fill="url(#aU)" />
                  <Area type="monotone" dataKey="trips" name="Trips" stroke="#38bdf8" strokeWidth={2} fill="url(#aT)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Panel>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {/* Latest trips */}
        <Panel>
          <PanelHeader
            title="Latest trips"
            subtitle="Across every account"
            action={<AdminButton onClick={() => navigate('/admin/trips')}>View all</AdminButton>}
          />
          {trips.isLoading ? (
            <AdminSkeleton rows={4} />
          ) : (
            <DataTable columns={['Trip', 'Owner', 'Stops', 'Budget']} empty={trips.data?.items.length === 0}>
              {trips.data?.items.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-white/5">
                  <Td>
                    <span className="block truncate font-medium text-slate-100">{t.name}</span>
                    <span className="block text-[11px] text-slate-500">
                      {t.startDate} → {t.endDate}
                    </span>
                  </Td>
                  <Td>
                    <span className="block truncate text-xs">{t.owner.name}</span>
                  </Td>
                  <Td align="right">{t.stopCount}</Td>
                  <Td align="right">{formatMoney(t.estimatedTotal, t.currency)}</Td>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>

        {/* Community */}
        <Panel>
          <PanelHeader
            title="Recent community posts"
            subtitle="Moderation queue"
            action={<AdminButton onClick={() => navigate('/admin/community')}>Moderate</AdminButton>}
          />
          {posts.isLoading ? (
            <AdminSkeleton rows={4} />
          ) : (
            <DataTable columns={['Post', 'Author', 'Engagement']} empty={posts.data?.items.length === 0}>
              {posts.data?.items.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-white/5">
                  <Td>
                    <span className="block max-w-[18rem] truncate font-medium text-slate-100">
                      {p.title}
                    </span>
                    {p.city && <span className="block text-[11px] text-slate-500">{p.city.name}</span>}
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-[10px]">
                        {initials(p.author.name)}
                      </span>
                      <span className="truncate text-xs">{p.author.name}</span>
                    </span>
                  </Td>
                  <Td align="right">
                    <span className="inline-flex items-center gap-2 text-xs">
                      <Tag>{p.likeCount} likes</Tag>
                      <Tag>
                        <MessageSquare className="mr-1 inline h-3 w-3" />
                        {p.commentCount}
                      </Tag>
                    </span>
                  </Td>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>
      </div>
    </>
  );
}
