import {
  addDays,
  differenceInCalendarDays,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
} from 'date-fns';
import type {
  Activity,
  ActivityType,
  City,
  CityDetail,
  Dashboard,
  DashboardTripCard,
  Expense,
  Itinerary,
  ItineraryDay,
  ItineraryStopGroup,
  Notification,
  Profile,
  PublicItinerary,
  PublicUser,
  ShareLink,
  Stop,
  StopActivity,
  TripCalendar,
  TripDetail,
  TripMemberRole,
  TripStatus,
  Budget,
} from '@/types';

const TODAY = startOfDay(new Date('2026-08-22'));

const citySeed: Omit<City, 'activityCount'>[] = [
  {
    id: 'city-tokyo',
    name: 'Tokyo',
    country: 'Japan',
    countryCode: 'JP',
    region: 'Asia',
    timezone: 'Asia/Tokyo',
    latitude: 35.6762,
    longitude: 139.6503,
    costIndex: 78,
    popularity: 96,
    currency: 'JPY',
    description: 'Neon-lit streets, ancient temples and world-class cuisine.',
    imageUrl:
      'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'city-kyoto',
    name: 'Kyoto',
    country: 'Japan',
    countryCode: 'JP',
    region: 'Asia',
    timezone: 'Asia/Tokyo',
    latitude: 35.0116,
    longitude: 135.7681,
    costIndex: 70,
    popularity: 92,
    currency: 'JPY',
    description: 'Traditional temples, tea houses and serene bamboo groves.',
    imageUrl:
      'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'city-osaka',
    name: 'Osaka',
    country: 'Japan',
    countryCode: 'JP',
    region: 'Asia',
    timezone: 'Asia/Tokyo',
    latitude: 34.6937,
    longitude: 135.5023,
    costIndex: 65,
    popularity: 88,
    currency: 'JPY',
    description: 'Street food capital with a lively nightlife scene.',
    imageUrl:
      'https://images.unsplash.com/photo-1590559899731-a382839e5549?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'city-rome',
    name: 'Rome',
    country: 'Italy',
    countryCode: 'IT',
    region: 'Europe',
    timezone: 'Europe/Rome',
    latitude: 41.9028,
    longitude: 12.4964,
    costIndex: 74,
    popularity: 95,
    currency: 'EUR',
    description: 'The Eternal City, where every corner tells a story.',
    imageUrl:
      'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'city-florence',
    name: 'Florence',
    country: 'Italy',
    countryCode: 'IT',
    region: 'Europe',
    timezone: 'Europe/Rome',
    latitude: 43.7696,
    longitude: 11.2558,
    costIndex: 68,
    popularity: 90,
    currency: 'EUR',
    description: 'Renaissance art, terracotta rooftops and Tuscan wine.',
    imageUrl:
      'https://images.unsplash.com/photo-1543429257-3eb0b5d5bd55?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'city-amalfi',
    name: 'Amalfi Coast',
    country: 'Italy',
    countryCode: 'IT',
    region: 'Europe',
    timezone: 'Europe/Rome',
    latitude: 40.634,
    longitude: 14.6027,
    costIndex: 82,
    popularity: 89,
    currency: 'EUR',
    description: 'Dramatic cliffs, pastel villages and sparkling seas.',
    imageUrl:
      'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'city-bali',
    name: 'Bali',
    country: 'Indonesia',
    countryCode: 'ID',
    region: 'Asia',
    timezone: 'Asia/Makassar',
    latitude: -8.4095,
    longitude: 115.1889,
    costIndex: 42,
    popularity: 94,
    currency: 'IDR',
    description: 'Tropical temples, rice terraces and surf breaks.',
    imageUrl:
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'city-paris',
    name: 'Paris',
    country: 'France',
    countryCode: 'FR',
    region: 'Europe',
    timezone: 'Europe/Paris',
    latitude: 48.8566,
    longitude: 2.3522,
    costIndex: 80,
    popularity: 98,
    currency: 'EUR',
    description: 'Iconic landmarks, art museums and café culture.',
    imageUrl:
      'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'city-nyc',
    name: 'New York City',
    country: 'United States',
    countryCode: 'US',
    region: 'North America',
    timezone: 'America/New_York',
    latitude: 40.7128,
    longitude: -74.006,
    costIndex: 85,
    popularity: 97,
    currency: 'USD',
    description: 'The city that never sleeps, from Broadway to Brooklyn.',
    imageUrl:
      'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'city-cape-town',
    name: 'Cape Town',
    country: 'South Africa',
    countryCode: 'ZA',
    region: 'Africa',
    timezone: 'Africa/Johannesburg',
    latitude: -33.9249,
    longitude: 18.4241,
    costIndex: 48,
    popularity: 86,
    currency: 'ZAR',
    description: 'Where mountains meet the ocean at the tip of Africa.',
    imageUrl:
      'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?auto=format&fit=crop&w=800&q=80',
  },
];

