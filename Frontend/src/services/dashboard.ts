import { USE_MOCK, request, delay } from '@/lib/api';
import { getDashboard as getMockDashboard } from '@/services/mock-data';
import type { Dashboard } from '@/types';

/** GET /dashboard — the whole home screen in one round trip. */
export async function getDashboard(): Promise<Dashboard> {
  if (USE_MOCK) {
    await delay();
    return getMockDashboard();
  }
  return request<Dashboard>({ method: 'GET', url: '/dashboard' });
}
