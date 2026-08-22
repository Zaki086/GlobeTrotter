import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';
import type { ApiResponse, TokenPair } from '@/types';

/**
 * Mock mode is the default so the UI runs with no backend. Set
 * `VITE_USE_MOCK=false` in `.env` to talk to the real API.
 */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

/**
 * Where the API lives.
 *
 * `VITE_API_URL` wins when set. Otherwise the host is derived from whatever
 * the browser is currently on — which is what makes the app work from a phone
 * without rebuilding: on a handset `localhost` means the handset, so a
 * hard-coded localhost URL can never reach the laptop serving the app.
 *
 * The path must include `/api/v1`; the backend mounts every route under that
 * prefix and `/api` alone 404s.
 */
const API_PORT = (import.meta.env.VITE_API_PORT as string | undefined) ?? '4300';

function resolveApiBaseUrl(): string {
  const explicit = import.meta.env.VITE_API_URL as string | undefined;
  if (explicit) return explicit;

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:${API_PORT}/api/v1`;
  }

  return `http://localhost:${API_PORT}/api/v1`;
}

export const API_BASE_URL = resolveApiBaseUrl();

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

    if (status === 401 && original && !original._retried && !isAuthEndpoint) {
      original._retried = true;

      if (tokenStore.getRefresh()) {
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
      } else {
        // A 401 with no refresh token means the stored access token is stale or
        // bogus — most often the placeholder left behind by a previous run in
        // mock mode. Drop it, or every subsequent request keeps 401ing with a
        // token that can never be repaired.
        tokenStore.clear();
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
