import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { cache } from '../config/redis';
import { CACHE_KEY, CACHE_TTL } from '../config/constants';
import { ApiError } from '../utils/ApiError';
import { stableHash } from '../utils/hash';
import type { ListCitiesQuery } from '../validators/city.validator';

/**
 * City discovery. Cities are seeded reference data — no third-party geocoding
 * service is involved, so search stays fast, free and offline-capable.
 */
export class CityService {
  static async search(query: ListCitiesQuery) {
    const cacheKey = CACHE_KEY.citySearch(stableHash(query));
    const cached = await cache.get<{ items: unknown[]; total: number }>(cacheKey);
    if (cached) return cached;

    const where: Prisma.CityWhereInput = {};

    if (query.search) {
      // Matches city or country so "japan" finds Tokyo, Kyoto and Osaka.
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { country: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.country) where.country = { equals: query.country, mode: 'insensitive' };
    if (query.region) where.region = { equals: query.region, mode: 'insensitive' };

    if (query.minCostIndex !== undefined || query.maxCostIndex !== undefined) {
      where.costIndex = {
        ...(query.minCostIndex !== undefined ? { gte: query.minCostIndex } : {}),
        ...(query.maxCostIndex !== undefined ? { lte: query.maxCostIndex } : {}),
      };
    }

    const skip = (query.page - 1) * query.limit;

    const [cities, total] = await Promise.all([
      prisma.city.findMany({
        where,
        skip,
        take: query.limit,
        // Secondary sort by name keeps paging stable when scores tie.
        orderBy: [{ [query.sortBy]: query.sortOrder }, { name: 'asc' }],
        include: { _count: { select: { activities: true } } },
      }),
      prisma.city.count({ where }),
    ]);

    const result = {
      items: cities.map((city) => this.toDto(city)),
      total,
    };

    await cache.set(cacheKey, result, CACHE_TTL.CITY_SEARCH);
    return result;
  }

  static async getById(cityId: string) {
    const city = await prisma.city.findUnique({
      where: { id: cityId },
      include: {
        _count: { select: { activities: true } },
        activities: {
          orderBy: { popularity: 'desc' },
          take: 10,
        },
      },
    });
    if (!city) throw ApiError.notFound('City not found');

    return {
      ...this.toDto(city),
      topActivities: city.activities.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        estimatedCost: Number(a.estimatedCost),
        currency: a.currency,
        durationMinutes: a.durationMinutes,
        imageUrl: a.imageUrl,
      })),
    };
  }

  /** Distinct countries and regions, for the filter dropdowns. */
  static async facets() {
    const cached = await cache.get<{ countries: string[]; regions: string[] }>('cache:cities:facets');
    if (cached) return cached;

    const [countries, regions] = await Promise.all([
      prisma.city.findMany({
        distinct: ['country'],
        select: { country: true, countryCode: true },
        orderBy: { country: 'asc' },
      }),
      prisma.city.findMany({
        distinct: ['region'],
        select: { region: true },
        orderBy: { region: 'asc' },
      }),
    ]);

    const result = {
      countries: countries.map((c) => c.country),
      countryCodes: countries.map((c) => ({ country: c.country, code: c.countryCode })),
      regions: regions.map((r) => r.region),
    };

    await cache.set('cache:cities:facets', result, CACHE_TTL.CITY_DETAIL);
    return result;
  }

  /**
   * Recommended destinations for the dashboard. Cities the user has already
   * been to are excluded so the suggestions stay fresh.
   */
  static async recommended(userId: string, limit = 6) {
    const visited = await prisma.stop.findMany({
      where: { trip: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] } },
      select: { cityId: true },
      distinct: ['cityId'],
    });

    const excludeIds = visited.map((v) => v.cityId);

    const cities = await prisma.city.findMany({
      where: excludeIds.length ? { id: { notIn: excludeIds } } : {},
      orderBy: [{ popularity: 'desc' }, { name: 'asc' }],
      take: limit,
      include: { _count: { select: { activities: true } } },
    });

    return cities.map((city) => this.toDto(city));
  }

  /** Cities appearing in the most trips — powers admin "popular cities". */
  static async popular(limit = 10) {
    const grouped = await prisma.stop.groupBy({
      by: ['cityId'],
      _count: { cityId: true },
      orderBy: { _count: { cityId: 'desc' } },
      take: limit,
    });

    if (grouped.length === 0) return [];

    const cities = await prisma.city.findMany({
      where: { id: { in: grouped.map((g) => g.cityId) } },
    });
    const cityById = new Map(cities.map((c) => [c.id, c]));

    return grouped
      .map((g) => {
        const city = cityById.get(g.cityId);
        if (!city) return null;
        return {
          id: city.id,
          name: city.name,
          country: city.country,
          countryCode: city.countryCode,
          region: city.region,
          imageUrl: city.imageUrl,
          tripCount: g._count.cityId,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }

  private static toDto(city: Prisma.CityGetPayload<{ include: { _count: { select: { activities: true } } } }>) {
    return {
      id: city.id,
      name: city.name,
      country: city.country,
      countryCode: city.countryCode,
      region: city.region,
      timezone: city.timezone,
      latitude: Number(city.latitude),
      longitude: Number(city.longitude),
      costIndex: city.costIndex,
      popularity: city.popularity,
      currency: city.currency,
      description: city.description,
      imageUrl: city.imageUrl,
      activityCount: city._count.activities,
    };
  }
}

export default CityService;
