export type Role = 'USER' | 'ADMIN';
export type TripMemberRole = 'OWNER' | 'EDITOR' | 'VIEWER';
export type TripStatus = 'DRAFT' | 'PLANNED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
export type ExpenseCategory = 'TRANSPORT' | 'STAY' | 'MEALS' | 'ACTIVITIES' | 'SHOPPING' | 'OTHER';
export type ActivityType =
  | 'SIGHTSEEING'
  | 'FOOD'
  | 'ADVENTURE'
  | 'CULTURE'
  | 'NATURE'
  | 'NIGHTLIFE'
  | 'SHOPPING'
  | 'RELAXATION'
  | 'TRANSPORT'
  | 'OTHER';
export type NotificationType =
  | 'TRIP_CREATED'
  | 'TRIP_UPDATED'
  | 'TRIP_SHARED'
  | 'TRIP_COPIED'
  | 'BUDGET_ALERT'
  | 'MEMBER_ADDED'
  | 'SYSTEM';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

/** GET /auth/me — the user with its raw profile row attached. */
export interface UserProfile extends PublicUser {
  profile: ProfileRecord | null;
  stats: {
    tripCount: number;
    activeSessions: number;
  };
}

/** The raw `profiles` row, as embedded by /auth/me and the admin user detail. */
export interface ProfileRecord {
  id: string;
  userId: string;
  avatarUrl: string | null;
  bio: string | null;
  language: string;
  currency: string;
  country: string | null;
  phone: string | null;
  savedDestinations: string[];
  createdAt: string;
  updatedAt: string;
}

/** GET /profile — the user and profile flattened, with cities hydrated. */
export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  avatarUrl: string | null;
  bio: string | null;
  language: string;
  currency: string;
  country: string | null;
  phone: string | null;
  savedDestinations: SavedDestination[];
  stats: {
    tripCount: number;
    sharedItineraries: number;
  };
}

export interface UpdateProfileInput {
  name?: string;
  avatarUrl?: string | null;
  bio?: string | null;
  language?: string;
  currency?: string;
  country?: string | null;
  phone?: string | null;
  savedDestinations?: string[];
}

export interface SavedDestination {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  imageUrl: string | null;
  costIndex: number;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
}

export interface AuthResult {
  user: PublicUser;
  tokens: TokenPair;
}

export interface City {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  region: string;
  timezone: string;
  latitude: number;
  longitude: number;
  costIndex: number;
  popularity: number;
  currency: string;
  description: string | null;
  imageUrl: string | null;
  activityCount: number;
}

export interface CityDetail extends City {
  topActivities: ActivitySummary[];
}

export interface CityFacets {
  countries: string[];
  countryCodes: { country: string; code: string }[];
  regions: string[];
}

export interface ActivitySummary {
  id: string;
  name: string;
  type: ActivityType;
  estimatedCost: number;
  currency: string;
  durationMinutes: number;
  imageUrl: string | null;
}

export interface Activity extends ActivitySummary {
  cityId: string;
  description: string | null;
  popularity: number;
  city: {
    id: string;
    name: string;
    country: string;
    countryCode: string;
  };
}

export interface StopActivity {
  id: string;
  activityId: string;
  name: string;
  type: ActivityType;
  description: string | null;
  imageUrl: string | null;
  scheduledDate: string | null;
  startTime: string | null;
  endTime: string | null;
  sequence: number;
  cost: number;
  currency: string;
  durationMinutes: number;
  notes: string | null;
}

export interface Stop {
  id: string;
  tripId: string;
  sequence: number;
  arrivalDate: string;
  departureDate: string;
  days: number;
  nights: number;
  notes: string | null;
  accommodationCost: number;
  transportCost: number;
  mealsPerDayCost: number;
  city: City;
  activities: StopActivity[];
  createdAt: string;
  updatedAt: string;
}

export interface TripMember {
  id: string;
  role: TripMemberRole;
  joinedAt: string;
  user: PublicUser;
}

