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

beforeAll(async () => {
  await cleanDatabase();
  const [a] = await seedCities();
  cityA = a;
  owner = await createUser({ name: 'Budget Owner' });
});

afterAll(async () => {
  await cleanDatabase();
  await closeConnections();
});

/**
 * A deterministic trip for arithmetic assertions:
 *   2 travelers, one 5-day stop (day 10 -> day 14 inclusive)
 *   stay 400, transport 200, meals 30/person/day
 */
async function costedTrip() {
  const trip = await createTrip(owner, {
    startDate: dateIn(10),
    endDate: dateIn(14),
    travelers: 2,
    currency: 'USD',
  });

  const stop = await api()
    .post(`/api/v1/trips/${trip.id}/stops`)
    .set(owner.auth)
    .send({
      cityId: cityA.id,
      arrivalDate: dateIn(10),
      departureDate: dateIn(14),
      accommodationCost: 400,
      transportCost: 200,
      mealsPerDayCost: 30,
    });

  return { trip, stop: stop.body.data };
}

describe('GET /trips/:id/budget', () => {
  it('derives totals from the itinerary', async () => {
    const { trip } = await costedTrip();
    const res = await api().get(`/api/v1/trips/${trip.id}/budget`).set(owner.auth);

    expect(res.status).toBe(200);
    const b = res.body.data;

    expect(b.breakdown.stay).toBe(400);
    expect(b.breakdown.transport).toBe(200);
    // meals = 30/person/day x 5 days x 2 travelers
    expect(b.breakdown.meals).toBe(300);
    expect(b.total).toBe(900);
    // 900 over 5 days
    expect(b.perDayAverage).toBe(180);
    expect(b.perPersonTotal).toBe(450);
    expect(b.totalDays).toBe(5);
  });

  it('multiplies activity costs by the traveler count', async () => {
    const { trip, stop } = await costedTrip();
    const activity = await seedActivity(cityA.id, 'Priced Tour', 45);

    await api()
      .post(`/api/v1/stops/${stop.id}/activities`)
      .set(owner.auth)
      .send({ activityId: activity.id, scheduledDate: dateIn(11) });

    const res = await api().get(`/api/v1/trips/${trip.id}/budget`).set(owner.auth);
    // 45 x 2 travelers
    expect(res.body.data.breakdown.activities).toBe(90);
    expect(res.body.data.total).toBe(990);
  });

  it('recalculates automatically after an itinerary change', async () => {
    const { trip, stop } = await costedTrip();

    const before = await api().get(`/api/v1/trips/${trip.id}/budget`).set(owner.auth);
    expect(before.body.data.total).toBe(900);

    await api()
      .patch(`/api/v1/stops/${stop.id}`)
      .set(owner.auth)
      .send({ accommodationCost: 900 });

    const after = await api().get(`/api/v1/trips/${trip.id}/budget`).set(owner.auth);
    expect(after.body.data.breakdown.stay).toBe(900);
    expect(after.body.data.total).toBe(1400);
  });

  it('drops the cost back when a stop is deleted', async () => {
    const { trip, stop } = await costedTrip();
    await api().delete(`/api/v1/stops/${stop.id}`).set(owner.auth);

    const res = await api().get(`/api/v1/trips/${trip.id}/budget`).set(owner.auth);
    expect(res.body.data.total).toBe(0);
  });

  it('reports percentages that sum to ~100', async () => {
    const { trip } = await costedTrip();
    const res = await api().get(`/api/v1/trips/${trip.id}/budget`).set(owner.auth);

    const pct = res.body.data.breakdownPercentage;
    const sum = pct.transport + pct.stay + pct.meals + pct.activities + pct.other;
    expect(sum).toBeGreaterThan(99);
    expect(sum).toBeLessThan(101);
  });

  it('breaks the cost down per stop', async () => {
    const { trip } = await costedTrip();
    const res = await api().get(`/api/v1/trips/${trip.id}/budget`).set(owner.auth);

    expect(res.body.data.byStop).toHaveLength(1);
    expect(res.body.data.byStop[0]).toMatchObject({
      days: 5,
      stay: 400,
      transport: 200,
      meals: 300,
      total: 900,
    });
  });

  it('gives a per-day breakdown covering every day of the trip', async () => {
    const { trip } = await costedTrip();
    const res = await api().get(`/api/v1/trips/${trip.id}/budget`).set(owner.auth);

    expect(res.body.data.daily).toHaveLength(5);
    expect(res.body.data.daily[0]).toMatchObject({ dayNumber: 1, date: dateIn(10) });
    const dailySum = res.body.data.daily.reduce((n: number, d: { total: number }) => n + d.total, 0);
    expect(Math.round(dailySum)).toBe(900);
  });

  it('blocks a stranger', async () => {
    const { trip } = await costedTrip();
    const stranger = await createUser();
    const res = await api().get(`/api/v1/trips/${trip.id}/budget`).set(stranger.auth);
    expect(res.status).toBe(404);
  });
});

