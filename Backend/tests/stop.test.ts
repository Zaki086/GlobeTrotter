import {
  api,
  cleanDatabase,
  closeConnections,
  createTrip,
  createUser,
  dateIn,
  prisma,
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
  owner = await createUser({ name: 'Stop Owner' });
});

afterAll(async () => {
  await cleanDatabase();
  await closeConnections();
});

/** A trip with three sequential stops: A, B, A. */
async function tripWithStops() {
  const trip = await createTrip(owner, { startDate: dateIn(10), endDate: dateIn(25) });

  const mk = (cityId: string, from: number, to: number) =>
    api()
      .post(`/api/v1/trips/${trip.id}/stops`)
      .set(owner.auth)
      .send({
        cityId,
        arrivalDate: dateIn(from),
        departureDate: dateIn(to),
        accommodationCost: 300,
        transportCost: 100,
        mealsPerDayCost: 50,
      });

  const s1 = await mk(cityA.id, 10, 14);
  const s2 = await mk(cityB.id, 14, 19);
  const s3 = await mk(cityA.id, 19, 25);

  return { trip, stops: [s1.body.data, s2.body.data, s3.body.data] };
}

describe('POST /trips/:id/stops', () => {
  it('appends stops with a dense 0-based sequence', async () => {
    const { stops } = await tripWithStops();
    expect(stops.map((s) => s.sequence)).toEqual([0, 1, 2]);
  });

  it('computes days and nights', async () => {
    const trip = await createTrip(owner, { startDate: dateIn(10), endDate: dateIn(25) });
    const res = await api()
      .post(`/api/v1/trips/${trip.id}/stops`)
      .set(owner.auth)
      .send({ cityId: cityA.id, arrivalDate: dateIn(10), departureDate: dateIn(13) });

    expect(res.status).toBe(201);
    expect(res.body.data.days).toBe(4);
    expect(res.body.data.nights).toBe(3);
  });

  it('refuses stop dates outside the trip range', async () => {
    const trip = await createTrip(owner, { startDate: dateIn(10), endDate: dateIn(20) });
    const res = await api()
      .post(`/api/v1/trips/${trip.id}/stops`)
      .set(owner.auth)
      .send({ cityId: cityA.id, arrivalDate: dateIn(25), departureDate: dateIn(28) });

    expect(res.status).toBe(422);
    expect(res.body.errors[0].message).toMatch(/must fall between/i);
  });

  it('refuses a departure before the arrival', async () => {
    const trip = await createTrip(owner, { startDate: dateIn(10), endDate: dateIn(20) });
    const res = await api()
      .post(`/api/v1/trips/${trip.id}/stops`)
      .set(owner.auth)
      .send({ cityId: cityA.id, arrivalDate: dateIn(18), departureDate: dateIn(12) });

    expect(res.status).toBe(422);
  });

  it('refuses an unknown city', async () => {
    const trip = await createTrip(owner, { startDate: dateIn(10), endDate: dateIn(20) });
    const res = await api()
      .post(`/api/v1/trips/${trip.id}/stops`)
      .set(owner.auth)
      .send({
        cityId: '11111111-1111-4111-8111-111111111111',
        arrivalDate: dateIn(12),
        departureDate: dateIn(14),
      });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /stops/reorder', () => {
  it('applies a new order', async () => {
    const { trip, stops } = await tripWithStops();
    const reversed = [stops[2].id, stops[1].id, stops[0].id];

    const res = await api()
      .patch('/api/v1/stops/reorder')
      .set(owner.auth)
      .send({ tripId: trip.id, stopIds: reversed });

    expect(res.status).toBe(200);
    expect(res.body.data.map((s: { id: string }) => s.id)).toEqual(reversed);
    expect(res.body.data.map((s: { sequence: number }) => s.sequence)).toEqual([0, 1, 2]);
  });

  it('is idempotent — re-sending the same order changes nothing', async () => {
    const { trip, stops } = await tripWithStops();
    const order = stops.map((s) => s.id);

    await api().patch('/api/v1/stops/reorder').set(owner.auth).send({ tripId: trip.id, stopIds: order });
    const second = await api()
      .patch('/api/v1/stops/reorder')
      .set(owner.auth)
      .send({ tripId: trip.id, stopIds: order });

    expect(second.status).toBe(200);
    expect(second.body.data.map((s: { id: string }) => s.id)).toEqual(order);
  });

  it('rejects a partial list, so a stale drag cannot drop a stop', async () => {
    const { trip, stops } = await tripWithStops();
    const res = await api()
      .patch('/api/v1/stops/reorder')
      .set(owner.auth)
      .send({ tripId: trip.id, stopIds: [stops[0].id, stops[1].id] });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Expected all 3 stop ids/);
  });

  it('rejects duplicate ids', async () => {
    const { trip, stops } = await tripWithStops();
    const res = await api()
      .patch('/api/v1/stops/reorder')
      .set(owner.auth)
      .send({ tripId: trip.id, stopIds: [stops[0].id, stops[0].id, stops[1].id] });

    expect(res.status).toBe(422);
  });

  it('rejects a stop id from a different trip', async () => {
    const { trip, stops } = await tripWithStops();
    const other = await tripWithStops();

    const res = await api()
      .patch('/api/v1/stops/reorder')
      .set(owner.auth)
      .send({ tripId: trip.id, stopIds: [stops[0].id, stops[1].id, other.stops[0].id] });

    expect(res.status).toBe(400);
  });

  it('re-flows the dates when shiftDates is set', async () => {
    const { trip, stops } = await tripWithStops();
    const reversed = [stops[2].id, stops[1].id, stops[0].id];

    const res = await api()
      .patch('/api/v1/stops/reorder')
      .set(owner.auth)
      .send({ tripId: trip.id, stopIds: reversed, shiftDates: true });

    expect(res.status).toBe(200);
    const dates = res.body.data.map((s: { arrivalDate: string }) => s.arrivalDate);
    // Chronological after the re-flow.
    expect([...dates].sort()).toEqual(dates);
    // The first stop now starts on the trip start date.
    expect(dates[0]).toBe(dateIn(10));
  });
});

describe('DELETE /stops/:id', () => {
  it('removes the stop and closes the sequence gap', async () => {
    const { trip, stops } = await tripWithStops();

    const res = await api().delete(`/api/v1/stops/${stops[1].id}`).set(owner.auth);
    expect(res.status).toBe(200);

    const remaining = await prisma.stop.findMany({
      where: { tripId: trip.id },
      orderBy: { sequence: 'asc' },
    });
    expect(remaining).toHaveLength(2);
    // Dense, not [0, 2].
    expect(remaining.map((s) => s.sequence)).toEqual([0, 1]);
  });
});

describe('stop activities', () => {
  it('schedules an activity into a stop', async () => {
    const { stops } = await tripWithStops();
    const activity = await seedActivity(cityA.id, 'Museum Visit', 25, 90);

    const res = await api()
      .post(`/api/v1/stops/${stops[0].id}/activities`)
      .set(owner.auth)
      .send({ activityId: activity.id, scheduledDate: dateIn(11), startTime: '10:00' });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Museum Visit');
    expect(res.body.data.cost).toBe(25);
    expect(res.body.data.durationMinutes).toBe(90);
  });

  it('applies a cost override without touching the catalog', async () => {
    const { stops } = await tripWithStops();
    const activity = await seedActivity(cityA.id, 'Overridden Tour', 50);

    const res = await api()
      .post(`/api/v1/stops/${stops[0].id}/activities`)
      .set(owner.auth)
      .send({ activityId: activity.id, costOverride: 15 });

    expect(res.body.data.cost).toBe(15);
    expect(res.body.data.isCostOverridden).toBe(true);

    const catalog = await prisma.activity.findUniqueOrThrow({ where: { id: activity.id } });
    expect(Number(catalog.estimatedCost)).toBe(50);
  });

  it('refuses an activity that belongs to a different city', async () => {
    const { stops } = await tripWithStops();
    const wrongCity = await seedActivity(cityB.id, 'Betaburg Only', 10);

    // stops[0] is in city A.
    const res = await api()
      .post(`/api/v1/stops/${stops[0].id}/activities`)
      .set(owner.auth)
      .send({ activityId: wrongCity.id });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not available in/i);
  });

  it('refuses a scheduled date outside the stop', async () => {
    const { stops } = await tripWithStops();
    const activity = await seedActivity(cityA.id, 'Out Of Range', 10);

    const res = await api()
      .post(`/api/v1/stops/${stops[0].id}/activities`)
      .set(owner.auth)
      .send({ activityId: activity.id, scheduledDate: dateIn(24) });

    expect(res.status).toBe(422);
  });

  it('refuses the same activity twice in one stop', async () => {
    const { stops } = await tripWithStops();
    const activity = await seedActivity(cityA.id, 'Duplicate Me', 10);

    await api()
      .post(`/api/v1/stops/${stops[0].id}/activities`)
      .set(owner.auth)
      .send({ activityId: activity.id });

    const second = await api()
      .post(`/api/v1/stops/${stops[0].id}/activities`)
      .set(owner.auth)
      .send({ activityId: activity.id });

    expect(second.status).toBe(409);
  });

  it('removes a scheduled activity', async () => {
    const { stops } = await tripWithStops();
    const activity = await seedActivity(cityA.id, 'Removable', 10);

    await api()
      .post(`/api/v1/stops/${stops[0].id}/activities`)
      .set(owner.auth)
      .send({ activityId: activity.id });

    const res = await api()
      .delete(`/api/v1/stops/${stops[0].id}/activities/${activity.id}`)
      .set(owner.auth);
    expect(res.status).toBe(200);

    const list = await api().get(`/api/v1/stops/${stops[0].id}/activities`).set(owner.auth);
    expect(list.body.data).toHaveLength(0);
  });
});
