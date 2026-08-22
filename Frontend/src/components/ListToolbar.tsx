import { useState } from 'react';
import { ArrowDownAZ, ArrowUpAZ, Layers, SlidersHorizontal } from 'lucide-react';
import { SearchBar } from '@/components/SearchBar';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ToolbarOption<T extends string> {
  value: T;
  label: string;
}

interface ListToolbarProps<G extends string, S extends string> {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  /** "Group by" — omit to hide the control. */
  groupBy?: G;
  groupOptions?: ToolbarOption<G>[];
  onGroupByChange?: (value: G) => void;

  sortBy: S;
  sortOptions: ToolbarOption<S>[];
  onSortByChange: (value: S) => void;

  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (value: 'asc' | 'desc') => void;

  /** Extra filter controls rendered inside the sheet. */
  filters?: React.ReactNode;
  /** Count shown on the filter badge. */
  activeFilterCount?: number;
  onResetFilters?: () => void;

  resultCount?: number;
  className?: string;
}

/**
 * Search + Group by + Filter + Sort — the control cluster that appears on
 * almost every list screen in the wireframes (screens 3, 6, 8, 9, 10, 11, 12).
 *
 * On mobile the secondary controls collapse into a bottom sheet so the bar
 * stays usable at 390px; on desktop they sit inline.
 */
export function ListToolbar<G extends string, S extends string>({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  groupBy,
  groupOptions,
  onGroupByChange,
  sortBy,
  sortOptions,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  filters,
  activeFilterCount = 0,
  onResetFilters,
  resultCount,
  className,
}: ListToolbarProps<G, S>) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const showGroup = !!groupOptions && !!onGroupByChange;
  const badge = activeFilterCount + (groupBy && groupBy !== 'none' ? 1 : 0);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <SearchBar
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onClear={() => onSearchChange('')}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          containerClassName="flex-1"
        />

        <button
          onClick={() => setSheetOpen(true)}
          className={cn(
            'touch-target relative flex shrink-0 items-center justify-center rounded-2xl border border-border px-3 transition-colors hover:bg-muted',
            badge > 0 && 'border-primary text-primary',
          )}
          aria-label="Group, filter and sort"
        >
          <SlidersHorizontal className="h-5 w-5" />
          {badge > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {badge}
            </span>
          )}
        </button>
      </div>

      {/* Inline summary of what is currently applied. */}
      {(resultCount !== undefined || (groupBy && groupBy !== 'none')) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {resultCount !== undefined && (
            <span>
              {resultCount} result{resultCount === 1 ? '' : 's'}
            </span>
          )}
          {groupBy && groupBy !== 'none' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
              <Layers className="h-3 w-3" />
              Grouped by {groupOptions?.find((o) => o.value === groupBy)?.label ?? groupBy}
            </span>
          )}
        </div>
      )}

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Group, filter & sort">
        <div className="space-y-6 pb-2">
          {showGroup && (
            <fieldset>
              <legend className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <Layers className="h-4 w-4 text-primary" />
                Group by
              </legend>
              <div className="flex flex-wrap gap-2">
                {groupOptions!.map((option) => (
                  <Pill
                    key={option.value}
                    active={groupBy === option.value}
                    onClick={() => onGroupByChange!(option.value)}
                  >
                    {option.label}
                  </Pill>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Sort by</legend>
            <div className="flex flex-wrap gap-2">
              {sortOptions.map((option) => (
                <Pill
                  key={option.value}
                  active={sortBy === option.value}
                  onClick={() => onSortByChange(option.value)}
                >
                  {option.label}
                </Pill>
              ))}
            </div>
          </fieldset>

          <button
            onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="flex w-full items-center justify-between rounded-2xl border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <span className="flex items-center gap-2">
              {sortOrder === 'asc' ? (
                <ArrowUpAZ className="h-4 w-4" />
              ) : (
                <ArrowDownAZ className="h-4 w-4" />
              )}
              Order
            </span>
            <span className="text-muted-foreground">
              {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            </span>
          </button>

          {filters}

          <div className="flex gap-3">
            {onResetFilters && (
              <Button variant="outline" className="flex-1 rounded-2xl" onClick={onResetFilters}>
                Reset
              </Button>
            )}
            <Button className="flex-1 rounded-2xl" onClick={() => setSheetOpen(false)}>
              {resultCount !== undefined ? `Show ${resultCount}` : 'Done'}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

export function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'border border-border text-muted-foreground hover:text-foreground',
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
