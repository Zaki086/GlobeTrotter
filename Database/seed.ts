/**
 * Seed script — realistic starting data with no external API calls.
 *
 * Produces:
 *   - 55 cities and 220 catalog activities (reference data)
 *   - an ADMIN account and a demo traveler
 *   - a 14-day Japan trip and a 16-day Europe trip, both fully built out
 *     with stops, scheduled activities, expenses and a public share link
 *
 * Idempotent: cities and activities are upserted, and the demo trips are
 * rebuilt from scratch each run so repeated `npm run seed` is safe.
 */

import { ActivityType, ExpenseCategory, PrismaClient, Role, TripMemberRole, TripStatus } from '@prisma/client';
import argon2 from 'argon2';
import { cities, imageFor, ACTIVITY_COUNT, CITY_COUNT } from './data/cities';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@globetrotter.app';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'AdminPass123!';
const DEMO_EMAIL = process.env.SEED_DEMO_EMAIL ?? 'demo@globetrotter.app';
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'DemoPass123!';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Dates are anchored relative to today so the demo trips are always upcoming. */
const today = new Date();
const utcToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
const dayMs = 86_400_000;
const daysFromNow = (n: number) => new Date(utcToday.getTime() + n * dayMs);

async function hash(password: string) {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

async function seedCitiesAndActivities() {
  console.log(`Seeding ${CITY_COUNT} cities and ${ACTIVITY_COUNT} activities...`);

  const cityIdByName = new Map<string, string>();

  for (const city of cities) {
    const record = await prisma.city.upsert({
      where: { name_country: { name: city.name, country: city.country } },
      create: {
        name: city.name,
        country: city.country,
        countryCode: city.countryCode,
        region: city.region,
        timezone: city.timezone,
        latitude: city.latitude,
        longitude: city.longitude,
        costIndex: city.costIndex,
        popularity: city.popularity,
        currency: city.currency,
        description: city.description,
        imageUrl: imageFor(slug(city.name)),
      },
      update: {
        countryCode: city.countryCode,
        region: city.region,
        timezone: city.timezone,
        costIndex: city.costIndex,
        popularity: city.popularity,
        currency: city.currency,
        description: city.description,
        imageUrl: imageFor(slug(city.name)),
      },
    });

    cityIdByName.set(city.name, record.id);

    for (const activity of city.activities) {
      await prisma.activity.upsert({
        where: { cityId_name: { cityId: record.id, name: activity.name } },
        create: {
          cityId: record.id,
          name: activity.name,
          type: activity.type as ActivityType,
          description: activity.description,
          imageUrl: imageFor(slug(`${city.name}-${activity.name}`)),
          estimatedCost: activity.estimatedCost,
          currency: city.currency === 'JPY' || city.currency === 'KRW' ? 'USD' : 'USD',
          durationMinutes: activity.durationMinutes,
          popularity: activity.popularity,
        },
        update: {
          type: activity.type as ActivityType,
          description: activity.description,
          estimatedCost: activity.estimatedCost,
          durationMinutes: activity.durationMinutes,
          popularity: activity.popularity,
        },
      });
    }
  }

  return cityIdByName;
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

async function seedUsers() {
  console.log('Seeding accounts...');

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      email: ADMIN_EMAIL,
      name: 'Platform Admin',
      passwordHash: await hash(ADMIN_PASSWORD),
      role: Role.ADMIN,
      emailVerified: true,
      profile: {
        create: { language: 'en', currency: 'USD', country: 'United States', bio: 'GlobeTrotter platform administrator.' },
      },
    },
    update: { role: Role.ADMIN, isActive: true },
  });

  const demo = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: {
      email: DEMO_EMAIL,
      name: 'Mika Tanaka',
      passwordHash: await hash(DEMO_PASSWORD),
      role: Role.USER,
      emailVerified: true,
      profile: {
        create: {
          language: 'en',
          currency: 'USD',
          country: 'Singapore',
          bio: 'Slow traveler. Three continents a year, always by train where possible.',
          avatarUrl: imageFor('avatar-mika'),
        },
      },
    },
    update: { isActive: true },
  });

  // A second traveler, so collaboration and admin analytics have real data.
  const friend = await prisma.user.upsert({
    where: { email: 'sam@globetrotter.app' },
    create: {
      email: 'sam@globetrotter.app',
      name: 'Sam Okafor',
      passwordHash: await hash('TravelBuddy123!'),
      role: Role.USER,
      emailVerified: true,
      profile: { create: { language: 'en', currency: 'EUR', country: 'Ireland' } },
    },
    update: {},
  });

  return { admin, demo, friend };
}

