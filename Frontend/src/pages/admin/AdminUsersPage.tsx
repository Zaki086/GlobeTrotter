import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, ShieldOff, UserCheck, UserX } from 'lucide-react';
import { listUsers, updateUser } from '@/services/admin';
import {
  AdminButton,
  AdminHeading,
  AdminSearch,
  AdminSkeleton,
  DataTable,
  Panel,
  PanelHeader,
  Tag,
  Td,
} from '@/features/admin/AdminPrimitives';
import { useAuth } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useToast } from '@/hooks/use-toast';
import { formatDate, initials } from '@/lib/format';
import type { Role } from '@/types';

/** PRD: "user management tools". */
export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: me } = useAuth();

  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | undefined>();
  const debounced = useDebouncedValue(search, 300);

  const users = useQuery({
    queryKey: ['admin', 'users', { search: debounced, role }],
    queryFn: () => listUsers({ search: debounced || undefined, role, limit: 100 }),
  });

  const mutate = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { role?: Role; isActive?: boolean } }) =>
      updateUser(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast('User updated', 'success');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const items = users.data?.items ?? [];

  return (
    <>
      <AdminHeading
        title="Users"
        subtitle={users.data ? `${users.data.total} accounts` : 'Loading…'}
      />

      <Panel>
        <PanelHeader
          title="All accounts"
          subtitle="Promote, demote, suspend or reinstate"
          action={
            <div className="flex items-center gap-2">
              {([undefined, 'USER', 'ADMIN'] as const).map((value) => (
                <AdminButton
                  key={value ?? 'all'}
                  variant={role === value ? 'accent' : 'default'}
                  onClick={() => setRole(value)}
                >
                  {value ?? 'All'}
                </AdminButton>
              ))}
              <AdminSearch value={search} onChange={setSearch} placeholder="Name or email…" />
            </div>
          }
        />

        {users.isLoading ? (
          <AdminSkeleton rows={6} />
        ) : (
          <DataTable
            columns={['User', 'Role', 'Trips', 'Sessions', 'Last seen', 'Status', 'Actions']}
            empty={items.length === 0}
          >
            {items.map((u) => {
              const isSelf = u.id === me?.id;
              return (
                <tr key={u.id} className="transition-colors hover:bg-white/5">
                  <Td>
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-[11px] font-semibold">
                        {initials(u.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-100">{u.name}</span>
                        <span className="block truncate text-[11px] text-slate-500">{u.email}</span>
                      </span>
                    </span>
                  </Td>
                  <Td>
                    <Tag tone={u.role === 'ADMIN' ? 'accent' : 'neutral'}>{u.role}</Tag>
                  </Td>
                  <Td align="right">{u.tripCount}</Td>
                  <Td align="right">{u.sessionCount}</Td>
                  <Td>
                    <span className="text-xs text-slate-500">
                      {u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never'}
                    </span>
                  </Td>
                  <Td>
                    <Tag tone={u.isActive ? 'positive' : 'negative'}>
                      {u.isActive ? 'Active' : 'Suspended'}
                    </Tag>
                  </Td>
                  <Td align="right">
                    {isSelf ? (
                      <span className="text-[11px] text-slate-600">You</span>
                    ) : (
                      <span className="flex justify-end gap-1.5">
                        <AdminButton
                          disabled={mutate.isPending}
                          onClick={() =>
                            mutate.mutate({
                              id: u.id,
                              patch: { role: u.role === 'ADMIN' ? 'USER' : 'ADMIN' },
                            })
                          }
                        >
                          {u.role === 'ADMIN' ? (
                            <>
                              <ShieldOff className="h-3 w-3" /> Demote
                            </>
                          ) : (
                            <>
                              <Shield className="h-3 w-3" /> Promote
                            </>
                          )}
                        </AdminButton>
                        <AdminButton
                          variant={u.isActive ? 'danger' : 'accent'}
                          disabled={mutate.isPending}
                          onClick={() =>
                            mutate.mutate({ id: u.id, patch: { isActive: !u.isActive } })
                          }
                        >
                          {u.isActive ? (
                            <>
                              <UserX className="h-3 w-3" /> Suspend
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3 w-3" /> Restore
                            </>
                          )}
                        </AdminButton>
                      </span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Panel>

      <p className="mt-3 text-xs text-slate-600">
        Suspending an account revokes every one of its sessions immediately. The last active admin
        cannot be demoted or suspended.
      </p>
    </>
  );
}
