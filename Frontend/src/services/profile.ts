import { USE_MOCK, request, delay } from '@/lib/api';
import { mockProfile, mockCities } from '@/services/mock-data';
import type {
  Notification,
  Profile,
  SavedDestination,
  UpdateProfileInput,
} from '@/types';

export async function getProfile(): Promise<Profile> {
  if (USE_MOCK) {
    await delay();
    return mockProfile;
  }
  return request<Profile>({ method: 'GET', url: '/profile' });
}

export async function updateProfile(input: UpdateProfileInput): Promise<Profile> {
  if (USE_MOCK) {
    await delay();
    Object.assign(mockProfile, input);
    return mockProfile;
  }
  return request<Profile>({ method: 'PATCH', url: '/profile', data: input });
}

export async function deleteProfile(password: string): Promise<void> {
  if (USE_MOCK) {
    await delay();
    if (password !== 'password') throw new Error('Incorrect password');
    return;
  }
  // The backend requires a typed confirmation alongside the password.
  await request<void>({
    method: 'DELETE',
    url: '/profile',
    data: { password, confirm: 'DELETE' },
  });
}

export async function addSavedDestination(cityId: string): Promise<Profile> {
  if (USE_MOCK) {
    await delay();
    const city = mockCities.find((c) => c.id === cityId);
    if (!city) throw new Error('City not found');
    const exists = mockProfile.savedDestinations.some((d) => d.id === cityId);
    if (!exists) {
      const dest: SavedDestination = {
        id: city.id,
        name: city.name,
        country: city.country,
        countryCode: city.countryCode,
        imageUrl: city.imageUrl,
        costIndex: city.costIndex,
      };
      mockProfile.savedDestinations.push(dest);
    }
    return mockProfile;
  }
  return request<Profile>({ method: 'POST', url: `/profile/saved-destinations/${cityId}` });
}

export async function removeSavedDestination(cityId: string): Promise<Profile> {
  if (USE_MOCK) {
    await delay();
    mockProfile.savedDestinations = mockProfile.savedDestinations.filter((d) => d.id !== cityId);
    return mockProfile;
  }
  return request<Profile>({ method: 'DELETE', url: `/profile/saved-destinations/${cityId}` });
}

/** The backend nests notifications as `{ items, unreadCount }`. */
export async function listNotifications(): Promise<{
  items: Notification[];
  unreadCount: number;
}> {
  if (USE_MOCK) {
    await delay();
    return { items: [], unreadCount: 0 };
  }
  return request<{ items: Notification[]; unreadCount: number }>({
    method: 'GET',
    url: '/profile/notifications',
  });
}

export async function markNotificationRead(id: string): Promise<void> {
  if (USE_MOCK) {
    await delay();
    return;
  }
  await request<void>({ method: 'PATCH', url: `/profile/notifications/${id}` });
}

export async function markAllNotificationsRead(): Promise<void> {
  if (USE_MOCK) {
    await delay();
    return;
  }
  await request<void>({ method: 'PATCH', url: '/profile/notifications/read-all' });
}
