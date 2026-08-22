import { USE_MOCK, request, delay, tokenStore } from '@/lib/api';
import { mockCurrentUser } from '@/services/mock-data';
import type {
  AuthResult,
  LoginInput,
  PublicUser,
  SessionInfo,
  SignupInput,
  TokenPair,
} from '@/types';

// Token persistence lives in one place (lib/api) so the axios interceptors
// and these calls can never disagree about the storage keys.
const saveTokens = (tokens: TokenPair): void => tokenStore.set(tokens);
const clearTokens = (): void => tokenStore.clear();

function fakeTokens(): TokenPair {
  return {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 900,
    tokenType: 'Bearer',
  };
}

export async function signup(input: SignupInput): Promise<AuthResult> {
  if (USE_MOCK) {
    await delay();
    const user: PublicUser = {
      id: 'user-new',
      name: input.name,
      email: input.email,
      role: 'USER',
      emailVerified: false,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    const tokens = fakeTokens();
    saveTokens(tokens);
    return { user, tokens };
  }
  const result = await request<AuthResult>({ method: 'POST', url: '/auth/signup', data: input });
  saveTokens(result.tokens);
  return result;
}

export async function login(input: LoginInput): Promise<AuthResult> {
  if (USE_MOCK) {
    await delay();
    const tokens = fakeTokens();
    saveTokens(tokens);
    return { user: mockCurrentUser, tokens };
  }
  const result = await request<AuthResult>({ method: 'POST', url: '/auth/login', data: input });
  saveTokens(result.tokens);
  return result;
}

export async function refresh(): Promise<AuthResult> {
  const refreshToken = tokenStore.getRefresh();
  if (USE_MOCK) {
    await delay();
    const tokens = fakeTokens();
    saveTokens(tokens);
    return { user: mockCurrentUser, tokens };
  }
  const result = await request<AuthResult>({
    method: 'POST',
    url: '/auth/refresh',
    data: { refreshToken },
  });
  saveTokens(result.tokens);
  return result;
}

export async function logout(): Promise<void> {
  const refreshToken = tokenStore.getRefresh();
  if (USE_MOCK) {
    await delay();
    clearTokens();
    return;
  }
  await request<void>({ method: 'POST', url: '/auth/logout', data: { refreshToken } });
  clearTokens();
}

export async function logoutAll(): Promise<void> {
  if (USE_MOCK) {
    await delay();
    clearTokens();
    return;
  }
  await request<void>({ method: 'POST', url: '/auth/logout-all' });
  clearTokens();
}

export async function forgotPassword(email: string): Promise<void> {
  if (USE_MOCK) {
    await delay();
    return;
  }
  await request<void>({ method: 'POST', url: '/auth/forgot-password', data: { email } });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  if (USE_MOCK) {
    await delay();
    return;
  }
  await request<void>({ method: 'POST', url: '/auth/reset-password', data: { token, password } });
}

export async function me(): Promise<PublicUser> {
  if (USE_MOCK) {
    await delay();
    return mockCurrentUser;
  }
  return request<PublicUser>({ method: 'GET', url: '/auth/me' });
}

export async function listSessions(): Promise<SessionInfo[]> {
  if (USE_MOCK) {
    await delay();
    return [
      {
        id: 'session-1',
        deviceLabel: 'Chrome on macOS',
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
        lastUsedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        isCurrent: true,
      },
    ];
  }
  return request<SessionInfo[]>({ method: 'GET', url: '/auth/sessions' });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  if (USE_MOCK) {
    await delay();
    return;
  }
  await request<void>({
    method: 'POST',
    url: '/auth/change-password',
    data: { currentPassword, newPassword },
  });
}
