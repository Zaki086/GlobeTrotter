import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { redis } from '../src/config/redis';

export const app: Express = createApp();
export const api = () => request(app);

/** Prefix so tests never collide with seeded or development data. */
export const TEST_PREFIX = 'jest-';

let counter = 0;
export function uniqueEmail(label = 'user'): string {
  counter += 1;
  return `${TEST_PREFIX}${label}-${Date.now()}-${counter}@example.com`;
}

export const VALID_PASSWORD = 'Str0ng!Passw0rd';

export interface TestUser {
  id: string;
  email: string;
  name: string;
  accessToken: string;
  refreshToken: string;
  auth: { Authorization: string };
}

/** Registers a user through the real signup endpoint and returns its tokens. */
export async function createUser(overrides: Partial<{ name: string; email: string; password: string }> = {}): Promise<TestUser> {
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? VALID_PASSWORD;
  const name = overrides.name ?? 'Test Traveler';

  const res = await api().post('/api/v1/auth/signup').send({ name, email, password });
  if (res.status !== 201) {
    throw new Error(`Signup failed (${res.status}): ${JSON.stringify(res.body)}`);
  }

  const { user, tokens } = res.body.data;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    auth: { Authorization: `Bearer ${tokens.accessToken}` },
  };
}

export async function promoteToAdmin(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  // The role lives in the access token, so a fresh one is needed after promotion.
  const res = await api()
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: VALID_PASSWORD });
  return `Bearer ${res.body.data.tokens.accessToken}`;
}

/** Two seeded cities from the same country, for building multi-stop trips. */
export async function seedCities() {
  const existing = await prisma.city.findMany({ where: { country: 'Testland' }, orderBy: { name: 'asc' } });
  if (existing.length >= 2) return existing;

  const alpha = await prisma.city.upsert({
    where: { name_country: { name: 'Alphaville', country: 'Testland' } },
    create: {
      name: 'Alphaville',
      country: 'Testland',
      countryCode: 'TL',
      region: 'Testing',
      timezone: 'UTC',
      latitude: 1.5,
      longitude: 2.5,
      costIndex: 50,
      popularity: 80,
      currency: 'USD',
    },
    update: {},
  });

  const beta = await prisma.city.upsert({
    where: { name_country: { name: 'Betaburg', country: 'Testland' } },
    create: {
      name: 'Betaburg',
      country: 'Testland',
      countryCode: 'TL',
      region: 'Testing',
      timezone: 'UTC',
      latitude: 3.5,
      longitude: 4.5,
      costIndex: 40,
      popularity: 60,
      currency: 'USD',
    },
    update: {},
  });

  return [alpha, beta];
}

export async function seedActivity(cityId: string, name: string, cost: number, minutes = 60) {
  return prisma.activity.upsert({
    where: { cityId_name: { cityId, name } },
    create: {
      cityId,
      name,
      type: 'SIGHTSEEING',
      description: `${name} description`,
      estimatedCost: cost,
      currency: 'USD',
      durationMinutes: minutes,
      popularity: 50,
    },
    update: { estimatedCost: cost, durationMinutes: minutes },
  });
}

/** Dates relative to today, as YYYY-MM-DD, so tests never go stale. */
export function dateIn(days: number): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days))
    .toISOString()
    .slice(0, 10);
}

/** Creates a trip via the API and returns its body. */
export async function createTrip(
  user: TestUser,
  overrides: Record<string, unknown> = {},
) {
  const res = await api()
    .post('/api/v1/trips')
    .set(user.auth)
    .send({
      name: 'Test Trip',
      startDate: dateIn(30),
      endDate: dateIn(40),
      travelers: 2,
      currency: 'USD',
      ...overrides,
    });
  if (res.status !== 201) {
    throw new Error(`Trip creation failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}

/** Removes everything created by tests, leaving reference data intact. */
export async function cleanDatabase() {
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.sharedItinerary.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.stopActivity.deleteMany({});
  await prisma.stop.deleteMany({});
  await prisma.budget.deleteMany({});
  await prisma.tripMember.deleteMany({});
  await prisma.trip.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.profile.deleteMany({});
  await prisma.user.deleteMany({});
}

/**
 * Deliberately does NOT tear down the Prisma or Redis clients.
 *
 * Both are singletons cached on globalThis, which is shared across test files
 * in a worker. Closing them in one file's afterAll left later files with a
 * reconnecting client — and since the rate limiter fails open when Redis is
 * unhealthy, that silently turned limiter assertions into false passes.
 * Connection cleanup is left to Jest's forceExit at the end of the run.
 */
export async function closeConnections() {
  // no-op — see above
}

export { prisma, redis };
