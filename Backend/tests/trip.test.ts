import {
  api,
  cleanDatabase,
  closeConnections,
  createTrip,
  createUser,
  dateIn,
  seedCities,
  type TestUser,
} from './helpers';

let owner: TestUser;
let stranger: TestUser;

beforeAll(async () => {
  await cleanDatabase();
  await seedCities();
  owner = await createUser({ name: 'Trip Owner' });
  stranger = await createUser({ name: 'Nosy Stranger' });
});

afterAll(async () => {
  await cleanDatabase();
  await closeConnections();
});

describe('POST /trips', () => {
  it('creates a trip with the standard envelope', async () => {
    const res = await api()
      .post('/api/v1/trips')
      .set(owner.auth)
      .send({
        name: 'Kyoto in Spring',
        description: 'Cherry blossom season',
        startDate: dateIn(60),
        endDate: dateIn(70),
        travelers: 2,
        currency: 'jpy',
        plannedTotal: 5000,
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, message: expect.any(String) });
    expect(res.body.data.name).toBe('Kyoto in Spring');
    // Currency is normalized to uppercase by the validator.
    expect(res.body.data.currency).toBe('JPY');
    expect(res.body.data.durationDays).toBe(11);
    expect(res.body.data.role).toBe('OWNER');
  });

  it('rejects an end date before the start date', async () => {
    const res = await api()
      .post('/api/v1/trips')
      .set(owner.auth)
      .send({ name: 'Backwards', startDate: dateIn(30), endDate: dateIn(20) });

    expect(res.status).toBe(422);
    expect(res.body.errors.some((e: { field: string }) => e.field === 'endDate')).toBe(true);
  });

  it('rejects a missing name', async () => {
    const res = await api()
      .post('/api/v1/trips')
      .set(owner.auth)
      .send({ startDate: dateIn(30), endDate: dateIn(40) });

    expect(res.status).toBe(422);
  });

  it('requires authentication', async () => {
    const res = await api()
      .post('/api/v1/trips')
      .send({ name: 'Anon', startDate: dateIn(30), endDate: dateIn(40) });

    expect(res.status).toBe(401);
  });
});

describe('GET /trips', () => {
  it('lists only the caller trips, with pagination meta', async () => {
    await createTrip(owner, { name: 'Listed Trip' });

    const mine = await api().get('/api/v1/trips').set(owner.auth);
    expect(mine.status).toBe(200);
    expect(mine.body.meta).toMatchObject({
      page: 1,
      limit: expect.any(Number),
      total: expect.any(Number),
    });
    expect(mine.body.data.length).toBeGreaterThan(0);

    const theirs = await api().get('/api/v1/trips').set(stranger.auth);
    expect(theirs.body.data).toHaveLength(0);
  });

  it('filters by upcoming and past', async () => {
    await createTrip(owner, { name: 'Long Past', startDate: dateIn(-40), endDate: dateIn(-30) });

    const upcoming = await api().get('/api/v1/trips?filter=upcoming').set(owner.auth);
    const past = await api().get('/api/v1/trips?filter=past').set(owner.auth);

    expect(upcoming.body.data.every((t: { startDate: string }) => t.startDate > dateIn(0))).toBe(true);
    expect(past.body.data.some((t: { name: string }) => t.name === 'Long Past')).toBe(true);
  });

  it('searches by name', async () => {
    await createTrip(owner, { name: 'Patagonia Trek' });
    const res = await api().get('/api/v1/trips?search=patagonia').set(owner.auth);

    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].name).toContain('Patagonia');
  });
});

