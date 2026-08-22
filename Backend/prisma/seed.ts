/**
 * Seed script — real India destination data, no external API calls.
 *
 * Produces:
 *   - 61 Indian cities and 263 real attractions (reference data)
 *   - an ADMIN account and demo travelers
 *   - four India itineraries: Golden Triangle, Kerala, Ladakh and Rajasthan
 *   - community posts written about those destinations
 *
 * Idempotent: reference data is upserted, and the demo trips are rebuilt from
 * scratch each run, so repeated `npm run seed` is safe.
 */

import {
  ActivityType,
  ExpenseCategory,
  PrismaClient,
  Role,
  TripMemberRole,
  TripStatus,
} from '@prisma/client';
import argon2 from 'argon2';
import {
  indiaCities,
  ratesFor,
  REGION_PEAK_MONTHS,
  INDIA_ACTIVITY_COUNT,
  INDIA_CITY_COUNT,
  INDIA_CURRENCY,
  INDIA_TIMEZONE,
} from './data/india';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@globetrotter.app';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'AdminPass123!';
const DEMO_EMAIL = process.env.SEED_DEMO_EMAIL ?? 'demo@globetrotter.app';
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'DemoPass123!';

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const dayMs = 86_400_000;
const today = new Date();
const utcToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
const daysFromNow = (n: number) => new Date(utcToday.getTime() + n * dayMs);

const img = (seed: string, w = 800, h = 600) =>
  `https://picsum.photos/seed/${slug(seed)}/${w}/${h}`;

async function hash(password: string) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

async function seedCitiesAndActivities() {
  console.log(`Seeding ${INDIA_CITY_COUNT} Indian cities and ${INDIA_ACTIVITY_COUNT} attractions…`);

  const cityIdByName = new Map<string, string>();

  for (const city of indiaCities) {
    const record = await prisma.city.upsert({
      where: { name_country: { name: city.name, country: 'India' } },
      create: {
        name: city.name,
        country: 'India',
        countryCode: 'IN',
        // The wireframe filters by region; the Indian state is carried in the
        // description so it stays visible on the city card.
        region: city.region,
        timezone: INDIA_TIMEZONE,
        latitude: city.latitude,
        longitude: city.longitude,
        costIndex: city.costIndex,
        popularity: city.popularity,
        currency: INDIA_CURRENCY,
        description: `${city.state} · ${city.description}`,
        imageUrl: img(city.name),
        ...ratesFor(city),
        peakMonths: city.peakMonths ?? REGION_PEAK_MONTHS[city.region] ?? [],
      },
      update: {
        region: city.region,
        timezone: INDIA_TIMEZONE,
        latitude: city.latitude,
        longitude: city.longitude,
        costIndex: city.costIndex,
        popularity: city.popularity,
        currency: INDIA_CURRENCY,
        description: `${city.state} · ${city.description}`,
        imageUrl: img(city.name),
        ...ratesFor(city),
        peakMonths: city.peakMonths ?? REGION_PEAK_MONTHS[city.region] ?? [],
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
          imageUrl: img(`${city.name}-${activity.name}`),
          estimatedCost: activity.estimatedCost,
          currency: INDIA_CURRENCY,
          durationMinutes: activity.durationMinutes,
          popularity: activity.popularity,
        },
        update: {
          type: activity.type as ActivityType,
          description: activity.description,
          estimatedCost: activity.estimatedCost,
          currency: INDIA_CURRENCY,
          durationMinutes: activity.durationMinutes,
          popularity: activity.popularity,
        },
      });
    }
  }

  // Drop attractions this city no longer lists. A city that existed in the
  // previous world-wide catalog (Jaipur, say) keeps its row through the
  // upsert, and its old activities would otherwise linger with the wrong
  // currency and prices.
  for (const city of indiaCities) {
    const cityId = cityIdByName.get(city.name)!;
    const keep = city.activities.map((a) => a.name);
    const stale = await prisma.activity.findMany({
      where: { cityId, name: { notIn: keep } },
      select: { id: true },
    });
    if (stale.length === 0) continue;

    const staleIds = stale.map((a) => a.id);
    // stop_activities cascade from activities, so scheduled copies go too.
    await prisma.activity.deleteMany({ where: { id: { in: staleIds } } });
    console.log(`  pruned ${stale.length} stale attraction(s) from ${city.name}`);
  }

  return cityIdByName;
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