describe('budget ceilings', () => {
  it('flags the trip as over budget against plannedTotal', async () => {
    const { trip } = await costedTrip();

    await api()
      .patch(`/api/v1/trips/${trip.id}/budget`)
      .set(owner.auth)
      .send({ plannedTotal: 500 });

    const res = await api().get(`/api/v1/trips/${trip.id}/budget`).set(owner.auth);
    expect(res.body.data.plannedTotal).toBe(500);
    expect(res.body.data.isOverBudget).toBe(true);
    expect(res.body.data.remaining).toBe(-400);
  });

  it('is not over budget when the ceiling is generous', async () => {
    const { trip } = await costedTrip();
    await api().patch(`/api/v1/trips/${trip.id}/budget`).set(owner.auth).send({ plannedTotal: 5000 });

    const res = await api().get(`/api/v1/trips/${trip.id}/budget`).set(owner.auth);
    expect(res.body.data.isOverBudget).toBe(false);
    expect(res.body.data.remaining).toBe(4100);
  });

  it('identifies overbudget days against dailyLimit', async () => {
    const { trip } = await costedTrip();
    // Each day costs 180 on average; a 100 limit puts every day over.
    await api().patch(`/api/v1/trips/${trip.id}/budget`).set(owner.auth).send({ dailyLimit: 100 });

    const res = await api().get(`/api/v1/trips/${trip.id}/budget`).set(owner.auth);
    expect(res.body.data.overBudgetDayCount).toBeGreaterThan(0);
    expect(res.body.data.overBudgetDays[0]).toHaveProperty('overBy');
  });

  it('reports no overbudget days when the limit is high', async () => {
    const { trip } = await costedTrip();
    await api().patch(`/api/v1/trips/${trip.id}/budget`).set(owner.auth).send({ dailyLimit: 10000 });

    const res = await api().get(`/api/v1/trips/${trip.id}/budget`).set(owner.auth);
    expect(res.body.data.overBudgetDayCount).toBe(0);
  });
});

describe('expenses', () => {
  it('folds a logged expense into its category', async () => {
    const { trip } = await costedTrip();

    const res = await api()
      .post(`/api/v1/trips/${trip.id}/expenses`)
      .set(owner.auth)
      .send({
        category: 'TRANSPORT',
        title: 'Airport transfer',
        amount: 60,
        incurredOn: dateIn(10),
      });
    expect(res.status).toBe(201);

    const budget = await api().get(`/api/v1/trips/${trip.id}/budget`).set(owner.auth);
    // 200 from the stop + 60 logged
    expect(budget.body.data.breakdown.transport).toBe(260);
    expect(budget.body.data.total).toBe(960);
  });

  it('maps SHOPPING to the "other" bucket', async () => {
    const { trip } = await costedTrip();
    await api()
      .post(`/api/v1/trips/${trip.id}/expenses`)
      .set(owner.auth)
      .send({ category: 'SHOPPING', title: 'Souvenirs', amount: 40, incurredOn: dateIn(11) });

    const budget = await api().get(`/api/v1/trips/${trip.id}/budget`).set(owner.auth);
    expect(budget.body.data.breakdown.other).toBe(40);
  });

  it('removes the amount again when the expense is deleted', async () => {
    const { trip } = await costedTrip();
    const created = await api()
      .post(`/api/v1/trips/${trip.id}/expenses`)
      .set(owner.auth)
      .send({ category: 'MEALS', title: 'Dinner', amount: 75, incurredOn: dateIn(12) });

    await api()
      .delete(`/api/v1/trips/${trip.id}/expenses/${created.body.data.id}`)
      .set(owner.auth);

    const budget = await api().get(`/api/v1/trips/${trip.id}/budget`).set(owner.auth);
    expect(budget.body.data.total).toBe(900);
  });

  it('rejects a negative amount', async () => {
    const { trip } = await costedTrip();
    const res = await api()
      .post(`/api/v1/trips/${trip.id}/expenses`)
      .set(owner.auth)
      .send({ category: 'MEALS', title: 'Refund', amount: -20, incurredOn: dateIn(11) });

    expect(res.status).toBe(422);
  });

  it('rejects an unknown category', async () => {
    const { trip } = await costedTrip();
    const res = await api()
      .post(`/api/v1/trips/${trip.id}/expenses`)
      .set(owner.auth)
      .send({ category: 'BRIBES', title: 'Nope', amount: 20, incurredOn: dateIn(11) });

    expect(res.status).toBe(422);
  });
});
