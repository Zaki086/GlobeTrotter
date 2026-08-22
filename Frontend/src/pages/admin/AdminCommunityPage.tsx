import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Star, Trash2 } from 'lucide-react';
import { listAllPosts, moderatePost } from '@/services/admin';
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
import { useToast } from '@/hooks/use-toast';
import { formatRelative, initials } from '@/lib/format';

/** Community moderation — remove posts that break the rules. */
export function AdminCommunityPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pending, setPending] = useState<string | null>(null);

  const posts = useQuery({
    queryKey: ['admin', 'posts'],
    queryFn: () => listAllPosts({ limit: 100 }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => moderatePost(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] });
      void queryClient.invalidateQueries({ queryKey: ['community'] });
      setPending(null);
      toast('Post removed', 'success');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const items = posts.data?.items ?? [];

  return (
    <>
      <AdminHeading
        title="Community"
        subtitle={posts.data ? `${posts.data.total} posts` : 'Loading…'}
      />

      <Panel>
        <PanelHeader title="Moderation queue" subtitle="Newest first" />

        {posts.isLoading ? (
          <AdminSkeleton rows={8} />
        ) : (
          <DataTable
            columns={['Post', 'Author', 'Destination', 'Rating', 'Engagement', 'Posted', '']}
            empty={items.length === 0}
          >
            {items.map((p) => (
              <tr key={p.id} className="transition-colors hover:bg-white/5">
                <Td>
                  <span className="block max-w-[20rem] truncate font-medium text-slate-100">
                    {p.title}
                  </span>
                  {p.tags.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {p.tags.slice(0, 3).map((t) => (
                        <Tag key={t}>#{t}</Tag>
                      ))}
                    </span>
                  )}
                </Td>
                <Td>
                  <span className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-[10px]">
                      {initials(p.author.name)}
                    </span>
                    <span className="truncate text-xs">{p.author.name}</span>
                  </span>
                </Td>
                <Td>
                  <span className="text-xs text-slate-400">{p.city?.name ?? '—'}</span>
                </Td>
                <Td>
                  {p.rating ? (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                      <Star className="h-3 w-3 fill-current" />
                      {p.rating}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-600">—</span>
                  )}
                </Td>
                <Td align="right">
                  <span className="text-xs text-slate-400">
                    {p.likeCount} likes · {p.commentCount} comments
                  </span>
                </Td>
                <Td>
                  <span className="whitespace-nowrap text-[11px] text-slate-500">
                    {formatRelative(p.createdAt)}
                  </span>
                </Td>
                <Td align="right">
                  {pending === p.id ? (
                    <span className="flex justify-end gap-1.5">
                      <AdminButton variant="ghost" onClick={() => setPending(null)}>
                        Cancel
                      </AdminButton>
                      <AdminButton
                        variant="danger"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(p.id)}
                      >
                        Confirm
                      </AdminButton>
                    </span>
                  ) : (
                    <AdminButton variant="ghost" onClick={() => setPending(p.id)}>
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </AdminButton>
                  )}
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </>
  );
}
