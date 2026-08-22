/** Cross-cutting constants. Keep magic numbers out of services. */

export const CACHE_TTL = {
  CITY_SEARCH: 600, // 10 min — reference data, changes only on reseed
  CITY_DETAIL: 3600,
  ACTIVITY_SEARCH: 600,
  DASHBOARD: 60,
  ADMIN_ANALYTICS: 120,
  PUBLIC_ITINERARY: 120,
} as const;

export const CACHE_KEY = {
  citySearch: (hash: string) => `cache:cities:${hash}`,
  activitySearch: (hash: string) => `cache:activities:${hash}`,
  dashboard: (userId: string) => `cache:dashboard:${userId}`,
  adminAnalytics: () => 'cache:admin:analytics',
  publicItinerary: (slug: string) => `cache:public:${slug}`,
  tripPattern: (tripId: string) => `cache:trip:${tripId}*`,
} as const;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const AUDIT_ACTION = {
  USER_SIGNUP: 'user.signup',
  USER_LOGIN: 'user.login',
  USER_LOGIN_FAILED: 'user.login_failed',
  USER_LOGOUT: 'user.logout',
  USER_LOGOUT_ALL: 'user.logout_all',
  TOKEN_REFRESH: 'auth.token_refresh',
  TOKEN_REUSE_DETECTED: 'auth.token_reuse_detected',
  PASSWORD_RESET_REQUEST: 'auth.password_reset_request',
  PASSWORD_RESET_COMPLETE: 'auth.password_reset_complete',
  PROFILE_UPDATED: 'profile.updated',
  PROFILE_DELETED: 'profile.deleted',
  TRIP_CREATED: 'trip.created',
  TRIP_UPDATED: 'trip.updated',
  TRIP_DELETED: 'trip.deleted',
  STOP_CREATED: 'stop.created',
  STOP_UPDATED: 'stop.updated',
  STOP_DELETED: 'stop.deleted',
  STOP_REORDERED: 'stop.reordered',
  ACTIVITY_ADDED: 'stop_activity.added',
  ACTIVITY_REMOVED: 'stop_activity.removed',
  EXPENSE_CREATED: 'expense.created',
  EXPENSE_DELETED: 'expense.deleted',
  BUDGET_UPDATED: 'budget.updated',
  TRIP_SHARED: 'trip.shared',
  SHARE_REVOKED: 'trip.share_revoked',
  TRIP_COPIED: 'trip.copied',
  ADMIN_ANALYTICS_VIEWED: 'admin.analytics_viewed',
  ADMIN_USER_UPDATED: 'admin.user_updated',
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

/** Slug alphabet for public share links — no vowels, so no accidental words. */
export const SHARE_SLUG_ALPHABET = '0123456789bcdfghjklmnpqrstvwxyz';
export const SHARE_SLUG_LENGTH = 12;
