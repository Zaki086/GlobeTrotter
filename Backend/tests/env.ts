/**
 * Test environment. Loaded before any module that reads process.env.
 *
 * Tests run against a dedicated `globetrotter_test` database so a test run can
 * never truncate development data, and with rate limiting off so the shared
 * per-IP buckets do not make unrelated tests flaky. The rate limiter has its
 * own test that re-enables it explicitly.
 */
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const baseUrl = process.env.DATABASE_URL ?? 'postgresql://globetrotter:globetrotter@localhost:5432/globetrotter';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = baseUrl.replace(/\/([^/?]+)(\?|$)/, '/globetrotter_test$2');
// Always off: the per-IP buckets are shared across tests and would make
// unrelated cases fail depending on execution order. globalSetup loads .env
// into the parent process and workers inherit it, so this must be an
// unconditional override rather than a fallback. The rate limiter has its own
// test that opts back in with TEST_RATE_LIMIT=true.
process.env.RATE_LIMIT_ENABLED = process.env.TEST_RATE_LIMIT === 'true' ? 'true' : 'false';
process.env.LOG_LEVEL = 'error';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-that-is-at-least-32-characters-long';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-that-is-at-least-32-characters-long';

export {};