export interface TripSummary {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  startDate: string;
  endDate: string;
  durationDays: number;
  daysUntilStart: number;
  travelers: number;
  currency: string;
  status: TripStatus;
  isPublic: boolean;
  stopCount: number;
  activityCount: number;
  cities: string[];
  estimatedTotal: number;
  role: TripMemberRole;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /trips/:id.
 *
 * Deliberately NOT derived from TripSummary: the detail endpoint returns the
 * full `stops` array instead of the summary's rollups (stopCount, cities,
 * estimatedTotal, …), so extending TripSummary would demand fields the
 * backend never sends.
 */
export interface TripDetail {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  startDate: string;
  endDate: string;
  durationDays: number;
  daysUntilStart: number;
  travelers: number;
  currency: string;
  status: TripStatus;
  isPublic: boolean;
  owner: Pick<PublicUser, 'id' | 'name' | 'email'>;
  role: TripMemberRole;
  canEdit: boolean;
  createdAt: string;
  updatedAt: string;
  members: TripMember[];
  stops: Stop[];
  budget: {
    currency: string;
    plannedTotal: number | null;
    dailyLimit?: number | null;
    grandTotal: number;
    perDayAverage: number;
    lastCalculatedAt: string;
  } | null;
  shares: ShareLink[];
}

export interface CreateTripInput {
  name: string;
  description?: string;
  coverImageUrl?: string;
  startDate: string;
  endDate: string;
  travelers: number;
  currency: string;
  status?: TripStatus;
  plannedTotal?: number;
}

export interface UpdateTripInput {
  name?: string;
  description?: string;
  coverImageUrl?: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
  currency?: string;
  status?: TripStatus;
  isPublic?: boolean;
  plannedTotal?: number;
}

export interface CreateStopInput {
  cityId: string;
  arrivalDate: string;
  departureDate: string;
  sequence?: number;
  notes?: string;
  accommodationCost?: number;
  transportCost?: number;
  mealsPerDayCost?: number;
}

export interface UpdateStopInput extends Partial<CreateStopInput> {}

export interface ReorderStopsInput {
  tripId: string;
  stopIds: string[];
  shiftDates?: boolean;
}

export interface AddStopActivityInput {
  activityId: string;
  scheduledDate?: string;
  startTime?: string;
  endTime?: string;
  sequence?: number;
  costOverride?: number;
  durationOverride?: number;
  notes?: string;
}

export interface UpdateStopActivityInput extends Partial<AddStopActivityInput> {}

export interface BudgetBreakdown {
  transport: number;
  stay: number;
  meals: number;
  activities: number;
  other: number;
}

export interface DailyBudgetEntry {
  date: string;
  dayNumber: number;
  city: string | null;
  transport: number;
  stay: number;
  meals: number;
  activities: number;
  other: number;
  total: number;
  isOverBudget: boolean;
}

export interface Budget {
  tripId: string;
  tripName: string;
  currency: string;
  travelers: number;
  totalDays: number;
  total: number;
  plannedTotal: number | null;
  remaining: number | null;
  isOverBudget: boolean;
  breakdown: BudgetBreakdown;
  breakdownPercentage: BudgetBreakdown;
  perDayAverage: number;
  perPersonTotal: number;
  dailyLimit: number | null;
  daily: DailyBudgetEntry[];
  overBudgetDays: { date: string; total: number; overBy: number }[];
  overBudgetDayCount: number;
  byStop: {
    stopId: string;
    city: string;
    country: string;
    days: number;
    transport: number;
    stay: number;
    meals: number;
    activities: number;
    total: number;
  }[];
  lastCalculatedAt: string;
}

export interface Expense {
  id: string;
  tripId: string;
  stopId: string | null;
  createdById: string | null;
  category: ExpenseCategory;
  title: string;
  amount: number;
  currency: string;
  incurredOn: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string };
}

