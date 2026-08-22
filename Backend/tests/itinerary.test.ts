import {
  api,
  cleanDatabase,
  closeConnections,
  createTrip,
  createUser,
  dateIn,
  seedActivity,
  seedCities,
  type TestUser,
} from './helpers';

let owner: TestUser;
let cityA: { id: string };
let cityB: { id: string };

beforeAll(async () => {
  await cleanDatabase();
  const [a, b] = await seedCities();
  cityA = a;
  cityB = b;
  owner = await createUser({ name: 'Itinerary Owner' });
});

afterAll(async () => {
  await cleanDatabase();
  await closeConnections();
});

/**
 * Two back-to-back stops that share a transfer day:
 *   stop 1: day 10 -> day 14   (city A)
 *   stop 2: day 14 -> day 18   (city B)   <- day 14 belongs to both
 * Each stop has one activity scheduled on its own arrival day.
 */
async function transferDayTrip() {
  const trip = await createTrip(owner, {
    startDate: dateIn(10),
    endDate: dateIn(18),
    travelers: 2,
  });

  const s1 = await api()
    .post(`/api/v1/trips/${trip.id}/stops`)
    .set(owner.auth)
    .send({ cityId: cityA.id, arrivalDate: dateIn(10), departureDate: dateIn(14) });

  const s2 = await api()
    .post(`/api/v1/trips/${trip.id}/stops`)
    .set(owner.auth)
    .send({ cityId: cityB.id, arrivalDate: dateIn(14), departureDate: dateIn(18) });

  const actA = await seedActivity(cityA.id, 'Alpha Departure Activity', 20);
  const actB = await seedActivity(cityB.id, 'Beta Arrival Activity', 35);

  // Both land on day 14 — the shared transfer day.
  await api()
    .post(`/api/v1/stops/${s1.body.data.id}/activities`)
    .set(owner.auth)
    .send({ activityId: actA.id, scheduledDate: dateIn(14), startTime: '09:00' });

  await api()
    .post(`/api/v1/stops/${s2.body.data.id}/activities`)
    .set(owner.auth)
    .send({ activityId: actB.id, scheduledDate: dateIn(14), startTime: '16:00' });

  return { trip, stops: [s1.body.data, s2.body.data] };
}

describe('GET /trips/:id/itinerary', () => {
  it('returns a day for every date of the trip', async () => {
    const { trip } = await transferDayTrip();
    const res = await api().get(`/api/v1/trips/${trip.id}/itinerary`).set(owner.auth);

    expect(res.status).toBe(200);
    expect(res.body.data.timeline).toHaveLength(9);
    expect(res.body.data.timeline[0].date).toBe(dateIn(10));
    expect(res.body.data.timeline[0].dayNumber).toBe(1);
  });

  it('returns both timeline and list shapes in one response', async () => {
    const { trip } = await transferDayTrip();
    const res = await api().get(`/api/v1/trips/${trip.id}/itinerary?view=list`).set(owner.auth);

    expect(res.body.data.view).toBe('list');
    expect(Array.isArray(res.body.data.timeline)).toBe(true);
    expect(Array.isArray(res.body.data.list)).toBe(true);
    expect(res.body.data.list).toHaveLength(2);
  });

  /**
   * Regression: on a transfer day two stops cover the same date. Selecting a
   * single covering stop dropped the arriving stop's activities from the
   * timeline, so the day costs silently disagreed with the budget.
   */
  it('shows activities from BOTH stops on a shared transfer day', async () => {
    const { trip } = await transferDayTrip();
    const res = await api().get(`/api/v1/trips/${trip.id}/itinerary`).set(owner.auth);

    const transferDay = res.body.data.timeline.find(
      (d: { date: string }) => d.date === dateIn(14),
    );

    expect(transferDay).toBeDefined();
    expect(transferDay.activities).toHaveLength(2);
    const names = transferDay.activities.map((a: { name: string }) => a.name);
    expect(names).toContain('Alpha Departure Activity');
    expect(names).toContain('Beta Arrival Activity');

    // A transfer day is both a departure and an arrival.
    expect(transferDay.isArrivalDay).toBe(true);
    expect(transferDay.isDepartureDay).toBe(true);
    // Labelled with the city you end the day in.
    expect(transferDay.city.name).toBe('Betaburg');
  });

  it('reconciles the timeline activity cost with the budget total', async () => {
    const { trip } = await transferDayTrip();

    const itinerary = await api().get(`/api/v1/trips/${trip.id}/itinerary`).set(owner.auth);
    const budget = await api().get(`/api/v1/trips/${trip.id}/budget`).set(owner.auth);

    // (20 + 35) x 2 travelers = 110
    expect(itinerary.body.data.summary.activitiesCost).toBe(110);
    expect(budget.body.data.breakdown.activities).toBe(110);
    expect(itinerary.body.data.summary.activitiesCost).toBe(
      budget.body.data.breakdown.activities,
    );
  });

  it('surfaces every scheduled activity somewhere in the timeline', async () => {
    const { trip } = await transferDayTrip();
    const res = await api().get(`/api/v1/trips/${trip.id}/itinerary`).set(owner.auth);

    const shown = res.body.data.timeline.reduce(
      (n: number, d: { activities: unknown[] }) => n + d.activities.length,
      0,
    );
    expect(shown).toBe(res.body.data.summary.totalActivities);
  });

  it('orders activities within a day by start time', async () => {
    const { trip } = await transferDayTrip();
    const res = await api().get(`/api/v1/trips/${trip.id}/itinerary`).set(owner.auth);

    const day = res.body.data.timeline.find((d: { date: string }) => d.date === dateIn(14));
    expect(day.activities[0].startTime).toBe('09:00');
    expect(day.activities[1].startTime).toBe('16:00');
  });

  it('blocks a stranger', async () => {
    const { trip } = await transferDayTrip();
    const stranger = await createUser();
    const res = await api().get(`/api/v1/trips/${trip.id}/itinerary`).set(stranger.auth);
    expect(res.status).toBe(404);
  });
});