describe('GET /trips/:id', () => {
  it('returns the full trip for its owner', async () => {
    const trip = await createTrip(owner, { name: 'Detailed' });
    const res = await api().get(`/api/v1/trips/${trip.id}`).set(owner.auth);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(trip.id);
    expect(res.body.data.stops).toEqual([]);
    expect(res.body.data.canEdit).toBe(true);
  });

  it('hides a trip from a stranger behind 404, not 403', async () => {
    const trip = await createTrip(owner, { name: 'Private' });
    const res = await api().get(`/api/v1/trips/${trip.id}`).set(stranger.auth);

    // 404 rather than 403 — existence itself should not leak.
    expect(res.status).toBe(404);
  });

  it('rejects a malformed uuid', async () => {
    const res = await api().get('/api/v1/trips/not-a-uuid').set(owner.auth);
    expect(res.status).toBe(422);
  });

  it('404s a well-formed but unknown uuid', async () => {
    const res = await api()
      .get('/api/v1/trips/11111111-1111-4111-8111-111111111111')
      .set(owner.auth);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /trips/:id', () => {
  it('updates fields', async () => {
    const trip = await createTrip(owner, { name: 'Before' });
    const res = await api()
      .patch(`/api/v1/trips/${trip.id}`)
      .set(owner.auth)
      .send({ name: 'After', travelers: 4 });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('After');
    expect(res.body.data.travelers).toBe(4);
  });

  it('rejects an empty body', async () => {
    const trip = await createTrip(owner);
    const res = await api().patch(`/api/v1/trips/${trip.id}`).set(owner.auth).send({});
    expect(res.status).toBe(422);
  });

  it('refuses to shrink the range so that stops fall outside it', async () => {
    const [city] = await seedCities();
    const trip = await createTrip(owner, { startDate: dateIn(30), endDate: dateIn(40) });

    await api()
      .post(`/api/v1/trips/${trip.id}/stops`)
      .set(owner.auth)
      .send({ cityId: city.id, arrivalDate: dateIn(35), departureDate: dateIn(38) });

    const res = await api()
      .patch(`/api/v1/trips/${trip.id}`)
      .set(owner.auth)
      .send({ endDate: dateIn(32) });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/outside the new date range/i);
  });

  it('blocks a stranger', async () => {
    const trip = await createTrip(owner);
    const res = await api()
      .patch(`/api/v1/trips/${trip.id}`)
      .set(stranger.auth)
      .send({ name: 'Hijacked' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /trips/:id', () => {
  it('deletes the caller own trip', async () => {
    const trip = await createTrip(owner, { name: 'Doomed' });
    const res = await api().delete(`/api/v1/trips/${trip.id}`).set(owner.auth);

    expect(res.status).toBe(200);
    expect((await api().get(`/api/v1/trips/${trip.id}`).set(owner.auth)).status).toBe(404);
  });

  it('blocks a stranger', async () => {
    const trip = await createTrip(owner, { name: 'Safe' });
    expect((await api().delete(`/api/v1/trips/${trip.id}`).set(stranger.auth)).status).toBe(404);
    expect((await api().get(`/api/v1/trips/${trip.id}`).set(owner.auth)).status).toBe(200);
  });
});

describe('trip members', () => {
  it('lets the owner add an editor who can then see and edit the trip', async () => {
    const trip = await createTrip(owner, { name: 'Shared Planning' });

    const add = await api()
      .post(`/api/v1/trips/${trip.id}/members`)
      .set(owner.auth)
      .send({ email: stranger.email, role: 'EDITOR' });
    expect(add.status).toBe(201);

    const view = await api().get(`/api/v1/trips/${trip.id}`).set(stranger.auth);
    expect(view.status).toBe(200);
    expect(view.body.data.canEdit).toBe(true);

    const edit = await api()
      .patch(`/api/v1/trips/${trip.id}`)
      .set(stranger.auth)
      .send({ description: 'Edited by collaborator' });
    expect(edit.status).toBe(200);
  });

  it('gives a VIEWER read access but not write', async () => {
    const viewer = await createUser({ name: 'Read Only' });
    const trip = await createTrip(owner, { name: 'Viewer Trip' });

    await api()
      .post(`/api/v1/trips/${trip.id}/members`)
      .set(owner.auth)
      .send({ email: viewer.email, role: 'VIEWER' });

    expect((await api().get(`/api/v1/trips/${trip.id}`).set(viewer.auth)).status).toBe(200);

    const edit = await api()
      .patch(`/api/v1/trips/${trip.id}`)
      .set(viewer.auth)
      .send({ name: 'Nope' });
    expect(edit.status).toBe(403);
  });

  it('only the owner may delete, not an editor', async () => {
    const editor = await createUser({ name: 'Editor' });
    const trip = await createTrip(owner, { name: 'Owner Only Delete' });

    await api()
      .post(`/api/v1/trips/${trip.id}/members`)
      .set(owner.auth)
      .send({ email: editor.email, role: 'EDITOR' });

    const res = await api().delete(`/api/v1/trips/${trip.id}`).set(editor.auth);
    expect(res.status).toBe(403);
  });
});