export interface CreateExpenseInput {
  stopId?: string;
  category: ExpenseCategory;
  title: string;
  amount: number;
  currency?: string;
  incurredOn: string;
  notes?: string;
}

export interface UpdateBudgetInput {
  plannedTotal?: number;
  dailyLimit?: number;
  currency?: string;
}

export interface ItineraryActivityBlock {
  id: string;
  activityId: string;
  name: string;
  type: ActivityType;
  description: string | null;
  imageUrl: string | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  cost: number;
  notes: string | null;
}

export interface ItineraryDay {
  date: string;
  dayNumber: number;
  weekday: string;
  city: { id: string; name: string; country: string; imageUrl: string | null } | null;
  stopId: string | null;
  isArrivalDay: boolean;
  isDepartureDay: boolean;
  activities: ItineraryActivityBlock[];
  dayCost: number;
  totalMinutes: number;
}

export interface ItineraryStopGroup {
  stopId: string;
  sequence: number;
  arrivalDate: string;
  departureDate: string;
  days: number;
  nights: number;
  notes: string | null;
  city: City & { latitude: number; longitude: number };
  activities: ItineraryActivityBlock[];
  costs: {
    transport: number;
    stay: number;
    meals: number;
    activities: number;
    total: number;
  };
}

export interface Itinerary {
  trip: {
    id: string;
    name: string;
    description: string | null;
    coverImageUrl: string | null;
    startDate: string;
    endDate: string;
    durationDays: number;
    travelers: number;
    currency: string;
    status: TripStatus;
    owner: { id: string; name: string };
  };
  view: 'timeline' | 'list';
  summary: {
    totalDays: number;
    totalStops: number;
    totalActivities: number;
    totalCities: number;
    countries: string[];
    activitiesCost: number;
  };
  timeline: ItineraryDay[];
  list: ItineraryStopGroup[];
}

export interface CalendarEvent {
  id: string;
  kind: 'travel' | 'stay' | 'activity';
  title: string;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  cost: number;
  city: string | null;
  stopId: string;
  imageUrl: string | null;
  allDay: boolean;
}

export interface CalendarDay {
  date: string;
  weekday: string;
  eventCount: number;
  totalCost: number;
  events: CalendarEvent[];
}

export interface TripCalendar {
  tripId: string;
  tripName: string;
  currency: string;
  from: string;
  to: string;
  totalEvents: number;
  days: CalendarDay[];
}