// ---------------------------------------------------------------------------
// Demo trips
// ---------------------------------------------------------------------------

interface StopPlan {
  city: string;
  arrivalOffset: number;
  departureOffset: number;
  notes: string;
  accommodationCost: number;
  transportCost: number;
  mealsPerDayCost: number;
  /** Activity names to schedule, paired with a day offset from arrival. */
  activities: Array<{ name: string; dayOffset: number; startTime: string; endTime?: string }>;
}

async function buildTrip(params: {
  ownerId: string;
  name: string;
  description: string;
  coverSlug: string;
  startOffset: number;
  endOffset: number;
  travelers: number;
  currency: string;
  plannedTotal: number;
  dailyLimit: number;
  stops: StopPlan[];
  cityIdByName: Map<string, string>;
  collaboratorId?: string;
  share?: boolean;
  expenses?: Array<{ category: ExpenseCategory; title: string; amount: number; dayOffset: number }>;
}) {
  // Rebuild from scratch so reseeding does not stack duplicates.
  await prisma.trip.deleteMany({ where: { ownerId: params.ownerId, name: params.name } });

  const trip = await prisma.trip.create({
    data: {
      ownerId: params.ownerId,
      name: params.name,
      description: params.description,
      coverImageUrl: imageFor(params.coverSlug),
      startDate: daysFromNow(params.startOffset),
      endDate: daysFromNow(params.endOffset),
      travelers: params.travelers,
      currency: params.currency,
      status: TripStatus.PLANNED,
      members: { create: { userId: params.ownerId, role: TripMemberRole.OWNER } },
      budget: {
        create: {
          currency: params.currency,
          plannedTotal: params.plannedTotal,
          dailyLimit: params.dailyLimit,
        },
      },
    },
  });

  if (params.collaboratorId) {
    await prisma.tripMember.create({
      data: { tripId: trip.id, userId: params.collaboratorId, role: TripMemberRole.EDITOR },
    });
  }

  for (const [index, plan] of params.stops.entries()) {
    const cityId = params.cityIdByName.get(plan.city);
    if (!cityId) throw new Error(`Seed city not found: ${plan.city}`);

    const arrival = daysFromNow(params.startOffset + plan.arrivalOffset);

    const stop = await prisma.stop.create({
      data: {
        tripId: trip.id,
        cityId,
        sequence: index,
        arrivalDate: arrival,
        departureDate: daysFromNow(params.startOffset + plan.departureOffset),
        notes: plan.notes,
        accommodationCost: plan.accommodationCost,
        transportCost: plan.transportCost,
        mealsPerDayCost: plan.mealsPerDayCost,
      },
    });

    for (const [seq, item] of plan.activities.entries()) {
      const activity = await prisma.activity.findFirst({
        where: { cityId, name: item.name },
        select: { id: true, durationMinutes: true },
      });
      if (!activity) throw new Error(`Seed activity not found: ${item.name} (${plan.city})`);

      await prisma.stopActivity.create({
        data: {
          stopId: stop.id,
          activityId: activity.id,
          scheduledDate: new Date(arrival.getTime() + item.dayOffset * dayMs),
          startTime: item.startTime,
          endTime: item.endTime,
          sequence: seq,
        },
      });
    }
  }

  for (const expense of params.expenses ?? []) {
    await prisma.expense.create({
      data: {
        tripId: trip.id,
        createdById: params.ownerId,
        category: expense.category,
        title: expense.title,
        amount: expense.amount,
        currency: params.currency,
        incurredOn: daysFromNow(params.startOffset + expense.dayOffset),
      },
    });
  }

  if (params.share) {
    await prisma.sharedItinerary.create({
      data: {
        tripId: trip.id,
        createdById: params.ownerId,
        slug: `${slug(params.name)}-${Math.random().toString(36).slice(2, 14)}`,
        allowCopy: true,
        viewCount: Math.floor(Math.random() * 200) + 40,
        copyCount: Math.floor(Math.random() * 12),
      },
    });
    await prisma.trip.update({ where: { id: trip.id }, data: { isPublic: true } });
  }

  return trip;
}