describe('GET /trips/:id/calendar', () => {
  it('groups events by date', async () => {
    const { trip } = await transferDayTrip();
    const res = await api().get(`/api/v1/trips/${trip.id}/calendar`).set(owner.auth);

    expect(res.status).toBe(200);
    expect(res.body.data.days).toHaveLength(9);
    expect(res.body.data.totalEvents).toBeGreaterThan(0);
  });

  it('emits travel, stay and activity event kinds', async () => {
    const { trip } = await transferDayTrip();
    const res = await api().get(`/api/v1/trips/${trip.id}/calendar`).set(owner.auth);

    const kinds = new Set(
      res.body.data.days.flatMap((d: { events: Array<{ kind: string }> }) =>
        d.events.map((e) => e.kind),
      ),
    );
    expect(kinds.has('travel')).toBe(true);
    expect(kinds.has('stay')).toBe(true);
    expect(kinds.has('activity')).toBe(true);
  });

  it('honours a from/to window', async () => {
    const { trip } = await transferDayTrip();
    const res = await api()
      .get(`/api/v1/trips/${trip.id}/calendar?from=${dateIn(12)}&to=${dateIn(14)}`)
      .set(owner.auth);

    expect(res.body.data.days).toHaveLength(3);
    expect(res.body.data.from).toBe(dateIn(12));
    expect(res.body.data.to).toBe(dateIn(14));
  });

  it('derives an end time from the duration when none was given', async () => {
    const trip = await createTrip(owner, { startDate: dateIn(10), endDate: dateIn(14) });
    const stop = await api()
      .post(`/api/v1/trips/${trip.id}/stops`)
      .set(owner.auth)
      .send({ cityId: cityA.id, arrivalDate: dateIn(10), departureDate: dateIn(14) });

    const activity = await seedActivity(cityA.id, 'Ninety Minute Tour', 10, 90);
    await api()
      .post(`/api/v1/stops/${stop.body.data.id}/activities`)
      .set(owner.auth)
      .send({ activityId: activity.id, scheduledDate: dateIn(11), startTime: '10:00' });

    const res = await api().get(`/api/v1/trips/${trip.id}/calendar`).set(owner.auth);
    const day = res.body.data.days.find((d: { date: string }) => d.date === dateIn(11));
    const event = day.events.find((e: { kind: string }) => e.kind === 'activity');

    expect(event.startTime).toBe('10:00');
    expect(event.endTime).toBe('11:30');
  });
});
