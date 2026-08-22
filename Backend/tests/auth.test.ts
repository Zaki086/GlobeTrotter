import {
  api,
  cleanDatabase,
  closeConnections,
  createUser,
  prisma,
  uniqueEmail,
  VALID_PASSWORD,
} from './helpers';

beforeAll(cleanDatabase);
afterAll(async () => {
  await cleanDatabase();
  await closeConnections();
});

describe('POST /auth/signup', () => {
  it('creates an account and returns a token pair', async () => {
    const email = uniqueEmail('signup');
    const res = await api()
      .post('/api/v1/auth/signup')
      .send({ name: 'Ada Lovelace', email, password: VALID_PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.user.role).toBe('USER');
    expect(res.body.data.tokens.accessToken).toEqual(expect.any(String));
    expect(res.body.data.tokens.refreshToken).toEqual(expect.any(String));
    expect(res.body.data.tokens.tokenType).toBe('Bearer');
  });

  it('never returns the password hash', async () => {
    const res = await api()
      .post('/api/v1/auth/signup')
      .send({ name: 'No Leak', email: uniqueEmail('leak'), password: VALID_PASSWORD });

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain(VALID_PASSWORD);
    expect(serialized).not.toContain('$argon2');
  });

  it('stores the password as an argon2id hash, not plaintext', async () => {
    const email = uniqueEmail('hash');
    await api().post('/api/v1/auth/signup').send({ name: 'Hash Me', email, password: VALID_PASSWORD });

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toContain(VALID_PASSWORD);
  });

  it('normalizes the email so casing cannot create a duplicate account', async () => {
    const email = uniqueEmail('normalize');
    await api().post('/api/v1/auth/signup').send({ name: 'First', email, password: VALID_PASSWORD });

    const res = await api()
      .post('/api/v1/auth/signup')
      .send({ name: 'Second', email: `  ${email.toUpperCase()}  `, password: VALID_PASSWORD });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('rejects a weak password with field-level errors', async () => {
    const res = await api()
      .post('/api/v1/auth/signup')
      .send({ name: 'Weak', email: uniqueEmail('weak'), password: 'abc' });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ success: false, message: 'Validation failed' });
    expect(res.body.errors.length).toBeGreaterThan(0);
    expect(res.body.errors.every((e: { field: string }) => e.field === 'password')).toBe(true);
  });

  it('rejects a malformed email', async () => {
    const res = await api()
      .post('/api/v1/auth/signup')
      .send({ name: 'Bad Email', email: 'not-an-email', password: VALID_PASSWORD });

    expect(res.status).toBe(422);
    expect(res.body.errors.some((e: { field: string }) => e.field === 'email')).toBe(true);
  });

  it('creates a profile row alongside the user', async () => {
    const user = await createUser();
    const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
    expect(profile).not.toBeNull();
    expect(profile?.language).toBe('en');
  });
});

describe('POST /auth/login', () => {
  it('signs in with correct credentials', async () => {
    const user = await createUser();
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: VALID_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);
    expect(res.body.data.tokens.accessToken).toEqual(expect.any(String));
  });

  it('rejects a wrong password', async () => {
    const user = await createUser();
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'Wr0ng!Password' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('gives the same message for an unknown email, so accounts cannot be enumerated', async () => {
    const user = await createUser();

    const unknown = await api()
      .post('/api/v1/auth/login')
      .send({ email: uniqueEmail('ghost'), password: VALID_PASSWORD });
    const wrongPassword = await api()
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'Wr0ng!Password' });

    expect(unknown.status).toBe(wrongPassword.status);
    expect(unknown.body.message).toBe(wrongPassword.body.message);
  });

  it('refuses a deactivated account', async () => {
    const user = await createUser();
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: VALID_PASSWORD });

    expect(res.status).toBe(403);
  });

  it('records a session for the device', async () => {
    const user = await createUser();
    const sessions = await prisma.session.count({ where: { userId: user.id, revokedAt: null } });
    expect(sessions).toBeGreaterThanOrEqual(1);
  });
});

