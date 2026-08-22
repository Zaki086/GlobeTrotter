import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAllTrips } from '@/services/admin';
import {
  AdminHeading,
  AdminSearch,
  AdminSkeleton,
  DataTable,
  Panel,
  PanelHeader,
  Tag,
  Td,
} from '@/features/admin/AdminPrimitives';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { formatDate, formatMoney } from '@/lib/format';
import { TRIP_STATUS_LABELS } from '@/lib/constants';

/** Trip oversight across every account. */
export function AdminTripsPage() {
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 300);

  const trips = useQuery({
    queryKey: ['admin', 'trips', { search: debounced }],
    queryFn: () => listAllTrips({ search: debounced || undefined, limit: 100 }),
  });

  const items = trips.data?.items ?? [];

  return (
    <>
      <AdminHeading title="Trips" subtitle={trips.data ? `${trips.data.total} trips` : 'Loading…'} />

      <Panel>
        <PanelHeader
          title="All trips"
          subtitle="Every itinerary on the platform"
          action={<AdminSearch value={search} onChange={setSearch} placeholder="Trip name…" />}
        />

        {trips.isLoading ? (
          <AdminSkeleton rows={8} />
        ) : (
          <DataTable
            columns={['Trip', 'Owner', 'Dates', 'Status', 'Stops', 'Members', 'Budget', 'Shared']}
            empty={items.length === 0}
          >
            {items.map((t) => (
              <tr key={t.id} className="transition-colors hover:bg-white/5">
                <Td>
                  <span className="block max-w-[16rem] truncate font-medium text-slate-100">
                    {t.name}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    created {formatDate(t.createdAt)}
                  </span>
                </Td>
                <Td>
                  <span className="block truncate text-xs">{t.owner.name}</span>
                  <span className="block truncate text-[11px] text-slate-600">{t.owner.email}</span>
                </Td>
                <Td>
                  <span className="whitespace-nowrap text-xs text-slate-400">
                    {t.startDate} → {t.endDate}
                  </span>
                </Td>
                <Td>
                  <Tag tone={t.status === 'COMPLETED' ? 'positive' : 'neutral'}>
                    {TRIP_STATUS_LABELS[t.status] ?? t.status}
                  </Tag>
                </Td>
                <Td align="right">{t.stopCount}</Td>
                <Td align="right">{t.memberCount}</Td>
                <Td align="right">{formatMoney(t.estimatedTotal, t.currency)}</Td>
                <Td>
                  {t.isPublic ? <Tag tone="accent">Public</Tag> : <Tag>Private</Tag>}
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </>
  );
}