const activityTemplates: { name: string; type: ActivityType; durationMinutes: number; cost: number; image: string }[] = [
  { name: 'Guided walking tour', type: 'SIGHTSEEING', durationMinutes: 180, cost: 45, image: 'photo-1467269204594-9661b134dd2b' },
  { name: 'Local cooking class', type: 'FOOD', durationMinutes: 240, cost: 75, image: 'photo-1556910103-1c02745a30bf' },
  { name: 'Sunset hike', type: 'ADVENTURE', durationMinutes: 180, cost: 30, image: 'photo-1501555088652-021faa106b9b' },
  { name: 'Museum pass', type: 'CULTURE', durationMinutes: 240, cost: 25, image: 'photo-1518998053901-5348d3961a04' },
  { name: 'Botanical garden visit', type: 'NATURE', durationMinutes: 120, cost: 15, image: 'photo-1466692476868-aef1dfb1e735' },
  { name: 'Rooftop bar crawl', type: 'NIGHTLIFE', durationMinutes: 240, cost: 80, image: 'photo-1514362545857-3bc16c4c7d1b' },
  { name: 'Artisan market shopping', type: 'SHOPPING', durationMinutes: 150, cost: 60, image: 'photo-1481437156560-3205f6a55735' },
  { name: 'Spa & wellness retreat', type: 'RELAXATION', durationMinutes: 180, cost: 120, image: 'photo-1544161515-4ab6ce6db874' },
];

