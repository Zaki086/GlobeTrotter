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
let visitor: TestUser;
let cityA: { id: string };

beforeAll(async () => {
  await cleanDatabase();
  const [a] = await seedCities();
  cityA = a;
  owner = await createUser({ name: 'Share Owner' });
  visitor = await createUser({ name: 'Curious Visitor' });
});

afterAll(async () => {
  await cleanDatabase();
  await closeConnections();
});

/** A trip with one stop and one scheduled activity, ready to publish. */
async function shareableTrip(name = 'Shareable Trip') {
  const trip = await createTrip(owner, {
    name,
    startDate: dateIn(20),
    endDate: dateIn(26),
    travelers: 2,
  });

  const stop = await api()
    .post(`/api/v1/trips/${trip.id}/stops`)
    .set(owner.auth)
    .send({
      cityId: cityA.id,
      arrivalDate: dateIn(20),
      departureDate: dateIn(26),
      accommodationCost: 500,
      transportCost: 150,
      mealsPerDayCost: 40,
    });

  const activity = await seedActivity(cityA.id, `Tour for ${name}`, 30);
  await api()
    .post(`/api/v1/stops/${stop.body.data.id}/activities`)
    .set(owner.auth)
    .send({ activityId: activity.id, scheduledDate: dateIn(21), startTime: '09:00' });

  return { trip, stop: stop.body.data };
}

async function share(tripId: string, body: Record<string, unknown> = {}) {
  const res = await api()
    .post(`/api/v1/trips/${tripId}/share`)
    .set(owner.auth)
    .send({ allowCopy: true, ...body });
  return res;
}

describe('POST /trips/:id/share', () => {
  it('creates a link with a slug and url', async () => {
    const { trip } = await shareableTrip();
    const res = await share(trip.id);

    expect(res.status).toBe(201);
    expect(res.body.data.slug).toEqual(expect.any(String));
    expect(res.body.data.slug.length).toBeGreaterThan(11);
    expect(res.body.data.url).toContain(res.body.data.slug);
    expect(res.body.data.isActive).toBe(true);
  });

  it('generates a slug with real entropy, not a guessable id', async () => {
    const a = await shareableTrip('Trip A');
    const b = await shareableTrip('Trip B');

    const slugA = (await share(a.trip.id)).body.data.slug;
    const slugB = (await share(b.trip.id)).body.data.slug;

    expect(slugA).not.toBe(slugB);
    // The random suffix must not contain the trip's uuid.
    expect(slugA).not.toContain(a.trip.id);
  });

  it('marks the trip public', async () => {
    const { trip } = await shareableTrip();
    await share(trip.id);

    const res = await api().get(`/api/v1/trips/${trip.id}`).set(owner.auth);
    expect(res.body.data.isPublic).toBe(true);
  });

  it('lets only the owner publish', async () => {
    const { trip } = await shareableTrip();
    const res = await api()
      .post(`/api/v1/trips/${trip.id}/share`)
      .set(visitor.auth)
      .send({ allowCopy: true });

    expect(res.status).toBe(404);
  });
});

