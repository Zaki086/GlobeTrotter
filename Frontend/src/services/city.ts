import { USE_MOCK, request, requestPaginated, delay } from '@/lib/api';
import { mockCities, getCityDetail } from '@/services/mock-data';
import type { City, CityDetail, CityFacets, ListCitiesQuery, Paginated } from '@/types';

export async function searchCities(query: ListCitiesQuery = {}): Promise<Paginated<City>> {
  if (USE_MOCK) {
    await delay();
    let items = [...mockCities];
    if (query.search) {
      const term = query.search.toLowerCase();
      items = items.filter(
        (c) =>
          c.name.toLowerCase().includes(term) || c.country.toLowerCase().includes(term),
      );
    }
    if (query.country) items = items.filter((c) => c.country.toLowerCase() === query.country!.toLowerCase());
    if (query.region) items = items.filter((c) => c.region.toLowerCase() === query.region!.toLowerCase());
    if (query.minCostIndex !== undefined) items = items.filter((c) => c.costIndex >= query.minCostIndex!);
    if (query.maxCostIndex !== undefined) items = items.filter((c) => c.costIndex <= query.maxCostIndex!);

    const sortBy = query.sortBy ?? 'popularity';
    const sortOrder = query.sortOrder ?? 'desc';
    items.sort((a, b) => {
      const av = a[sortBy] as string | number;
      const bv = b[sortBy] as string | number;
      if (av < bv) return sortOrder === 'asc' ? -1 : 1;
      if (av > bv) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const start = (page - 1) * limit;
    return { items: items.slice(start, start + limit), total: items.length };
  }
  return requestPaginated<City>({ url: '/cities', params: query as Record<string, unknown> });
}

export async function getCity(id: string): Promise<CityDetail> {
  if (USE_MOCK) {
    await delay();
    return getCityDetail(id);
  }
  return request<CityDetail>({ method: 'GET', url: `/cities/${id}` });
}

export async function getCityFacets(): Promise<CityFacets> {
  if (USE_MOCK) {
    await delay();
    const countries = [...new Set(mockCities.map((c) => c.country))].sort();
    const regions = [...new Set(mockCities.map((c) => c.region))].sort();
    return {
      countries,
      countryCodes: countries.map((country) => ({
        country,
        code: mockCities.find((c) => c.country === country)?.countryCode ?? '',
      })),
      regions,
    };
  }
  return request<CityFacets>({ method: 'GET', url: '/cities/facets' });
}

export async function getPopularCities(limit = 10): Promise<City[]> {
  if (USE_MOCK) {
    await delay();
    return [...mockCities].sort((a, b) => b.popularity - a.popularity).slice(0, limit);
  }
  return request<City[]>({ method: 'GET', url: '/cities/popular', params: { limit } });
}
