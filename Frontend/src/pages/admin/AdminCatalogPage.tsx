import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, X } from 'lucide-react';
import { listCatalog, updateCityRates, type AdminCityRow } from '@/services/admin';
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
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useToast } from '@/hooks/use-toast';
import { formatMoney } from '@/lib/format';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/**
 * Destination management.
 *
 * The nightly rate bands here are the inputs to the cost engine — editing them
 * changes what every future itinerary estimates for that city, so this is the
 * one admin screen that feeds directly back into the traveller experience.
 */
export function AdminCatalogPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AdminCityRow | null>(null);
  const [draft, setDraft] = useState({ budget: 0, mid: 0, luxury: 0 });
  const debounced = useDebouncedValue(search, 300);

  const catalog = useQuery({
    queryKey: ['admin', 'catalog', { search: debounced }],
    queryFn: () => listCatalog({ search: debounced || undefined, limit: 100 }),
  });

  const save = useMutation({
    mutationFn: () =>
      updateCityRates(editing!.id, {
        stayBudget: draft.budget,
        stayMid: draft.mid,
        stayLuxury: draft.luxury,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'catalog'] });
      toast(`${editing?.name} rates updated`, 'success');
      setEditing(null);
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const startEdit = (city: AdminCityRow) => {
    setEditing(city);
    setDraft({ budget: city.rates.budget, mid: city.rates.mid, luxury: city.rates.luxury });
  };

  const items = catalog.data?.items ?? [];

  return (
    <>
      <AdminHeading
        title="Destinations"
        subtitle={catalog.data ? `${catalog.data.total} cities in the catalog` : 'Loading…'}
      />

      <Panel>
        <PanelHeader
          title="Rate bands"
          subtitle="These feed the automatic cost estimates travellers see"
          action={<AdminSearch value={search} onChange={setSearch} placeholder="City name…" />}
        />

        {catalog.isLoading ? (
          <AdminSkeleton rows={8} />
        ) : (
          <DataTable
            columns={['City', 'Region', 'Cost index', 'Budget', 'Mid', 'Luxury', 'Peak', 'Usage', '']}
            empty={items.length === 0}
          >
            {items.map((c) => {
              const isEditing = editing?.id === c.id;
              return (
                <tr key={c.id} className="transition-colors hover:bg-white/5">
                  <Td>
                    <span className="font-medium text-slate-100">{c.name}</span>
                  </Td>
                  <Td>
                    <span className="text-xs text-slate-400">{c.region}</span>
                  </Td>
                  <Td align="right">{c.costIndex}</Td>

                  {(['budget', 'mid', 'luxury'] as const).map((key) => (
                    <Td key={key} align="right">
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          value={draft[key]}
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                          }
                          className="h-7 w-20 rounded border border-white/10 bg-slate-950 px-2 text-right text-xs text-slate-200 outline-none focus-visible:border-accent"
                          aria-label={`${c.name} ${key} rate`}
                        />
                      ) : (
                        formatMoney(c.rates[key], c.currency)
                      )}
                    </Td>
                  ))}

                  <Td>
                    <span className="flex gap-0.5" title="Peak months">
                      {MONTHS.map((m, i) => (
                        <span
                          key={i}
                          className={
                            c.peakMonths.includes(i + 1)
                              ? 'text-[9px] font-bold text-accent'
                              : 'text-[9px] text-slate-700'
                          }
                        >
                          {m}
                        </span>
                      ))}
                    </span>
                  </Td>

                  <Td align="right">
                    <span className="flex justify-end gap-1">
                      <Tag>{c.activityCount} acts</Tag>
                      <Tag tone={c.tripCount > 0 ? 'accent' : 'neutral'}>{c.tripCount} trips</Tag>
                    </span>
                  </Td>

                  <Td align="right">
                    {isEditing ? (
                      <span className="flex justify-end gap-1.5">
                        <AdminButton variant="ghost" onClick={() => setEditing(null)}>
                          <X className="h-3 w-3" />
                        </AdminButton>
                        <AdminButton
                          variant="accent"
                          disabled={save.isPending}
                          onClick={() => save.mutate()}
                        >
                          <Check className="h-3 w-3" />
                          Save
                        </AdminButton>
                      </span>
                    ) : (
                      <AdminButton variant="ghost" onClick={() => startEdit(c)}>
                        <Pencil className="h-3 w-3" />
                        Edit
                      </AdminButton>
                    )}
                  </Td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Panel>

      <p className="mt-3 text-xs text-slate-600">
        Rates are per room, per night, in the destination's currency. A seasonal multiplier is
        applied on top: ×1.35 in peak months, ×0.75 during the monsoon.
      </p>
    </>
  );
}