export interface ShareLink {
  id: string;
  slug: string;
  url: string;
  allowCopy: boolean;
  isActive: boolean;
  viewCount: number;
  copyCount: number;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreateShareInput {
  allowCopy?: boolean;
  expiresInDays?: number;
}

export interface PublicItinerary {
  slug: string;
  readOnly: true;
  allowCopy: boolean;
  sharedBy: string;
  sharedAt: string;
  viewCount: number;
  copyCount: number;
  shareUrl: string;
  trip: Itinerary['trip'];
  summary: Itinerary['summary'];
  timeline: ItineraryDay[];
  list: ItineraryStopGroup[];
  budget: {
    currency: string;
    total: number;
    perDayAverage: number;
    breakdown: BudgetBreakdown;
  } | null;
}

export interface CopyTripInput {
  name?: string;
  startDate?: string;
}

export interface DashboardUser {
  name: string;
  email: string;
  avatarUrl: string | null;
  currency: string;
  language: string;
}

export interface DashboardTripCard {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  startDate: string;
  endDate: string;
  durationDays: number;
  daysUntilStart: number;
  travelers: number;
  currency: string;
  status: TripStatus;
  isPublic: boolean;
  stopCount: number;
  activityCount: number;
  destinations: string[];
  countries: string[];
  heroImage: string | null;
  estimatedTotal: number;
}

export interface DashboardBudgetSummary {
  totalEstimated: number;
  totalPlanned: number;
  averagePerDay: number;
  highlights: {
    tripId: string;
    tripName: string;
    currency: string;
    estimated: number;
    planned: number | null;
    isOverBudget: boolean;
  }[];
}

export interface Dashboard {
  user: DashboardUser;
  welcomeMessage: string;
  stats: {
    totalTrips: number;
    upcomingTrips: number;
    ongoingTrips: number;
    completedTrips: number;
    byStatus: Record<TripStatus, number>;
    unreadNotifications: number;
  };
  upcomingTrips: DashboardTripCard[];
  ongoingTrips: DashboardTripCard[];
  recentTrips: DashboardTripCard[];
  countdowns: {
    tripId: string;
    tripName: string;
    startDate: string;
    daysRemaining: number;
    coverImageUrl: string | null;
    firstCity: string | null;
  }[];
  budgetSummary: DashboardBudgetSummary;
  recommendedCities: City[];
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionInfo {
  id: string;
  deviceLabel: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  lastUsedAt: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface AdminTotals {
  users: number;
  trips: number;
  stops: number;
  scheduledActivities: number;
  activeShareLinks: number;
  catalogCities: number;
  catalogActivities: number;
}

export interface AdminUserStats {
  total: number;
  newInWindow: number;
  activeInWindow: number;
  withAtLeastOneTrip: number;
  activationRate: number;
  activeRate: number;
}

export interface AdminTripStats {
  total: number;
  newInWindow: number;
  upcoming: number;
  byStatus: Record<TripStatus, number>;
  averagePerUser: number;
  averageStopsPerTrip: number;
  averageActivitiesPerTrip: number;
}

export interface AdminGrowthPoint {
  date: string;
  count: number;
  cumulative: number;
}

export interface AdminEngagement {
  shareLinks: number;
  totalShareViews: number;
  totalTripCopies: number;
  activationRate: number;
  avgTripBudget: number;
  totalPlannedSpend: number;
}

export interface AdminAnalytics {
  generatedAt: string;
  windowDays: number;
  totals: AdminTotals;
  users: AdminUserStats;
  trips: AdminTripStats;
  popularCities: {
    id: string;
    name: string;
    country: string;
    countryCode: string;
    region: string;
    imageUrl: string | null;
    tripCount: number;
  }[];
  popularActivities: {
    id: string;
    name: string;
    type: ActivityType;
    city: string;
    country: string;
    imageUrl: string | null;
    estimatedCost: number;
    timesAdded: number;
  }[];
  userGrowth: AdminGrowthPoint[];
  tripGrowth: AdminGrowthPoint[];
  engagement: AdminEngagement;
}

export interface AdminUserListItem {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  tripCount: number;
  sessionCount: number;
}

export interface AdminUserDetail extends PublicUser {
  isActive: boolean;
  emailVerified: boolean;
  profile: ProfileRecord | null;
  trips: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: TripStatus;
    stopCount: number;
  }[];
  stats: {
    tripCount: number;
    sessionCount: number;
    shareLinkCount: number;
  };
}

export interface ListTripsQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: TripStatus;
  filter?: 'all' | 'upcoming' | 'past' | 'ongoing';
  /** Mirrors the backend enum exactly — `updatedAt` is not a valid sort key
   *  there and would be rejected with a 422. */
  sortBy?: 'startDate' | 'createdAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface ListCitiesQuery {
  page?: number;
  limit?: number;
  search?: string;
  country?: string;
  region?: string;
  minCostIndex?: number;
  maxCostIndex?: number;
  sortBy?: 'popularity' | 'costIndex' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface ListActivitiesQuery {
  page?: number;
  limit?: number;
  search?: string;
  cityId?: string;
  type?: ActivityType;
  minCost?: number;
  maxCost?: number;
  maxDuration?: number;
  sortBy?: 'popularity' | 'estimatedCost' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface ListExpensesQuery {
  page?: number;
  limit?: number;
  category?: ExpenseCategory;
  stopId?: string;
  from?: string;
  to?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
}