function unsplash(id: string): string {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=600&q=80`;
}

function buildActivities(): Activity[] {
  const activities: Activity[] = [];
  citySeed.forEach((city, cityIdx) => {
    activityTemplates.forEach((template, tIdx) => {
      const id = `act-${city.id}-${tIdx}`;
      activities.push({
        id,
        cityId: city.id,
        name: `${city.name} ${template.name}`,
        type: template.type,
        description: `A hand-picked ${template.name.toLowerCase()} experience in ${city.name}.`,
        imageUrl: unsplash(template.image),
        estimatedCost: Math.round(template.cost * (0.8 + city.costIndex / 100)),
        currency: city.currency,
        durationMinutes: template.durationMinutes,
        popularity: 50 + ((cityIdx + tIdx) % 50),
        city: {
          id: city.id,
          name: city.name,
          country: city.country,
          countryCode: city.countryCode,
        },
      });
    });
  });
  return activities;
}

export const mockCities: City[] = citySeed.map((c) => ({
  ...c,
  activityCount: activityTemplates.length,
}));

export const mockActivities: Activity[] = buildActivities();

export const mockCurrentUser: PublicUser = {
  id: 'user-1',
  name: 'Alex Wanderer',
  email: 'alex@example.com',
  role: 'USER',
  emailVerified: true,
  createdAt: '2025-01-15T10:00:00.000Z',
  lastLoginAt: TODAY.toISOString(),
};

export const mockProfile: Profile = {
  id: 'profile-1',
  userId: mockCurrentUser.id,
  name: mockCurrentUser.name,
  email: mockCurrentUser.email,
  role: mockCurrentUser.role,
  emailVerified: mockCurrentUser.emailVerified,
  createdAt: mockCurrentUser.createdAt,
  lastLoginAt: mockCurrentUser.lastLoginAt,
  avatarUrl:
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
  bio: 'Chasing horizons one city at a time.',
  language: 'en',
  currency: 'USD',
  country: 'United States',
  phone: null,
  savedDestinations: [mockCities[7], mockCities[8]],
  stats: { tripCount: 3, sharedItineraries: 1 },
};

function cityById(id: string): City {
  const city = mockCities.find((c) => c.id === id);
  if (!city) throw new Error(`Unknown city ${id}`);
  return city;
}

function activitiesForCity(cityId: string): StopActivity[] {
  return mockActivities
    .filter((a) => a.cityId === cityId)
    .slice(0, 3)
    .map((a, idx) => ({
      id: `sa-${a.id}`,
      activityId: a.id,
      name: a.name,
      type: a.type,
      description: a.description,
      imageUrl: a.imageUrl,
      scheduledDate: null,
      startTime: idx === 0 ? '09:00' : idx === 1 ? '14:00' : null,
      endTime: idx === 0 ? '12:00' : idx === 1 ? '17:00' : null,
      sequence: idx,
      cost: a.estimatedCost,
      currency: a.currency,
      durationMinutes: a.durationMinutes,
      notes: null,
    }));
}

function buildStop(
  tripId: string,
  cityId: string,
  sequence: number,
  arrival: Date,
  nights: number,
): Stop {
  const city = cityById(cityId);
  const departure = addDays(arrival, nights);
  return {
    id: `stop-${tripId}-${sequence}`,
    tripId,
    sequence,
    arrivalDate: format(arrival, 'yyyy-MM-dd'),
    departureDate: format(departure, 'yyyy-MM-dd'),
    days: nights + 1,
    nights,
    notes: null,
    accommodationCost: Math.round(120 * (city.costIndex / 50)),
    transportCost: sequence === 0 ? 0 : Math.round(90 * (city.costIndex / 50)),
    mealsPerDayCost: Math.round(45 * (city.costIndex / 50)),
    city,
    activities: activitiesForCity(cityId),
    createdAt: '2025-12-01T10:00:00.000Z',
    updatedAt: '2025-12-01T10:00:00.000Z',
  };
}

function buildTrip(
  id: string,
  name: string,
  status: TripStatus,
  startDate: Date,
  endDate: Date,
  travelers: number,
  coverImageUrl: string,
  cityStops: { cityId: string; nights: number }[],
): TripDetail {
  const owner = mockCurrentUser;
  let cursor = startDate;
  const stops = cityStops.map((s, idx) => {
    const stop = buildStop(id, s.cityId, idx, cursor, s.nights);
    cursor = addDays(cursor, s.nights);
    return stop;
  });

  const durationDays = differenceInCalendarDays(endDate, startDate) + 1;

  return {
    id,
    name,
    description: `A carefully curated ${name.toLowerCase()} experience.`,
    coverImageUrl,
    startDate: format(startDate, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd'),
    durationDays,
    daysUntilStart: differenceInCalendarDays(startDate, TODAY),
    travelers,
    currency: 'USD',
    status,
    isPublic: status !== 'DRAFT',
    owner,
    role: 'OWNER',
    canEdit: true,
    createdAt: '2025-12-01T10:00:00.000Z',
    updatedAt: '2025-12-01T10:00:00.000Z',
    members: [
      {
        id: 'member-1',
        role: 'OWNER',
        joinedAt: '2025-12-01T10:00:00.000Z',
        user: owner,
      },
    ],
    stops,
    budget: null,
    shares:
      status !== 'DRAFT'
        ? [
            {
              id: `share-${id}`,
              slug: `${name.toLowerCase().replace(/\s+/g, '-')}-share`,
              url: `${window.location.origin}/public/${name.toLowerCase().replace(/\s+/g, '-')}-share`,
              allowCopy: true,
              isActive: true,
              viewCount: 124,
              copyCount: 7,
              expiresAt: null,
              createdAt: '2025-12-01T10:00:00.000Z',
            },
          ]
        : [],
  };
}

export const mockTrips: TripDetail[] = [
  buildTrip(
    'trip-japan',
    'Japan Adventure',
    'PLANNED',
    addDays(TODAY, 19),
    addDays(TODAY, 33),
    2,
    'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80',
    [
      { cityId: 'city-tokyo', nights: 5 },
      { cityId: 'city-kyoto', nights: 4 },
      { cityId: 'city-osaka', nights: 3 },
    ],
  ),
  buildTrip(
    'trip-italy',
    'Italian Escape',
    'ONGOING',
    addDays(TODAY, -7),
    addDays(TODAY, 6),
    2,
    'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?auto=format&fit=crop&w=1200&q=80',
    [
      { cityId: 'city-rome', nights: 4 },
      { cityId: 'city-florence', nights: 3 },
      { cityId: 'city-amalfi', nights: 3 },
    ],
  ),
  buildTrip(
    'trip-bali',
    'Bali Retreat',
    'COMPLETED',
    addDays(TODAY, -52),
    addDays(TODAY, -43),
    1,
    'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80',
    [{ cityId: 'city-bali', nights: 9 }],
  ),
];

function computeBudget(trip: TripDetail): TripDetail {
  let transport = 0;
  let stay = 0;
  let meals = 0;
  let activities = 0;
  trip.stops.forEach((stop) => {
    transport += stop.transportCost;
    stay += stop.accommodationCost;
    meals += stop.mealsPerDayCost * stop.days * trip.travelers;
    stop.activities.forEach((a) => {
      activities += a.cost * trip.travelers;
    });
  });
  const total = transport + stay + meals + activities;
  const plannedTotal = trip.id === 'trip-japan' ? 4200 : trip.id === 'trip-italy' ? 3800 : null;
  trip.budget = {
    currency: trip.currency,
    plannedTotal,
    grandTotal: Number(total.toFixed(2)),
    perDayAverage: Number((total / trip.durationDays).toFixed(2)),
    lastCalculatedAt: new Date().toISOString(),
  };
  return trip;
}

mockTrips.forEach(computeBudget);

export const mockExpenses: Expense[] = mockTrips.flatMap((trip) => [
  {
    id: `exp-${trip.id}-1`,
    tripId: trip.id,
    stopId: trip.stops[0]?.id ?? null,
    createdById: mockCurrentUser.id,
    category: 'TRANSPORT',
    title: 'Airport transfer',
    amount: 45,
    currency: trip.currency,
    incurredOn: trip.startDate,
    notes: null,
    createdAt: trip.startDate,
    updatedAt: trip.startDate,
  },
  {
    id: `exp-${trip.id}-2`,
    tripId: trip.id,
    stopId: trip.stops[0]?.id ?? null,
    createdById: mockCurrentUser.id,
    category: 'MEALS',
    title: 'Welcome dinner',
    amount: 85,
    currency: trip.currency,
    incurredOn: trip.startDate,
    notes: null,
    createdAt: trip.startDate,
    updatedAt: trip.startDate,
  },
]);

export function getTripById(id: string): TripDetail | undefined {
  return mockTrips.find((t) => t.id === id);
}

export function toTripSummary(trip: TripDetail): import('@/types').TripSummary {
  return {
    id: trip.id,
    name: trip.name,
    description: trip.description,
    coverImageUrl: trip.coverImageUrl,
    startDate: trip.startDate,
    endDate: trip.endDate,
    durationDays: trip.durationDays,
    daysUntilStart: trip.daysUntilStart,
    travelers: trip.travelers,
    currency: trip.currency,
    status: trip.status,
    isPublic: trip.isPublic,
    stopCount: trip.stops.length,
    activityCount: trip.stops.reduce((n, s) => n + s.activities.length, 0),
    cities: trip.stops.map((s) => s.city.name),
    estimatedTotal: trip.budget?.grandTotal ?? 0,
    role: trip.role,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
  };
}

export function toDashboardCard(trip: TripDetail): DashboardTripCard {
  return {
    id: trip.id,
    name: trip.name,
    description: trip.description,
    coverImageUrl: trip.coverImageUrl,
    startDate: trip.startDate,
    endDate: trip.endDate,
    durationDays: trip.durationDays,
    daysUntilStart: trip.daysUntilStart,
    travelers: trip.travelers,
    currency: trip.currency,
    status: trip.status,
    isPublic: trip.isPublic,
    stopCount: trip.stops.length,
    activityCount: trip.stops.reduce((n, s) => n + s.activities.length, 0),
    destinations: trip.stops.map((s) => s.city.name),
    countries: [...new Set(trip.stops.map((s) => s.city.country))],
    heroImage: trip.coverImageUrl ?? trip.stops[0]?.city.imageUrl ?? null,
    estimatedTotal: trip.budget?.grandTotal ?? 0,
  };
}

export function getDashboard(): Dashboard {
  const upcoming = mockTrips.filter((t) => t.status === 'PLANNED').map(toDashboardCard);
  const ongoing = mockTrips.filter((t) => t.status === 'ONGOING').map(toDashboardCard);
  const recent = mockTrips.slice().sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1)).map(toDashboardCard);
  const totalEstimated = mockTrips.reduce((sum, t) => sum + (t.budget?.grandTotal ?? 0), 0);
  const totalPlanned = mockTrips.reduce(
    (sum, t) => sum + (t.budget?.plannedTotal ?? 0),
    0,
  );
  const avgPerDay =
    mockTrips.reduce((sum, t) => sum + (t.budget?.perDayAverage ?? 0), 0) / mockTrips.length;

  const byStatus: Record<TripStatus, number> = {
    DRAFT: 0,
    PLANNED: 0,
    ONGOING: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  };
  mockTrips.forEach((t) => {
    byStatus[t.status] += 1;
  });

  const firstName = mockCurrentUser.name.split(' ')[0];
  const next = upcoming[0];
  let welcomeMessage = `Welcome back, ${firstName}! Ready to plan your next adventure?`;
  if (next) {
    if (next.daysUntilStart <= 0) welcomeMessage = `Welcome back, ${firstName}! Your trip "${next.name}" starts today.`;
    else if (next.daysUntilStart === 1) welcomeMessage = `Welcome back, ${firstName}! "${next.name}" starts tomorrow.`;
    else welcomeMessage = `Welcome back, ${firstName}! ${next.daysUntilStart} days until "${next.name}".`;
  }

  return {
    user: {
      name: mockCurrentUser.name,
      email: mockCurrentUser.email,
      avatarUrl: mockProfile.avatarUrl,
      currency: mockProfile.currency,
      language: mockProfile.language,
    },
    welcomeMessage,
    stats: {
      totalTrips: mockTrips.length,
      upcomingTrips: upcoming.length,
      ongoingTrips: ongoing.length,
      completedTrips: byStatus.COMPLETED,
      byStatus,
      unreadNotifications: 2,
    },
    upcomingTrips: upcoming,
    ongoingTrips: ongoing,
    recentTrips: recent,
    countdowns: upcoming.map((t) => ({
      tripId: t.id,
      tripName: t.name,
      startDate: t.startDate,
      daysRemaining: t.daysUntilStart,
      coverImageUrl: t.coverImageUrl,
      firstCity: t.destinations[0] ?? null,
    })),
    budgetSummary: {
      totalEstimated: Number(totalEstimated.toFixed(2)),
      totalPlanned: Number(totalPlanned.toFixed(2)),
      averagePerDay: Number(avgPerDay.toFixed(2)),
      highlights: [...upcoming, ...ongoing].slice(0, 3).map((t) => {
        const trip = mockTrips.find((x) => x.id === t.id)!;
        return {
          tripId: t.id,
          tripName: t.name,
          currency: t.currency,
          estimated: trip.budget?.grandTotal ?? 0,
          planned: trip.budget?.plannedTotal ?? null,
          isOverBudget:
            (trip.budget?.plannedTotal ?? 0) > 0 &&
            (trip.budget?.grandTotal ?? 0) > (trip.budget?.plannedTotal ?? 0),
        };
      }),
    },
    recommendedCities: mockCities.filter((c) => !['city-bali'].includes(c.id)).slice(0, 6),
  };
}

function toItineraryActivityBlock(a: StopActivity): import('@/types').ItineraryActivityBlock {
  return { ...a };
}

export function getItinerary(tripId: string, view: 'timeline' | 'list' = 'timeline'): Itinerary {
  const trip = getTripById(tripId);
  if (!trip) throw new Error('Trip not found');

  const start = parseISO(trip.startDate);
  const end = parseISO(trip.endDate);
  const days: ItineraryDay[] = [];
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    const dateStr = format(d, 'yyyy-MM-dd');
    const stop = trip.stops.find(
      (s) => dateStr >= s.arrivalDate && dateStr <= s.departureDate,
    );
    const activities: import('@/types').ItineraryActivityBlock[] = [];
    if (stop) {
      stop.activities.forEach((a) => {
        const effectiveDate = a.scheduledDate ?? stop.arrivalDate;
        if (effectiveDate === dateStr) {
          activities.push(toItineraryActivityBlock(a));
        }
      });
    }
    activities.sort((a, b) => {
      if (!a.startTime && !b.startTime) return 0;
      if (!a.startTime) return 1;
      if (!b.startTime) return -1;
      return a.startTime.localeCompare(b.startTime);
    });
    const dayCost = activities.reduce((sum, a) => sum + a.cost, 0) * trip.travelers;
    days.push({
      date: dateStr,
      dayNumber: days.length + 1,
      weekday: format(d, 'EEEE'),
      city: stop
        ? { id: stop.city.id, name: stop.city.name, country: stop.city.country, imageUrl: stop.city.imageUrl }
        : null,
      stopId: stop?.id ?? null,
      isArrivalDay: stop ? stop.arrivalDate === dateStr : false,
      isDepartureDay: stop ? stop.departureDate === dateStr : false,
      activities,
      dayCost: Number(dayCost.toFixed(2)),
      totalMinutes: activities.reduce((sum, a) => sum + a.durationMinutes, 0),
    });
  }

  const list: ItineraryStopGroup[] = trip.stops.map((stop) => {
    const activities = stop.activities.map(toItineraryActivityBlock);
    const meals = stop.mealsPerDayCost * stop.days * trip.travelers;
    const acts = activities.reduce((sum, a) => sum + a.cost, 0) * trip.travelers;
    const total = stop.transportCost + stop.accommodationCost + meals + acts;
    return {
      stopId: stop.id,
      sequence: stop.sequence,
      arrivalDate: stop.arrivalDate,
      departureDate: stop.departureDate,
      days: stop.days,
      nights: stop.nights,
      notes: stop.notes,
      city: { ...stop.city, latitude: stop.city.latitude, longitude: stop.city.longitude },
      activities,
      costs: {
        transport: stop.transportCost,
        stay: stop.accommodationCost,
        meals: Number(meals.toFixed(2)),
        activities: Number(acts.toFixed(2)),
        total: Number(total.toFixed(2)),
      },
    };
  });

  const timeline = view === 'timeline' ? days : days;

  return {
    trip: {
      id: trip.id,
      name: trip.name,
      description: trip.description,
      coverImageUrl: trip.coverImageUrl,
      startDate: trip.startDate,
      endDate: trip.endDate,
      durationDays: trip.durationDays,
      travelers: trip.travelers,
      currency: trip.currency,
      status: trip.status,
      owner: { id: trip.owner.id, name: trip.owner.name },
    },
    view,
    summary: {
      totalDays: days.length,
      totalStops: trip.stops.length,
      totalActivities: trip.stops.reduce((n, s) => n + s.activities.length, 0),
      totalCities: new Set(trip.stops.map((s) => s.city.id)).size,
      countries: [...new Set(trip.stops.map((s) => s.city.country))],
      activitiesCost: Number(
        days.reduce((sum, d) => sum + d.dayCost, 0).toFixed(2),
      ),
    },
    timeline,
    list,
  };
}

export function getCalendar(tripId: string): TripCalendar {
  const trip = getTripById(tripId);
  if (!trip) throw new Error('Trip not found');

  const itinerary = getItinerary(tripId, 'timeline');
  const days = itinerary.timeline.map((day) => {
    const events: import('@/types').CalendarEvent[] = [];
    if (day.stopId && day.isArrivalDay) {
      const stop = trip.stops.find((s) => s.id === day.stopId)!;
      events.push({
        id: `travel-${stop.id}`,
        kind: 'travel',
        title: `Arrive in ${stop.city.name}`,
        startTime: null,
        endTime: null,
        durationMinutes: null,
        cost: stop.transportCost,
        city: stop.city.name,
        stopId: stop.id,
        imageUrl: stop.city.imageUrl,
        allDay: true,
      });
    }
    day.activities.forEach((a) => {
      events.push({
        id: a.id,
        kind: 'activity',
        title: a.name,
        startTime: a.startTime,
        endTime: a.endTime,
        durationMinutes: a.durationMinutes,
        cost: a.cost,
        city: day.city?.name ?? null,
        stopId: day.stopId ?? '',
        imageUrl: a.imageUrl,
        allDay: a.startTime === null,
      });
    });
    if (day.stopId && !day.isDepartureDay) {
      const stop = trip.stops.find((s) => s.id === day.stopId)!;
      events.push({
        id: `stay-${stop.id}-${day.date}`,
        kind: 'stay',
        title: `Overnight in ${stop.city.name}`,
        startTime: null,
        endTime: null,
        durationMinutes: null,
        cost: Number((stop.accommodationCost / Math.max(stop.nights, 1)).toFixed(2)),
        city: stop.city.name,
        stopId: stop.id,
        imageUrl: stop.city.imageUrl,
        allDay: true,
      });
    }
    return { ...day, eventCount: events.length, totalCost: 0, events };
  });

  return {
    tripId: trip.id,
    tripName: trip.name,
    currency: trip.currency,
    from: trip.startDate,
    to: trip.endDate,
    totalEvents: days.reduce((n, d) => n + d.eventCount, 0),
    days,
  };
}

export function getBudget(tripId: string): Budget {
  const trip = getTripById(tripId);
  if (!trip) throw new Error('Trip not found');

  const transport = trip.stops.reduce((sum, s) => sum + s.transportCost, 0);
  const stay = trip.stops.reduce((sum, s) => sum + s.accommodationCost, 0);
  const meals = trip.stops.reduce((sum, s) => sum + s.mealsPerDayCost * s.days * trip.travelers, 0);
  const activities = trip.stops.reduce(
    (sum, s) => sum + s.activities.reduce((a, act) => a + act.cost, 0) * trip.travelers,
    0,
  );
  const other = 0;
  const total = transport + stay + meals + activities + other;
  const plannedTotal = trip.budget?.plannedTotal ?? null;
  const dailyLimit = 300;

  const daily: import('@/types').DailyBudgetEntry[] = [];
  for (let i = 0; i < trip.durationDays; i++) {
    const date = format(addDays(parseISO(trip.startDate), i), 'yyyy-MM-dd');
    daily.push({
      date,
      dayNumber: i + 1,
      city: null,
      transport: 0,
      stay: 0,
      meals: 0,
      activities: 0,
      other: 0,
      total: 0,
      isOverBudget: false,
    });
  }

  trip.stops.forEach((stop) => {
    const stopDates: string[] = [];
    for (let d = parseISO(stop.arrivalDate); d <= parseISO(stop.departureDate); d = addDays(d, 1)) {
      stopDates.push(format(d, 'yyyy-MM-dd'));
    }
    stopDates.forEach((date, idx) => {
      const bucket = daily.find((d) => d.date === date);
      if (!bucket) return;
      bucket.city ??= stop.city.name;
      bucket.stay += Number((stop.accommodationCost / stopDates.length).toFixed(2));
      bucket.meals += stop.mealsPerDayCost * trip.travelers;
      if (idx === 0) bucket.transport += stop.transportCost;
    });
    stop.activities.forEach((a) => {
      const key = a.scheduledDate ?? stop.arrivalDate;
      const bucket = daily.find((d) => d.date === key);
      if (bucket) bucket.activities += a.cost * trip.travelers;
    });
  });

  mockExpenses
    .filter((e) => e.tripId === tripId)
    .forEach((e) => {
      const bucket = daily.find((d) => d.date === e.incurredOn);
      if (bucket) {
        if (e.category === 'TRANSPORT') bucket.transport += e.amount;
        else if (e.category === 'STAY') bucket.stay += e.amount;
        else if (e.category === 'MEALS') bucket.meals += e.amount;
        else if (e.category === 'ACTIVITIES') bucket.activities += e.amount;
        else bucket.other += e.amount;
      }
    });

  daily.forEach((d) => {
    d.total = Number((d.transport + d.stay + d.meals + d.activities + d.other).toFixed(2));
    d.isOverBudget = d.total > dailyLimit;
  });

  const breakdown = { transport, stay, meals, activities, other };
  const pct = (v: number) => (total > 0 ? Number(((v / total) * 100).toFixed(1)) : 0);

  return {
    tripId: trip.id,
    tripName: trip.name,
    currency: trip.currency,
    travelers: trip.travelers,
    totalDays: trip.durationDays,
    total: Number(total.toFixed(2)),
    plannedTotal,
    remaining: plannedTotal === null ? null : Number((plannedTotal - total).toFixed(2)),
    isOverBudget: plannedTotal !== null && total > plannedTotal,
    breakdown,
    breakdownPercentage: {
      transport: pct(transport),
      stay: pct(stay),
      meals: pct(meals),
      activities: pct(activities),
      other: pct(other),
    },
    perDayAverage: Number((total / trip.durationDays).toFixed(2)),
    perPersonTotal: Number((total / trip.travelers).toFixed(2)),
    dailyLimit,
    daily,
    overBudgetDays: daily.filter((d) => d.isOverBudget).map((d) => ({ date: d.date, total: d.total, overBy: Number((d.total - dailyLimit).toFixed(2)) })),
    overBudgetDayCount: daily.filter((d) => d.isOverBudget).length,
    byStop: trip.stops.map((stop) => {
      const mealsCost = stop.mealsPerDayCost * stop.days * trip.travelers;
      const actCost = stop.activities.reduce((sum, a) => sum + a.cost, 0) * trip.travelers;
      return {
        stopId: stop.id,
        city: stop.city.name,
        country: stop.city.country,
        days: stop.days,
        transport: stop.transportCost,
        stay: stop.accommodationCost,
        meals: Number(mealsCost.toFixed(2)),
        activities: Number(actCost.toFixed(2)),
        total: Number((stop.transportCost + stop.accommodationCost + mealsCost + actCost).toFixed(2)),
      };
    }),
    lastCalculatedAt: new Date().toISOString(),
  };
}

export function getPublicItinerary(slug: string): PublicItinerary {
  const trip = mockTrips.find((t) => t.shares.some((s) => s.slug === slug));
  if (!trip) throw new Error('Share link not found');
  const share = trip.shares.find((s) => s.slug === slug)!;
  const itinerary = getItinerary(trip.id, 'timeline');
  const budget = getBudget(trip.id);
  return {
    slug,
    readOnly: true,
    allowCopy: share.allowCopy,
    sharedBy: trip.owner.name,
    sharedAt: share.createdAt,
    viewCount: share.viewCount,
    copyCount: share.copyCount,
    shareUrl: share.url,
    trip: itinerary.trip,
    summary: itinerary.summary,
    timeline: itinerary.timeline,
    list: itinerary.list,
    budget: {
      currency: budget.currency,
      total: budget.total,
      perDayAverage: budget.perDayAverage,
      breakdown: budget.breakdown,
    },
  };
}

export function getCityDetail(id: string): CityDetail {
  const city = mockCities.find((c) => c.id === id);
  if (!city) throw new Error('City not found');
  return {
    ...city,
    topActivities: mockActivities
      .filter((a) => a.cityId === id)
      .slice(0, 5)
      .map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        estimatedCost: a.estimatedCost,
        currency: a.currency,
        durationMinutes: a.durationMinutes,
        imageUrl: a.imageUrl,
      })),
  };
}

export const mockNotifications: Notification[] = [
  {
    id: 'notif-1',
    userId: mockCurrentUser.id,
    type: 'TRIP_CREATED',
    title: 'Trip created',
    body: 'Your Japan Adventure is ready for planning.',
    data: { tripId: 'trip-japan' },
    readAt: null,
    createdAt: '2025-12-01T10:00:00.000Z',
    updatedAt: '2025-12-01T10:00:00.000Z',
  },
  {
    id: 'notif-2',
    userId: mockCurrentUser.id,
    type: 'BUDGET_ALERT',
    title: 'Budget alert',
    body: 'Your Italian Escape is close to its planned budget.',
    data: { tripId: 'trip-italy' },
    readAt: null,
    createdAt: '2025-12-02T10:00:00.000Z',
    updatedAt: '2025-12-02T10:00:00.000Z',
  },
];

export const mockShareLinks: ShareLink[] = mockTrips.flatMap((t) => t.shares);
