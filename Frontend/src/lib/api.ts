import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';
import type { ApiResponse, TokenPair } from '@/types';

/**
 * Mock mode is the default so the UI runs with no backend. Set
 * `VITE_USE_MOCK=false` in `.env` to talk to the real API.
 */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

/**
 * The backend mounts everything under `/api/v1` (API_PREFIX). This previously
 * defaulted to `/api`, so every real request 404'd.
 */
export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api/v1';

export const ACCESS_TOKEN_KEY = 'accessToken';
export const REFRESH_TOKEN_KEY = 'refreshToken';

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  set: (tokens: Pick<TokenPair, 'accessToken' | 'refreshToken'>) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Access tokens live ~15 minutes, so a 401 mid-session is normal rather than
 * a failure. One refresh attempt is made and the original request replayed.
 *
 * Concurrent 401s share a single in-flight refresh — otherwise each would
 * rotate the token independently and the backend's reuse detection would see
 * a replayed refresh token and revoke the whole session.
 */
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) throw new Error('Session expired');

  // A bare axios call, so the interceptors below do not recurse.
  const response = await axios.post<ApiResponse<{ tokens: TokenPair }>>(
    `${API_BASE_URL}/auth/refresh`,
    { refreshToken },
    { headers: { 'Content-Type': 'application/json' }, timeout: 15000 },
  );

  const tokens = response.data.data.tokens;
  tokenStore.set(tokens);
  return tokens.accessToken;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error.response?.status;

    const isAuthEndpoint = original?.url?.includes('/auth/refresh') || original?.url?.includes('/auth/login');

    if (status === 401 && original && !original._retried && !isAuthEndpoint && tokenStore.getRefresh()) {
      original._retried = true;
      try {
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
        const accessToken = await refreshPromise;

        original.headers = { ...original.headers, Authorization: `Bearer ${accessToken}` };
        return api.request(original);
      } catch {
        // Refresh failed — the session is genuinely over.
        tokenStore.clear();
        if (!window.location.pathname.startsWith('/login')) {
          window.location.assign('/login');
        }
      }
    }

    // Surface the backend's message; it is written for humans and already
    // carries field-level detail in `errors`.
    const data = error.response?.data;
    const fieldErrors = (data as { errors?: { field: string; message: string }[] } | undefined)?.errors;
    const detail = fieldErrors?.length ? fieldErrors.map((e) => e.message).join(', ') : undefined;

    return Promise.reject(new Error(detail ?? data?.message ?? error.message ?? 'Something went wrong'));
  },
);

/** Unwraps the backend's `{ success, data, message }` envelope. */
export async function request<T>(config: {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  url: string;
  data?: unknown;
  params?: Record<string, unknown>;
}): Promise<T> {
  const response = await api.request<ApiResponse<T>>({
    method: config.method,
    url: config.url,
    data: config.data,
    params: config.params,
  });
  return response.data.data;
}

/** Same as `request`, but also returns the pagination `meta` envelope. */
export async function requestPaginated<T>(config: {
  url: string;
  params?: Record<string, unknown>;
}): Promise<{ items: T[]; total: number }> {
  const response = await api.request<ApiResponse<T[]>>({
    method: 'GET',
    url: config.url,
    params: config.params,
  });
  return {
    items: response.data.data,
    total: response.data.meta?.total ?? response.data.data.length,
  };
}

/** Simulates network latency in mock mode so loading states are exercised. */
export function delay(ms = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