/**
 * Recomputes the budget rollup for a trip using the same arithmetic as
 * BudgetService, so seeded trips look identical to ones built through the API.
 */
async function recalculateBudget(tripId: string) {
  const trip = await prisma.trip.findUniqueOrThrow({
    where: { id: tripId },
    select: {
      travelers: true,
      currency: true,
      startDate: true,
      endDate: true,
      stops: {
        select: {
          arrivalDate: true,
          departureDate: true,
          accommodationCost: true,
          transportCost: true,
          mealsPerDayCost: true,
          activities: { select: { costOverride: true, activity: { select: { estimatedCost: true } } } },
        },
      },
      expenses: { select: { category: true, amount: true } },
    },
  });

  let transport = 0;
  let stay = 0;
  let meals = 0;
  let activities = 0;
  let other = 0;

  for (const stop of trip.stops) {
    transport += Number(stop.transportCost);
    stay += Number(stop.accommodationCost);
    const days = Math.max(
      1,
      Math.round((stop.departureDate.getTime() - stop.arrivalDate.getTime()) / dayMs) + 1,
    );
    meals += Number(stop.mealsPerDayCost) * days * trip.travelers;
    for (const sa of stop.activities) {
      activities += Number(sa.costOverride ?? sa.activity.estimatedCost) * trip.travelers;
    }
  }

  for (const expense of trip.expenses) {
    const amount = Number(expense.amount);
    if (expense.category === ExpenseCategory.TRANSPORT) transport += amount;
    else if (expense.category === ExpenseCategory.STAY) stay += amount;
    else if (expense.category === ExpenseCategory.MEALS) meals += amount;
    else if (expense.category === ExpenseCategory.ACTIVITIES) activities += amount;
    else other += amount;
  }

  const grandTotal = transport + stay + meals + activities + other;
  const totalDays = Math.max(
    1,
    Math.round((trip.endDate.getTime() - trip.startDate.getTime()) / dayMs) + 1,
  );

  await prisma.budget.update({
    where: { tripId },
    data: {
      transportTotal: transport.toFixed(2),
      stayTotal: stay.toFixed(2),
      mealsTotal: meals.toFixed(2),
      activitiesTotal: activities.toFixed(2),
      otherTotal: other.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
      perDayAverage: (grandTotal / totalDays).toFixed(2),
      lastCalculatedAt: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('\nGlobeTrotter database seed\n' + '='.repeat(40));

  const cityIdByName = await seedCitiesAndActivities();
  const { admin, demo, friend } = await seedUsers();

  console.log('Building the sample Japan trip...');
  const japan = await buildTrip({
    ownerId: demo.id,
    name: 'Cherry Blossom Japan',
    description:
      'Two weeks from Tokyo down to Osaka, timed for the sakura and built around the JR Pass. Trains between every city, no domestic flights.',
    coverSlug: 'trip-japan',
    startOffset: 45,
    endOffset: 58,
    travelers: 2,
    currency: 'USD',
    plannedTotal: 6800,
    dailyLimit: 420,
    cityIdByName,
    collaboratorId: friend.id,
    share: true,
    stops: [
      {
        city: 'Tokyo',
        arrivalOffset: 0,
        departureOffset: 4,
        notes: 'Base in Shinjuku. Buy the JR Pass on arrival at Narita.',
        accommodationCost: 720,
        transportCost: 1450,
        mealsPerDayCost: 55,
        activities: [
          { name: 'Senso-ji Temple and Nakamise Street', dayOffset: 1, startTime: '09:00', endTime: '11:00' },
          { name: 'Tsukiji Outer Market food walk', dayOffset: 1, startTime: '12:00', endTime: '14:30' },
          { name: 'Shibuya Crossing and Sky observation deck', dayOffset: 2, startTime: '16:00', endTime: '17:30' },
          { name: 'Golden Gai bar hopping', dayOffset: 2, startTime: '20:00', endTime: '23:00' },
        ],
      },
      {
        city: 'Hakone',
        arrivalOffset: 4,
        departureOffset: 6,
        notes: 'Ryokan with a private onsen. Luggage forwarded ahead to Kyoto.',
        accommodationCost: 480,
        transportCost: 90,
        mealsPerDayCost: 70,
        activities: [
          { name: 'Hakone Ropeway over Owakudani', dayOffset: 0, startTime: '11:00', endTime: '12:30' },
          { name: 'Onsen bathing at a traditional ryokan', dayOffset: 0, startTime: '17:00', endTime: '19:00' },
          { name: 'Lake Ashi pirate ship cruise', dayOffset: 1, startTime: '10:00', endTime: '11:00' },
        ],
      },
      {
        city: 'Kyoto',
        arrivalOffset: 6,
        departureOffset: 11,
        notes: 'Machiya rental near Nishiki. Rent bicycles for the temple days.',
        accommodationCost: 940,
        transportCost: 130,
        mealsPerDayCost: 60,
        activities: [
          { name: 'Fushimi Inari Shrine hike', dayOffset: 1, startTime: '07:00', endTime: '10:00' },
          { name: 'Arashiyama Bamboo Grove at dawn', dayOffset: 2, startTime: '06:30', endTime: '08:00' },
          { name: 'Traditional tea ceremony in Gion', dayOffset: 3, startTime: '14:00', endTime: '15:15' },
          { name: 'Kaiseki dinner in Pontocho', dayOffset: 3, startTime: '19:00', endTime: '21:30' },
        ],
      },
      {
        city: 'Osaka',
        arrivalOffset: 11,
        departureOffset: 13,
        notes: 'Last two nights near Namba for the airport train.',
        accommodationCost: 320,
        transportCost: 45,
        mealsPerDayCost: 65,
        activities: [
          { name: 'Osaka Castle and park grounds', dayOffset: 0, startTime: '10:00', endTime: '12:00' },
          { name: 'Dotonbori street food crawl', dayOffset: 0, startTime: '18:00', endTime: '20:30' },
          { name: 'Kuromon Ichiba Market', dayOffset: 1, startTime: '09:30', endTime: '11:00' },
        ],
      },
    ],
    expenses: [
      { category: ExpenseCategory.TRANSPORT, title: 'JR Pass (14 day, x2)', amount: 990, dayOffset: 0 },
      { category: ExpenseCategory.SHOPPING, title: 'Ceramics from Kiyomizu-zaka', amount: 145, dayOffset: 8 },
      { category: ExpenseCategory.MEALS, title: 'Ichiran ramen, twice', amount: 38, dayOffset: 2 },
    ],
  });

  console.log('Building the sample Europe trip...');
  const europe = await buildTrip({
    ownerId: demo.id,
    name: 'Classic Europe by Rail',
    description:
      'Sixteen days across four countries entirely by train — Paris to Rome via the Alps, with an Interrail pass and no internal flights.',
    coverSlug: 'trip-europe',
    startOffset: 120,
    endOffset: 135,
    travelers: 2,
    currency: 'EUR',
    plannedTotal: 7200,
    dailyLimit: 400,
    cityIdByName,
    share: true,
    stops: [
      {
        city: 'Paris',
        arrivalOffset: 0,
        departureOffset: 4,
        notes: 'Apartment in the 11th. Museum Pass for the first three days.',
        accommodationCost: 820,
        transportCost: 640,
        mealsPerDayCost: 75,
        activities: [
          { name: 'Eiffel Tower summit ascent', dayOffset: 1, startTime: '09:30', endTime: '12:00' },
          { name: 'Louvre Museum highlights tour', dayOffset: 2, startTime: '09:00', endTime: '12:00' },
          { name: 'Marais food and wine walk', dayOffset: 2, startTime: '18:00', endTime: '21:00' },
          { name: 'Seine evening river cruise', dayOffset: 3, startTime: '20:30', endTime: '21:45' },
        ],
      },
      {
        city: 'Interlaken',
        arrivalOffset: 4,
        departureOffset: 7,
        notes: 'TGV to Basel then regional. Watch the weather for the Jungfrau day.',
        accommodationCost: 690,
        transportCost: 180,
        mealsPerDayCost: 85,
        activities: [
          { name: 'Lauterbrunnen valley waterfall walk', dayOffset: 1, startTime: '09:00', endTime: '13:00' },
          { name: 'Jungfraujoch "Top of Europe" railway', dayOffset: 2, startTime: '07:30', endTime: '14:30' },
          { name: 'Harder Kulm funicular', dayOffset: 2, startTime: '17:00', endTime: '19:30' },
        ],
      },
      {
        city: 'Venice',
        arrivalOffset: 7,
        departureOffset: 10,
        notes: 'Direct train through the Simplon tunnel. Stay in Cannaregio, not San Marco.',
        accommodationCost: 610,
        transportCost: 145,
        mealsPerDayCost: 80,
        activities: [
          { name: "St Mark's Basilica and Doge's Palace", dayOffset: 1, startTime: '09:00', endTime: '12:00' },
          { name: 'Cicchetti and ombra bar crawl', dayOffset: 1, startTime: '18:30', endTime: '21:00' },
          { name: 'Murano and Burano island hop', dayOffset: 2, startTime: '09:30', endTime: '14:30' },
        ],
      },
      {
        city: 'Florence',
        arrivalOffset: 10,
        departureOffset: 13,
        notes: 'Frecciarossa, two hours. Book the Uffizi and the dome climb weeks ahead.',
        accommodationCost: 540,
        transportCost: 95,
        mealsPerDayCost: 70,
        activities: [
          { name: 'Uffizi Gallery timed entry', dayOffset: 1, startTime: '08:30', endTime: '11:30' },
          { name: 'Climb the Duomo cupola', dayOffset: 1, startTime: '15:00', endTime: '16:30' },
          { name: 'Tuscan wine tasting in Chianti', dayOffset: 2, startTime: '10:00', endTime: '15:00' },
        ],
      },
      {
        city: 'Rome',
        arrivalOffset: 13,
        departureOffset: 15,
        notes: 'Final stop. Fly home from Fiumicino.',
        accommodationCost: 430,
        transportCost: 80,
        mealsPerDayCost: 75,
        activities: [
          { name: 'Colosseum and Roman Forum tour', dayOffset: 0, startTime: '09:00', endTime: '12:30' },
          { name: 'Trastevere evening food crawl', dayOffset: 0, startTime: '19:00', endTime: '22:00' },
          { name: 'Vatican Museums and Sistine Chapel', dayOffset: 1, startTime: '08:00', endTime: '12:00' },
          { name: 'Pantheon and Piazza Navona walk', dayOffset: 1, startTime: '17:00', endTime: '19:00' },
        ],
      },
    ],
    expenses: [
      { category: ExpenseCategory.TRANSPORT, title: 'Interrail Global Pass (x2)', amount: 780, dayOffset: 0 },
      { category: ExpenseCategory.ACTIVITIES, title: 'Skip-the-line booking fees', amount: 64, dayOffset: 2 },
      { category: ExpenseCategory.OTHER, title: 'Travel insurance', amount: 120, dayOffset: 0 },
    ],
  });

  // A short completed trip so the dashboard and analytics have history.
  console.log('Building a past trip for history...');
  const past = await buildTrip({
    ownerId: demo.id,
    name: 'Lisbon Long Weekend',
    description: 'Four days of tram rides, pasteis de nata and a day trip to Sintra.',
    coverSlug: 'trip-lisbon',
    startOffset: -60,
    endOffset: -56,
    travelers: 1,
    currency: 'EUR',
    plannedTotal: 900,
    dailyLimit: 200,
    cityIdByName,
    stops: [
      {
        city: 'Lisbon',
        arrivalOffset: 0,
        departureOffset: 4,
        notes: 'Alfama guesthouse, walked everywhere.',
        accommodationCost: 310,
        transportCost: 180,
        mealsPerDayCost: 45,
        activities: [
          { name: 'Tram 28 route and Alfama walk', dayOffset: 0, startTime: '10:00', endTime: '12:30' },
          { name: 'Belem Tower and Jeronimos Monastery', dayOffset: 1, startTime: '09:30', endTime: '13:00' },
          { name: 'Sintra day trip', dayOffset: 2, startTime: '08:30', endTime: '15:30' },
          { name: 'Fado dinner in Bairro Alto', dayOffset: 3, startTime: '20:00', endTime: '22:30' },
        ],
      },
    ],
  });
  await prisma.trip.update({ where: { id: past.id }, data: { status: TripStatus.COMPLETED } });

  // A trip owned by the second user, so admin analytics are not single-user.
  console.log('Building a second traveler trip...');
  const samTrip = await buildTrip({
    ownerId: friend.id,
    name: 'Iceland Ring Road',
    description: 'A week chasing waterfalls, glaciers and the aurora.',
    coverSlug: 'trip-iceland',
    startOffset: 90,
    endOffset: 96,
    travelers: 2,
    currency: 'EUR',
    plannedTotal: 4200,
    dailyLimit: 500,
    cityIdByName,
    stops: [
      {
        city: 'Reykjavik',
        arrivalOffset: 0,
        departureOffset: 6,
        notes: 'Campervan hire from the airport.',
        accommodationCost: 980,
        transportCost: 720,
        mealsPerDayCost: 90,
        activities: [
          { name: 'Golden Circle tour', dayOffset: 1, startTime: '08:00', endTime: '16:00' },
          { name: 'Blue Lagoon geothermal spa', dayOffset: 2, startTime: '13:00', endTime: '16:00' },
          { name: 'Northern lights hunt', dayOffset: 3, startTime: '21:00', endTime: '01:00' },
        ],
      },
    ],
  });

  for (const tripId of [japan.id, europe.id, past.id, samTrip.id]) {
    await recalculateBudget(tripId);
  }

  // Seed a couple of notifications so the bell icon is not empty.
  await prisma.notification.deleteMany({ where: { userId: demo.id } });
  await prisma.notification.createMany({
    data: [
      {
        userId: demo.id,
        type: 'TRIP_SHARED',
        title: 'Cherry Blossom Japan is now shareable',
        body: 'Anyone with the link can view this itinerary.',
        data: { tripId: japan.id },
      },
      {
        userId: demo.id,
        type: 'MEMBER_ADDED',
        title: 'Sam Okafor joined Cherry Blossom Japan',
        body: 'They now have editor access to this trip.',
        data: { tripId: japan.id },
      },
    ],
  });

  // Save a few destinations on the demo profile.
  const savedIds = ['Seoul', 'Marrakech', 'Queenstown']
    .map((name) => cityIdByName.get(name))
    .filter((id): id is string => Boolean(id));
  await prisma.profile.update({
    where: { userId: demo.id },
    data: { savedDestinations: savedIds },
  });

  const [cityCount, activityCount, tripCount, userCount] = await Promise.all([
    prisma.city.count(),
    prisma.activity.count(),
    prisma.trip.count(),
    prisma.user.count(),
  ]);

  console.log('\n' + '='.repeat(40));
  console.log('Seed complete.\n');
  console.log(`  Cities      ${cityCount}`);
  console.log(`  Activities  ${activityCount}`);
  console.log(`  Users       ${userCount}`);
  console.log(`  Trips       ${tripCount}`);
  console.log('\nSign in with:');
  console.log(`  ADMIN   ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  DEMO    ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  FRIEND  sam@globetrotter.app / TravelBuddy123!`);

  const share = await prisma.sharedItinerary.findFirst({
    where: { tripId: japan.id },
    select: { slug: true },
  });
  if (share) console.log(`\nPublic itinerary: GET /api/v1/public/${share.slug}`);
  console.log('');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
