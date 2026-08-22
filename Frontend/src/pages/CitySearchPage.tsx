import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Clock, Globe2, Heart, Search, Sparkles, TrendingUp, X } from 'lucide-react';
import { getCity, getCityFacets, getPopularCities, searchCities } from '@/services/city';
import { addSavedDestination } from '@/services/profile';
import { GlassCard } from '@/components/GlassCard';
import { BottomSheet } from '@/components/BottomSheet';
import { SearchBar } from '@/components/SearchBar';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { SectionHeader } from '@/components/SectionHeader';
import { Button } from '@/components/ui/button';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useToast } from '@/hooks/use-toast';
import { costLevel, fallbackImage, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { City } from '@/types';

const RECENT_KEY = 'globetrotter-recent-cities';

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * City discovery, in the Google-Maps mould: instant search, filter chips, and
 * a bottom sheet for the selected result.
 */
export function CitySearchPage() {
  const [params, setParams] = useSearchParams();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [country, setCountry] = useState<string | undefined>();
  const [region, setRegion] = useState<string | undefined>();
  const [selectedId, setSelectedId] = useState<string | null>(params.get('city'));
  const [recent, setRecent] = useState<string[]>(readRecent);

  const debounced = useDebouncedValue(search, 300);
  const isSearching = debounced.length > 0 || !!country || !!region;

  const facets = useQuery({ queryKey: ['city-facets'], queryFn: getCityFacets });

  const popular = useQuery({
    queryKey: ['cities', 'popular'],
    queryFn: () => getPopularCities(12),
    enabled: !isSearching,
  });

  const results = useQuery({
    queryKey: ['cities', { search: debounced, country, region }],
    queryFn: () =>
      searchCities({
        search: debounced || undefined,
        country,
        region,
        limit: 40,
      }),
    enabled: isSearching,
  });

  const detail = useQuery({
    queryKey: ['city', selectedId],
    queryFn: () => getCity(selectedId!),
    enabled: !!selectedId,
  });

  // Keep the selected city in the URL so the sheet survives a refresh.
  useEffect(() => {
    if (selectedId) setParams({ city: selectedId }, { replace: true });
    else setParams({}, { replace: true });
  }, [selectedId, setParams]);

  const rememberRecent = (id: string) => {
    setRecent((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 6);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  };

  const recentCities = useQuery({
    queryKey: ['cities', 'recent', recent],
    queryFn: async () => {
      const cities = await Promise.all(recent.map((id) => getCity(id).catch(() => null)));
      return cities.filter((c): c is NonNullable<typeof c> => c !== null);
    },
    enabled: recent.length > 0 && !isSearching,
  });

  const save = async (cityId: string, name: string) => {
    try {
      await addSavedDestination(cityId);
      toast(`${name} saved to your destinations`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save', 'error');
    }
  };

  const activeFilters = useMemo(
    () => [country, region].filter(Boolean) as string[],
    [country, region],
  );

  const cities = isSearching ? results.data?.items ?? [] : popular.data ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Explore</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Find your next destination.
        </p>
      </header>

      {/* Search */}
      <div className="sticky top-16 z-20 -mx-4 space-y-3 bg-background/85 px-4 py-3 backdrop-blur-xl md:static md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <SearchBar
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cities or countries…"
            aria-label="Search cities"
            className="pl-10"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Region chips */}
        {facets.data && (
          <div className="snap-x-rail">
            <FilterChip active={!region && !country} onClick={() => { setRegion(undefined); setCountry(undefined); }}>
              All
            </FilterChip>
            {facets.data.regions.map((value) => (
              <FilterChip
                key={value}
                active={region === value}
                onClick={() => {
                  setRegion(region === value ? undefined : value);
                  setCountry(undefined);
                }}
              >
                {value}
              </FilterChip>
            ))}
          </div>
        )}

        {/* Country chips, shown once a region narrows the list */}
        {facets.data && facets.data.countries.length > 0 && (
          <div className="snap-x-rail">
            {facets.data.countries.slice(0, 20).map((value) => (
              <FilterChip
                key={value}
                active={country === value}
                onClick={() => setCountry(country === value ? undefined : value)}
                subtle
              >
                {value}
              </FilterChip>
            ))}
          </div>
        )}

        {activeFilters.length > 0 && (
          <button
            onClick={() => {
              setCountry(undefined);
              setRegion(undefined);
            }}
            className="text-xs font-medium text-primary"
          >
            Clear {activeFilters.length} filter{activeFilters.length > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Recent searches */}
      {!isSearching && (recentCities.data?.length ?? 0) > 0 && (
        <section className="space-y-3">
          <SectionHeader title="Recently viewed" icon={Clock} />
          <div className="snap-x-rail -mx-4 px-4 md:mx-0 md:px-0">
            {recentCities.data?.map((city) => (
              <button
                key={city.id}
                onClick={() => setSelectedId(city.id)}
                className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm"
              >
                <img
                  src={city.imageUrl ?? fallbackImage(city.name, 60, 60)}
                  alt=""
                  className="h-6 w-6 rounded-full object-cover"
                />
                {city.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Results */}
      <section className="space-y-3">
        <SectionHeader
          title={isSearching ? 'Results' : 'Popular destinations'}
          icon={isSearching ? Search : TrendingUp}
          subtitle={
            isSearching && results.data ? `${results.data.total} cities` : undefined
          }
        />

        {(isSearching ? results.isLoading : popular.isLoading) ? (
          <LoadingSkeleton count={4} />
        ) : (isSearching ? results.isError : popular.isError) ? (
          <ErrorState
            title="Search failed"
            onRetry={() => void (isSearching ? results.refetch() : popular.refetch())}
          />
        ) : cities.length === 0 ? (
          <EmptyState
            title="No cities found"
            message="Try a different search or clear the filters."
            action={
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => {
                  setSearch('');
                  setCountry(undefined);
                  setRegion(undefined);
                }}
              >
                Clear all
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cities.map((city, index) => (
              <CityCard
                key={city.id}
                city={city}
                index={index}
                onClick={() => {
                  setSelectedId(city.id);
                  rememberRecent(city.id);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Detail sheet */}
      <BottomSheet
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        title={detail.data?.name ?? 'City'}
      >
        {detail.isLoading ? (
          <LoadingSkeleton count={2} />
        ) : detail.data ? (
          <div className="space-y-4 pb-2">
            <div className="relative h-40 overflow-hidden rounded-2xl">
              <img
                src={detail.data.imageUrl ?? fallbackImage(detail.data.name)}
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="hero-scrim absolute inset-0" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <h3 className="text-lg font-semibold text-white">{detail.data.name}</h3>
                <p className="text-sm text-white/80">{detail.data.country}</p>
              </div>
            </div>

            {detail.data.description && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {detail.data.description}
              </p>
            )}

            <div className="grid grid-cols-3 gap-3 text-center">
              <StatBox label="Cost level" value={costLevel(detail.data.costIndex).symbols} />
              <StatBox label="Popularity" value={`${detail.data.popularity}/100`} />
              <StatBox label="Activities" value={String(detail.data.activityCount)} />
            </div>

            {detail.data.topActivities.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Top things to do</p>
                <ul className="space-y-2">
                  {detail.data.topActivities.slice(0, 5).map((activity) => (
                    <li
                      key={activity.id}
                      className="flex items-center gap-3 rounded-2xl border border-border p-3"
                    >
                      <img
                        src={activity.imageUrl ?? fallbackImage(activity.name, 100, 100)}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-xl object-cover"
                        loading="lazy"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">{activity.name}</span>
                      <span className="shrink-0 text-sm font-medium">
                        {formatMoney(activity.estimatedCost, activity.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button
              className="w-full rounded-2xl"
              size="lg"
              onClick={() => void save(detail.data!.id, detail.data!.name)}
            >
              <Heart className="mr-2 h-4 w-4" />
              Save destination
            </Button>
          </div>
        ) : (
          <ErrorState title="Could not load this city" onRetry={() => void detail.refetch()} />
        )}
      </BottomSheet>
    </div>
  );
}

function CityCard({ city, index, onClick }: { city: City; index: number; onClick: () => void }) {
  const cost = costLevel(city.costIndex);

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
      onClick={onClick}
      className="group relative h-48 w-full overflow-hidden rounded-3xl text-left"
    >
      <img
        src={city.imageUrl ?? fallbackImage(city.name)}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
      />
      <div className="hero-scrim absolute inset-0" />

      <span className="absolute right-3 top-3 rounded-full bg-white/25 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md">
        {cost.symbols}
      </span>

      <div className="absolute inset-x-0 bottom-0 p-4">
        <h3 className="text-lg font-semibold text-white">{city.name}</h3>
        <p className="flex items-center gap-1.5 text-sm text-white/80">
          <Globe2 className="h-3.5 w-3.5" />
          {city.country}
          <span aria-hidden>·</span>
          <Sparkles className="h-3.5 w-3.5" />
          {city.activityCount}
        </p>
      </div>
    </motion.button>
  );
}

function FilterChip({
  active,
  onClick,
  subtle,
  children,
}: {
  active: boolean;
  onClick: () => void;
  subtle?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : subtle
            ? 'border border-border text-muted-foreground hover:text-foreground'
            : 'glass text-muted-foreground hover:text-foreground',
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard className="rounded-2xl p-3">
      <p className="text-base font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </GlassCard>
  );
}