describe('GET /public/:slug', () => {
  it('is readable with no authentication at all', async () => {
    const { trip } = await shareableTrip();
    const slug = (await share(trip.id)).body.data.slug;

    const res = await api().get(`/api/v1/public/${slug}`);

    expect(res.status).toBe(200);
    expect(res.body.data.readOnly).toBe(true);
    expect(res.body.data.trip.name).toBe(trip.name);
    expect(res.body.data.timeline.length).toBeGreaterThan(0);
  });

  it('does not leak members, expenses or the owner email', async () => {
    const { trip } = await shareableTrip();
    await api()
      .post(`/api/v1/trips/${trip.id}/expenses`)
      .set(owner.auth)
      .send({ category: 'MEALS', title: 'Private dinner', amount: 90, incurredOn: dateIn(21) });

    const slug = (await share(trip.id)).body.data.slug;
    const res = await api().get(`/api/v1/public/${slug}`);

    const body = JSON.stringify(res.body);
    expect(body).not.toContain(owner.email);
    expect(body).not.toContain('Private dinner');
    expect(res.body.data.members).toBeUndefined();
    expect(res.body.data.expenses).toBeUndefined();
  });

  it('exposes budget totals but not the itemised log', async () => {
    const { trip } = await shareableTrip();
    const slug = (await share(trip.id)).body.data.slug;

    const res = await api().get(`/api/v1/public/${slug}`);
    expect(res.body.data.budget.total).toEqual(expect.any(Number));
    expect(res.body.data.budget.breakdown).toHaveProperty('stay');
  });

  it('counts views', async () => {
    const { trip } = await shareableTrip();
    const slug = (await share(trip.id)).body.data.slug;

    await api().get(`/api/v1/public/${slug}`);
    await api().get(`/api/v1/public/${slug}`);

    // The counter is incremented fire-and-forget, so allow it to settle.
    await new Promise((r) => setTimeout(r, 300));
    const record = await prisma.sharedItinerary.findUniqueOrThrow({ where: { slug } });
    expect(record.viewCount).toBeGreaterThanOrEqual(2);
  });

  it('404s an unknown slug', async () => {
    const res = await api().get('/api/v1/public/does-not-exist-abcdefgh');
    expect(res.status).toBe(404);
  });

  it('404s a revoked link', async () => {
    const { trip } = await shareableTrip();
    const created = (await share(trip.id)).body.data;

    await api().delete(`/api/v1/trips/${trip.id}/share/${created.id}`).set(owner.auth);

    const res = await api().get(`/api/v1/public/${created.slug}`);
    expect(res.status).toBe(404);
  });

  it('404s an expired link', async () => {
    const { trip } = await shareableTrip();
    const created = (await share(trip.id, { expiresInDays: 1 })).body.data;

    await prisma.sharedItinerary.update({
      where: { id: created.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await api().get(`/api/v1/public/${created.slug}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /public/:slug/copy', () => {
  it('copies the itinerary into the visitor account', async () => {
    const { trip } = await shareableTrip('Original Plan');
    const slug = (await share(trip.id)).body.data.slug;

    const res = await api()
      .post(`/api/v1/public/${slug}/copy`)
      .set(visitor.auth)
      .send({ name: 'My Copy' });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('My Copy');
    expect(res.body.data.stopCount).toBe(1);
    // A copy always lands as a private draft.
    expect(res.body.data.status).toBe('DRAFT');

    const copyId = res.body.data.id;
    const detail = await api().get(`/api/v1/trips/${copyId}`).set(visitor.auth);
    expect(detail.body.data.isPublic).toBe(false);
    expect(detail.body.data.stops[0].activities).toHaveLength(1);
  });

  it('produces an independent trip — editing the copy leaves the original alone', async () => {
    const { trip } = await shareableTrip('Independent Source');
    const slug = (await share(trip.id)).body.data.slug;

    const copy = await api().post(`/api/v1/public/${slug}/copy`).set(visitor.auth).send({});
    await api()
      .patch(`/api/v1/trips/${copy.body.data.id}`)
      .set(visitor.auth)
      .send({ name: 'Mutated Copy' });

    const original = await api().get(`/api/v1/trips/${trip.id}`).set(owner.auth);
    expect(original.body.data.name).toBe('Independent Source');
  });

  it('shifts every date by a constant offset when startDate is given', async () => {
    const { trip } = await shareableTrip('Shift Me');
    const slug = (await share(trip.id)).body.data.slug;

    const res = await api()
      .post(`/api/v1/public/${slug}/copy`)
      .set(visitor.auth)
      .send({ startDate: dateIn(100) });

    expect(res.status).toBe(201);
    expect(res.body.data.startDate).toBe(dateIn(100));
    // Original ran day 20 -> 26, so the copy must keep the 6-day span.
    expect(res.body.data.endDate).toBe(dateIn(106));
    expect(res.body.data.shiftedByDays).toBe(80);
  });

  it('requires authentication', async () => {
    const { trip } = await shareableTrip();
    const slug = (await share(trip.id)).body.data.slug;

    const res = await api().post(`/api/v1/public/${slug}/copy`).send({});
    expect(res.status).toBe(401);
  });

  it('refuses when the owner disabled copying', async () => {
    const { trip } = await shareableTrip();
    const slug = (await share(trip.id, { allowCopy: false })).body.data.slug;

    const res = await api().post(`/api/v1/public/${slug}/copy`).set(visitor.auth).send({});
    expect(res.status).toBe(403);
  });

  it('refuses to let the owner copy their own trip', async () => {
    const { trip } = await shareableTrip();
    const slug = (await share(trip.id)).body.data.slug;

    const res = await api().post(`/api/v1/public/${slug}/copy`).set(owner.auth).send({});
    expect(res.status).toBe(400);
  });

  it('increments the copy counter', async () => {
    const { trip } = await shareableTrip();
    const slug = (await share(trip.id)).body.data.slug;

    await api().post(`/api/v1/public/${slug}/copy`).set(visitor.auth).send({});

    const record = await prisma.sharedItinerary.findUniqueOrThrow({ where: { slug } });
    expect(record.copyCount).toBe(1);
  });
});

describe('DELETE /trips/:id/share/:shareId', () => {
  it('makes the trip private again once the last link is revoked', async () => {
    const { trip } = await shareableTrip();
    const created = (await share(trip.id)).body.data;

    await api().delete(`/api/v1/trips/${trip.id}/share/${created.id}`).set(owner.auth);

    const res = await api().get(`/api/v1/trips/${trip.id}`).set(owner.auth);
    expect(res.body.data.isPublic).toBe(false);
  });

  it('blocks a non-owner from revoking', async () => {
    const { trip } = await shareableTrip();
    const created = (await share(trip.id)).body.data;

    const res = await api()
      .delete(`/api/v1/trips/${trip.id}/share/${created.id}`)
      .set(visitor.auth);
    expect(res.status).toBe(404);
  });
});
