import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAuditLogs } from '@/services/admin';
import {
  AdminButton,
  AdminHeading,
  AdminSkeleton,
  DataTable,
  Panel,
  PanelHeader,
  Tag,
  Td,
} from '@/features/admin/AdminPrimitives';
import { formatRelative, initials } from '@/lib/format';

const FILTERS = [
  { value: undefined, label: 'Everything' },
  { value: 'user.login', label: 'Logins' },
  { value: 'user.login_failed', label: 'Failed logins' },
  { value: 'trip.created', label: 'Trips created' },
  { value: 'admin.user_updated', label: 'Admin actions' },
  { value: 'auth.token_reuse_detected', label: 'Token reuse' },
] as const;

/** The append-only trail of who did what. */
export function AdminAuditPage() {
  const [action, setAction] = useState<string | undefined>();

  const logs = useQuery({
    queryKey: ['admin', 'audit', { action }],
    queryFn: () => listAuditLogs({ action, limit: 100 }),
  });

  const items = logs.data?.items ?? [];

  return (
    <>
      <AdminHeading
        title="Audit log"
        subtitle={logs.data ? `${logs.data.total} recorded events` : 'Loading…'}
      />

      <Panel>
        <PanelHeader
          title="Activity"
          subtitle="Newest first · retained after account deletion with the actor nulled"
          action={
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <AdminButton
                  key={f.label}
                  variant={action === f.value ? 'accent' : 'default'}
                  onClick={() => setAction(f.value)}
                >
                  {f.label}
                </AdminButton>
              ))}
            </div>
          }
        />

        {logs.isLoading ? (
          <AdminSkeleton rows={10} />
        ) : (
          <DataTable columns={['Action', 'Actor', 'Resource', 'IP', 'When']} empty={items.length === 0}>
            {items.map((l) => (
              <tr key={l.id} className="transition-colors hover:bg-white/5">
                <Td>
                  <Tag tone={l.action.includes('failed') || l.action.includes('reuse') ? 'negative' : 'neutral'}>
                    {l.action}
                  </Tag>
                </Td>
                <Td>
                  {l.actor ? (
                    <span className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-[10px]">
                        {initials(l.actor.name)}
                      </span>
                      <span className="truncate text-xs">{l.actor.name}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-600">deleted account</span>
                  )}
                </Td>
                <Td>
                  <span className="text-xs text-slate-400">{l.resourceType}</span>
                </Td>
                <Td>
                  <span className="font-mono text-[11px] text-slate-500">{l.ipAddress ?? '—'}</span>
                </Td>
                <Td>
                  <span className="whitespace-nowrap text-[11px] text-slate-500">
                    {formatRelative(l.createdAt)}
                  </span>
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </>
  );
}