describe('GET /auth/me', () => {
  it('returns the current user', async () => {
    const user = await createUser();
    const res = await api().get('/api/v1/auth/me').set(user.auth);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(user.id);
    expect(res.body.data.stats).toBeDefined();
  });

  it('rejects a missing token', async () => {
    const res = await api().get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects a garbage token', async () => {
    const res = await api().get('/api/v1/auth/me').set({ Authorization: 'Bearer not.a.jwt' });
    expect(res.status).toBe(401);
  });

  it('rejects a well-formed token signed with the wrong secret', async () => {
    const jwt = require('jsonwebtoken');
    const forged = jwt.sign(
      { email: 'x@example.com', role: 'ADMIN', sessionId: 'x', type: 'access' },
      'an-attacker-chosen-secret-that-is-long-enough',
      { subject: 'someone', issuer: process.env.JWT_ISSUER, audience: process.env.JWT_AUDIENCE },
    );
    const res = await api().get('/api/v1/auth/me').set({ Authorization: `Bearer ${forged}` });
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/refresh', () => {
  it('rotates the refresh token', async () => {
    const user = await createUser();
    const res = await api().post('/api/v1/auth/refresh').send({ refreshToken: user.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.tokens.refreshToken).not.toBe(user.refreshToken);
  });

  it('detects reuse of an already-rotated token and kills the session', async () => {
    const user = await createUser();

    const first = await api().post('/api/v1/auth/refresh').send({ refreshToken: user.refreshToken });
    const rotated = first.body.data.tokens.refreshToken;

    // Replaying the consumed token is the signal that it leaked.
    const replay = await api().post('/api/v1/auth/refresh').send({ refreshToken: user.refreshToken });
    expect(replay.status).toBe(401);

    // ...and the successor must die with it, not keep working.
    const after = await api().post('/api/v1/auth/refresh').send({ refreshToken: rotated });
    expect(after.status).toBe(401);
  });

  it('stores refresh tokens only as digests', async () => {
    const user = await createUser();
    const stored = await prisma.refreshToken.findMany({ where: { userId: user.id } });

    expect(stored.length).toBeGreaterThan(0);
    for (const row of stored) {
      expect(row.tokenHash).toHaveLength(64);
      expect(row.tokenHash).not.toBe(user.refreshToken);
    }
  });

  it('requires a token', async () => {
    const res = await api().post('/api/v1/auth/refresh').send({});
    expect(res.status).toBe(401);
  });
});

describe('logout', () => {
  it('invalidates the access token for that session', async () => {
    const user = await createUser();

    const before = await api().get('/api/v1/auth/me').set(user.auth);
    expect(before.status).toBe(200);

    await api().post('/api/v1/auth/logout').set(user.auth).send({});

    const after = await api().get('/api/v1/auth/me').set(user.auth);
    expect(after.status).toBe(401);
  });

  it('logout-all revokes every session', async () => {
    const user = await createUser();
    // A second device.
    await api().post('/api/v1/auth/login').send({ email: user.email, password: VALID_PASSWORD });

    const res = await api().post('/api/v1/auth/logout-all').set(user.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.revokedSessions).toBeGreaterThanOrEqual(2);

    const active = await prisma.session.count({ where: { userId: user.id, revokedAt: null } });
    expect(active).toBe(0);
  });
});

describe('password reset', () => {
  it('responds identically whether or not the email exists', async () => {
    const user = await createUser();

    const known = await api().post('/api/v1/auth/forgot-password').send({ email: user.email });
    const unknown = await api()
      .post('/api/v1/auth/forgot-password')
      .send({ email: uniqueEmail('nobody') });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body.message).toBe(unknown.body.message);
  });

  it('resets the password and revokes existing sessions', async () => {
    const user = await createUser();

    const forgot = await api().post('/api/v1/auth/forgot-password').send({ email: user.email });
    const token = forgot.body.data.resetToken;
    expect(token).toEqual(expect.any(String));

    const newPassword = 'Rotated!Pass123';
    const reset = await api()
      .post('/api/v1/auth/reset-password')
      .send({ token, password: newPassword });
    expect(reset.status).toBe(200);

    // Old session is dead.
    expect((await api().get('/api/v1/auth/me').set(user.auth)).status).toBe(401);
    // Old password no longer works.
    expect(
      (await api().post('/api/v1/auth/login').send({ email: user.email, password: VALID_PASSWORD }))
        .status,
    ).toBe(401);
    // New password does.
    expect(
      (await api().post('/api/v1/auth/login').send({ email: user.email, password: newPassword }))
        .status,
    ).toBe(200);
  });

  it('refuses to reuse a consumed reset token', async () => {
    const user = await createUser();
    const forgot = await api().post('/api/v1/auth/forgot-password').send({ email: user.email });
    const token = forgot.body.data.resetToken;

    await api().post('/api/v1/auth/reset-password').send({ token, password: 'Rotated!Pass123' });
    const second = await api()
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'Another!Pass123' });

    expect(second.status).toBe(400);
  });
});