async function seedUsers() {
  console.log('Seeding accounts…');

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      email: ADMIN_EMAIL,
      name: 'Platform Admin',
      passwordHash: await hash(ADMIN_PASSWORD),
      role: Role.ADMIN,
      emailVerified: true,
      profile: {
        create: {
          language: 'en',
          currency: INDIA_CURRENCY,
          country: 'India',
          bio: 'GlobeTrotter platform administrator.',
        },
      },
    },
    update: { role: Role.ADMIN, isActive: true },
  });

  const demo = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: {
      email: DEMO_EMAIL,
      name: 'Ananya Sharma',
      passwordHash: await hash(DEMO_PASSWORD),
      role: Role.USER,
      emailVerified: true,
      profile: {
        create: {
          language: 'en',
          currency: INDIA_CURRENCY,
          country: 'India',
          phone: '+91 98200 11223',
          bio: 'Slow traveller. Trains over flights, always.',
          avatarUrl: img('avatar-ananya', 200, 200),
        },
      },
    },
    update: { isActive: true },
  });

  const friend = await prisma.user.upsert({
    where: { email: 'rahul@globetrotter.app' },
    create: {
      email: 'rahul@globetrotter.app',
      name: 'Rahul Menon',
      passwordHash: await hash('TravelBuddy123!'),
      role: Role.USER,
      emailVerified: true,
      profile: {
        create: { language: 'en', currency: INDIA_CURRENCY, country: 'India' },
      },
    },
    update: {},
  });

  const third = await prisma.user.upsert({
    where: { email: 'priya@globetrotter.app' },
    create: {
      email: 'priya@globetrotter.app',
      name: 'Priya Nair',
      passwordHash: await hash('TravelBuddy123!'),
      role: Role.USER,
      emailVerified: true,
      profile: {
        create: { language: 'en', currency: INDIA_CURRENCY, country: 'India' },
      },
    },
    update: {},
  });

  return { admin, demo, friend, third };
}

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

interface StopPlan {
  city: string;
  arrivalOffset: number;
  departureOffset: number;
  notes: string;
  accommodationCost: number;
  transportCost: number;
  mealsPerDayCost: number;
  activities: Array<{ name: string; dayOffset: number; startTime: string; endTime?: string }>;
}

async function buildTrip(params: {
  ownerId: string;
  name: string;
  description: string;
  startOffset: number;
  endOffset: number;
  travelers: number;
  plannedTotal: number;
  dailyLimit: number;
  stops: StopPlan[];
  cityIdByName: Map<string, string>;
  collaboratorId?: string;
  share?: boolean;
  status?: TripStatus;
  expenses?: Array<{ category: ExpenseCategory; title: string; amount: number; dayOffset: number }>;
}) {
  await prisma.trip.deleteMany({ where: { ownerId: params.ownerId, name: params.name } });

  const trip = await prisma.trip.create({
    data: {
      ownerId: params.ownerId,
      name: params.name,
      description: params.description,
      coverImageUrl: img(`trip-${params.name}`, 1200, 800),
      startDate: daysFromNow(params.startOffset),
      endDate: daysFromNow(params.endOffset),
      travelers: params.travelers,
      currency: INDIA_CURRENCY,
      status: params.status ?? TripStatus.PLANNED,
      members: { create: { userId: params.ownerId, role: TripMemberRole.OWNER } },
      budget: {
        create: {
          currency: INDIA_CURRENCY,
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
        select: { id: true },
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
        currency: INDIA_CURRENCY,
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
        viewCount: Math.floor(Math.random() * 400) + 60,
        copyCount: Math.floor(Math.random() * 20),
      },
    });
    await prisma.trip.update({ where: { id: trip.id }, data: { isPublic: true } });
  }

  return trip;
}

/** Mirrors BudgetService.recalculate so seeded trips match API-built ones. */
async function recalculateBudget(tripId: string) {
  const trip = await prisma.trip.findUniqueOrThrow({
    where: { id: tripId },
    select: {
      travelers: true,
      startDate: true,
      endDate: true,
      stops: {
        select: {
          arrivalDate: true,
          departureDate: true,
          accommodationCost: true,
          transportCost: true,
          mealsPerDayCost: true,
          activities: {
            select: { costOverride: true, activity: { select: { estimatedCost: true } } },
          },
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
// Community
// ---------------------------------------------------------------------------

const COMMUNITY_POSTS = [
  {
    title: 'The Golden Triangle in 7 days — what I would change',
    city: 'Agra',
    tags: ['rajasthan', 'heritage', 'firsttrip'],
    rating: 5,
    body: 'Delhi to Agra to Jaipur is the classic for a reason, but give Agra two nights, not one. We did the Taj at sunrise and Fatehpur Sikri the same day and it was too much. The Gatimaan Express from Hazrat Nizamuddin is 100 minutes and worth every rupee over the road.',
  },
  {
    title: 'Kerala backwaters: shikara over houseboat, honestly',
    city: 'Alleppey (Alappuzha)',
    tags: ['kerala', 'backwaters', 'budget'],
    rating: 4,
    body: 'The houseboat is lovely for one night and then you realise the big boats cannot enter the narrow canals where the actual village life is. Do one night on a kettuvallam, then a morning shikara through the small channels. Half the price, twice the experience.',
  },
  {
    title: 'Ladakh: do not skip the acclimatisation days',
    city: 'Leh',
    tags: ['ladakh', 'himalaya', 'roadtrip'],
    rating: 5,
    body: 'Two full days in Leh doing nothing before Khardung La. Our group ignored this and one person was on oxygen at Pangong. Drink far more water than feels reasonable, skip alcohol entirely for the first three days, and carry Diamox after talking to a doctor.',
  },
  {
    title: 'Varanasi at 5am is a different city',
    city: 'Varanasi',
    tags: ['spiritual', 'ganges', 'photography'],
    rating: 5,
    body: 'Take the boat at first light rather than the evening one. The aarti crowd in the evening is enormous; at dawn there is just steam off the river, wrestlers on the ghats and the odd sadhu. Book a boatman directly at Assi Ghat the night before.',
  },
  {
    title: 'Hampi deserves four days, not the usual two',
    city: 'Hampi',
    tags: ['karnataka', 'heritage', 'bouldering'],
    rating: 5,
    body: 'Everyone does Virupaksha and Vittala and leaves. Cross the river to Anegundi, climb Matanga at sunrise and Hemakuta at sunset, and hire a cycle for the southern group. If you climb at all, the granite here is world class.',
  },
  {
    title: 'Meghalaya root bridges — the double-decker is worth the 3,000 steps',
    city: 'Shillong',
    tags: ['northeast', 'trekking', 'monsoon'],
    rating: 5,
    body: 'It is 3,000 steps down to Nongriat and the same back up, and the up is brutal in humidity. Stay a night at the village guesthouse instead of doing it as a day trip. Rainbow Falls is another hour past the bridge and almost nobody goes.',
  },
  {
    title: 'Jaisalmer: sleep in the desert, not in the fort',
    city: 'Jaisalmer',
    tags: ['rajasthan', 'desert', 'tips'],
    rating: 4,
    body: 'The fort is a living fort and the drainage is genuinely damaging it — many conservationists ask visitors not to stay inside. Stay in a haveli below, and spend the night out at Sam on a camel safari instead. Go in December, not May.',
  },
  {
    title: 'Spiti in a shared taxi on a budget',
    city: 'Spiti Valley (Kaza)',
    tags: ['himalaya', 'budget', 'roadtrip'],
    rating: 4,
    body: 'You do not need a private car. HRTC buses and shared taxis run Manali to Kaza in season and cost a fraction. Key Monastery at first light with nobody else there was the highlight of the year. Carry cash — ATMs in Kaza are unreliable.',
  },
];

async function seedCommunity(
  users: Array<{ id: string; name: string }>,
  cityIdByName: Map<string, string>,
) {
  await prisma.communityPost.deleteMany({});

  for (const [i, post] of COMMUNITY_POSTS.entries()) {
    const author = users[i % users.length];
    const created = await prisma.communityPost.create({
      data: {
        authorId: author.id,
        cityId: cityIdByName.get(post.city) ?? null,
        title: post.title,
        body: post.body,
        tags: post.tags,
        rating: post.rating,
        imageUrl: img(`post-${post.title}`, 900, 560),
        createdAt: new Date(Date.now() - i * 17 * 36e5),
      },
    });

    const likers = users.filter((u) => u.id !== author.id).slice(0, (i % 3) + 1);
    for (const u of likers) {
      await prisma.communityLike.create({ data: { postId: created.id, userId: u.id } });
    }
    await prisma.communityPost.update({
      where: { id: created.id },
      data: { likeCount: likers.length },
    });

    if (i % 2 === 0 && likers[0]) {
      await prisma.communityComment.create({
        data: {
          postId: created.id,
          authorId: likers[0].id,
          body: 'Saving this — we are planning exactly this route next season. Thank you!',
        },
      });
      await prisma.communityPost.update({
        where: { id: created.id },
        data: { commentCount: 1 },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Removes leftovers from the earlier world-wide catalog.
 *
 * `stops.city_id` is ON DELETE RESTRICT precisely so reference data cannot
 * vanish out from under a live itinerary, so any trip still pointing at a
 * non-India city has to go first. Community posts reference cities with
 * SET NULL and need no special handling.
 */
async function purgeLegacyCatalog() {
  const legacyCities = await prisma.city.findMany({
    where: { country: { not: 'India' } },
    select: { id: true },
  });
  if (legacyCities.length === 0) return;

  const legacyIds = legacyCities.map((c) => c.id);

  const affectedTrips = await prisma.trip.findMany({
    where: { stops: { some: { cityId: { in: legacyIds } } } },
    select: { id: true, name: true },
  });

  if (affectedTrips.length > 0) {
    await prisma.trip.deleteMany({ where: { id: { in: affectedTrips.map((t) => t.id) } } });
    console.log(`  removed ${affectedTrips.length} trip(s) built on the old world catalog`);
  }

  const removed = await prisma.city.deleteMany({ where: { id: { in: legacyIds } } });
  console.log(`  removed ${removed.count} non-India cities from earlier seeds`);
}

async function main() {
  console.log('\nGlobeTrotter — India seed\n' + '='.repeat(44));

  await purgeLegacyCatalog();
  const cityIdByName = await seedCitiesAndActivities();
  const { demo, friend, third, admin } = await seedUsers();

  console.log('Building the Golden Triangle trip…');
  const golden = await buildTrip({
    ownerId: demo.id,
    name: 'Golden Triangle: Delhi, Agra & Jaipur',
    description:
      'The classic first trip through north India — Mughal Delhi, the Taj at sunrise, and the pink palaces of Jaipur. All of it by train and road, no flights.',
    startOffset: 40,
    endOffset: 47,
    travelers: 2,
    plannedTotal: 85000,
    dailyLimit: 12000,
    cityIdByName,
    collaboratorId: friend.id,
    share: true,
    stops: [
      {
        city: 'New Delhi',
        arrivalOffset: 0,
        departureOffset: 3,
        notes: 'Base near Connaught Place. Use the metro — Delhi traffic is not worth it.',
        accommodationCost: 12000,
        transportCost: 9000,
        mealsPerDayCost: 900,
        activities: [
          { name: 'Red Fort (Lal Qila)', dayOffset: 1, startTime: '09:30', endTime: '12:00' },
          { name: 'Chandni Chowk food walk', dayOffset: 1, startTime: '17:00', endTime: '20:00' },
          { name: "Humayun's Tomb", dayOffset: 2, startTime: '09:00', endTime: '11:00' },
          { name: 'Qutub Minar complex', dayOffset: 2, startTime: '15:00', endTime: '16:45' },
        ],
      },
      {
        city: 'Agra',
        arrivalOffset: 3,
        departureOffset: 5,
        notes: 'Gatimaan Express from Hazrat Nizamuddin, 100 minutes. Taj closed Fridays.',
        accommodationCost: 8000,
        transportCost: 3200,
        mealsPerDayCost: 700,
        activities: [
          { name: 'Taj Mahal at sunrise', dayOffset: 1, startTime: '06:00', endTime: '09:00' },
          { name: 'Agra Fort', dayOffset: 1, startTime: '11:00', endTime: '13:00' },
          { name: 'Mehtab Bagh at sunset', dayOffset: 1, startTime: '17:30', endTime: '19:00' },
          { name: 'Fatehpur Sikri day trip', dayOffset: 2, startTime: '09:00', endTime: '13:00' },
        ],
      },
      {
        city: 'Jaipur',
        arrivalOffset: 5,
        departureOffset: 7,
        notes: 'Road via Abhaneri stepwell if time allows. Amber Fort first thing.',
        accommodationCost: 9500,
        transportCost: 4500,
        mealsPerDayCost: 800,
        activities: [
          { name: 'Amber Fort and Sheesh Mahal', dayOffset: 1, startTime: '08:30', endTime: '11:30' },
          { name: 'City Palace and Jantar Mantar', dayOffset: 1, startTime: '13:00', endTime: '16:00' },
          { name: 'Nahargarh Fort at sunset', dayOffset: 1, startTime: '17:00', endTime: '19:00' },
          { name: 'Hawa Mahal and old city bazaars', dayOffset: 2, startTime: '10:00', endTime: '12:30' },
        ],
      },
    ],
    expenses: [
      { category: ExpenseCategory.TRANSPORT, title: 'Gatimaan Express tickets ×2', amount: 3100, dayOffset: 3 },
      { category: ExpenseCategory.SHOPPING, title: 'Blue pottery from Jaipur', amount: 2400, dayOffset: 6 },
      { category: ExpenseCategory.MEALS, title: 'Dinner at Peshawri', amount: 4800, dayOffset: 4 },
    ],
  });

  console.log('Building the Kerala trip…');
  const kerala = await buildTrip({
    ownerId: demo.id,
    name: 'Kerala: Backwaters, Tea & Coast',
    description:
      'Ten days from Kochi through the Western Ghats to the backwaters — spice hills, a night on a kettuvallam, and the cliffs at Varkala.',
    startOffset: 95,
    endOffset: 104,
    travelers: 2,
    plannedTotal: 110000,
    dailyLimit: 13000,
    cityIdByName,
    share: true,
    stops: [
      {
        city: 'Kochi',
        arrivalOffset: 0,
        departureOffset: 2,
        notes: 'Stay in Fort Kochi, walk everywhere. Kathakali make-up starts an hour before.',
        accommodationCost: 9000,
        transportCost: 11000,
        mealsPerDayCost: 800,
        activities: [
          { name: 'Chinese fishing nets at Fort Kochi', dayOffset: 0, startTime: '17:30', endTime: '19:00' },
          { name: 'Mattancherry Palace and Jew Town', dayOffset: 1, startTime: '10:00', endTime: '12:30' },
          { name: 'Kathakali performance', dayOffset: 1, startTime: '17:00', endTime: '19:30' },
        ],
      },
      {
        city: 'Munnar',
        arrivalOffset: 2,
        departureOffset: 5,
        notes: 'Four hours by road, hairpins the whole way. Cold at night — carry a layer.',
        accommodationCost: 11000,
        transportCost: 5500,
        mealsPerDayCost: 700,
        activities: [
          { name: 'Tea estate walk and museum', dayOffset: 1, startTime: '09:00', endTime: '12:00' },
          { name: 'Eravikulam National Park', dayOffset: 1, startTime: '14:00', endTime: '17:00' },
          { name: 'Top Station viewpoint', dayOffset: 2, startTime: '06:30', endTime: '10:00' },
        ],
      },
      {
        city: 'Thekkady (Periyar)',
        arrivalOffset: 5,
        departureOffset: 7,
        notes: 'Take the first boat of the day — animals come to the shore before the crowds.',
        accommodationCost: 7500,
        transportCost: 3000,
        mealsPerDayCost: 650,
        activities: [
          { name: 'Periyar Lake boat safari', dayOffset: 1, startTime: '07:00', endTime: '09:00' },
          { name: 'Spice plantation tour', dayOffset: 1, startTime: '11:00', endTime: '13:00' },
          { name: 'Kalaripayattu demonstration', dayOffset: 1, startTime: '18:00', endTime: '19:15' },
        ],
      },
      {
        city: 'Alleppey (Alappuzha)',
        arrivalOffset: 7,
        departureOffset: 9,
        notes: 'One night on the houseboat, then a shikara into the narrow canals.',
        accommodationCost: 14000,
        transportCost: 4000,
        mealsPerDayCost: 900,
        activities: [
          { name: 'Overnight houseboat on Vembanad', dayOffset: 0, startTime: '12:00' },
          { name: 'Shikara canal ride', dayOffset: 1, startTime: '07:00', endTime: '10:00' },
          { name: 'Marari beach day', dayOffset: 2, startTime: '11:00', endTime: '15:00' },
        ],
      },
    ],
    expenses: [
      { category: ExpenseCategory.TRANSPORT, title: 'Kochi airport transfer', amount: 1800, dayOffset: 0 },
      { category: ExpenseCategory.ACTIVITIES, title: 'Ayurvedic massage ×2', amount: 3000, dayOffset: 8 },
      { category: ExpenseCategory.OTHER, title: 'Travel insurance', amount: 2400, dayOffset: 0 },
    ],
  });

  console.log('Building the Ladakh trip…');
  const ladakh = await buildTrip({
    ownerId: friend.id,
    name: 'Ladakh Road Trip: Leh, Nubra & Pangong',
    description:
      'Nine days at altitude — two to acclimatise in Leh, then Khardung La into Nubra and the long drive out to Pangong Tso.',
    startOffset: 150,
    endOffset: 158,
    travelers: 4,
    plannedTotal: 240000,
    dailyLimit: 28000,
    cityIdByName,
    share: true,
    stops: [
      {
        city: 'Leh',
        arrivalOffset: 0,
        departureOffset: 8,
        notes: 'Two full rest days before any pass. Inner Line Permits from the DC office.',
        accommodationCost: 42000,
        transportCost: 68000,
        mealsPerDayCost: 900,
        activities: [
          { name: 'Leh Palace and old town', dayOffset: 2, startTime: '10:00', endTime: '12:00' },
          { name: 'Thiksey Monastery at dawn prayers', dayOffset: 3, startTime: '06:00', endTime: '08:30' },
          { name: 'Hemis Monastery', dayOffset: 3, startTime: '10:00', endTime: '13:30' },
          { name: 'Nubra Valley over Khardung La', dayOffset: 4, startTime: '06:00' },
          { name: 'Pangong Tso day trip', dayOffset: 6, startTime: '05:00' },
        ],
      },
    ],
    expenses: [
      { category: ExpenseCategory.TRANSPORT, title: 'Innova with driver, 8 days', amount: 64000, dayOffset: 0 },
      { category: ExpenseCategory.OTHER, title: 'Inner Line Permits ×4', amount: 2400, dayOffset: 1 },
    ],
  });

  console.log('Building a completed Rajasthan trip…');
  const rajasthan = await buildTrip({
    ownerId: demo.id,
    name: 'Rajasthan: Udaipur & Jodhpur',
    description: 'A long weekend of lakes and blue lanes, with a fort at each end.',
    startOffset: -70,
    endOffset: -64,
    travelers: 2,
    plannedTotal: 60000,
    dailyLimit: 10000,
    status: TripStatus.COMPLETED,
    cityIdByName,
    stops: [
      {
        city: 'Udaipur',
        arrivalOffset: 0,
        departureOffset: 3,
        notes: 'Lakeside haveli in the old city. The sunset boat is the thing to book.',
        accommodationCost: 11000,
        transportCost: 8000,
        mealsPerDayCost: 850,
        activities: [
          { name: 'City Palace complex', dayOffset: 1, startTime: '09:30', endTime: '12:30' },
          { name: 'Lake Pichola sunset boat ride', dayOffset: 1, startTime: '17:00', endTime: '18:00' },
          { name: 'Bagore-ki-Haveli folk dance', dayOffset: 1, startTime: '19:00', endTime: '20:30' },
        ],
      },
      {
        city: 'Jodhpur',
        arrivalOffset: 3,
        departureOffset: 6,
        notes: 'Five hours by road. Mehrangarh audio guide is genuinely excellent.',
        accommodationCost: 8500,
        transportCost: 4200,
        mealsPerDayCost: 750,
        activities: [
          { name: 'Mehrangarh Fort', dayOffset: 1, startTime: '09:00', endTime: '12:00' },
          { name: 'Jaswant Thada cenotaph', dayOffset: 1, startTime: '12:30', endTime: '13:30' },
          { name: 'Blue city walk in Navchokiya', dayOffset: 2, startTime: '16:00', endTime: '18:00' },
        ],
      },
    ],
    expenses: [
      { category: ExpenseCategory.SHOPPING, title: 'Bandhani dupattas', amount: 3200, dayOffset: 4 },
    ],
  });

  console.log('Building a Northeast trip…');
  const northeast = await buildTrip({
    ownerId: third.id,
    name: 'Meghalaya: Root Bridges & Living Villages',
    description: 'Six days of waterfalls, caves and the double-decker root bridge at Nongriat.',
    startOffset: 60,
    endOffset: 65,
    travelers: 2,
    plannedTotal: 55000,
    dailyLimit: 9000,
    cityIdByName,
    stops: [
      {
        city: 'Shillong',
        arrivalOffset: 0,
        departureOffset: 5,
        notes: 'Base in Shillong, but sleep one night at Nongriat rather than day-tripping it.',
        accommodationCost: 14000,
        transportCost: 16000,
        mealsPerDayCost: 700,
        activities: [
          { name: 'Elephant Falls and Shillong Peak', dayOffset: 1, startTime: '10:00', endTime: '13:00' },
          { name: 'Living root bridges, Nongriat', dayOffset: 2, startTime: '07:00' },
          { name: 'Mawlynnong, Asia\'s cleanest village', dayOffset: 4, startTime: '08:00', endTime: '14:00' },
          { name: 'Dawki river boating', dayOffset: 4, startTime: '14:30', endTime: '17:00' },
        ],
      },
    ],
  });

  for (const id of [golden.id, kerala.id, ladakh.id, rajasthan.id, northeast.id]) {
    await recalculateBudget(id);
  }

  console.log('Seeding community posts…');
  await seedCommunity([demo, friend, third, admin], cityIdByName);

  // Notifications and saved destinations for the demo account.
  await prisma.notification.deleteMany({ where: { userId: demo.id } });
  await prisma.notification.createMany({
    data: [
      {
        userId: demo.id,
        type: 'TRIP_SHARED',
        title: 'Golden Triangle is now shareable',
        body: 'Anyone with the link can view this itinerary.',
        data: { tripId: golden.id },
      },
      {
        userId: demo.id,
        type: 'MEMBER_ADDED',
        title: 'Rahul Menon joined Golden Triangle',
        body: 'They now have editor access to this trip.',
        data: { tripId: golden.id },
      },
    ],
  });

  const savedIds = ['Hampi', 'Spiti Valley (Kaza)', 'Havelock (Swaraj Dweep)']
    .map((name) => cityIdByName.get(name))
    .filter((id): id is string => Boolean(id));
  await prisma.profile.update({
    where: { userId: demo.id },
    data: { savedDestinations: savedIds },
  });

  const [cityCount, activityCount, tripCount, userCount, postCount] = await Promise.all([
    prisma.city.count(),
    prisma.activity.count(),
    prisma.trip.count(),
    prisma.user.count(),
    prisma.communityPost.count(),
  ]);

  console.log('\n' + '='.repeat(44));
  console.log('Seed complete — India catalog.\n');
  console.log(`  Cities          ${cityCount}`);
  console.log(`  Attractions     ${activityCount}`);
  console.log(`  Users           ${userCount}`);
  console.log(`  Trips           ${tripCount}`);
  console.log(`  Community posts ${postCount}`);
  console.log('\nSign in with:');
  console.log(`  ADMIN   ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  DEMO    ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  FRIEND  rahul@globetrotter.app / TravelBuddy123!`);

  const share = await prisma.sharedItinerary.findFirst({
    where: { tripId: golden.id },
    select: { slug: true },
  });
  if (share) console.log(`\nPublic itinerary: /public/${share.slug}`);
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
