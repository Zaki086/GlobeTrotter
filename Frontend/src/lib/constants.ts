export const APP_NAME = 'GlobeTrotter';

/** INR leads — the destination catalog is India. */
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'] as const;

export const DEFAULT_CURRENCY = 'INR';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'ja', label: '日本語' },
] as const;

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  SIGHTSEEING: 'Sightseeing',
  FOOD: 'Food',
  ADVENTURE: 'Adventure',
  CULTURE: 'Culture',
  NATURE: 'Nature',
  NIGHTLIFE: 'Nightlife',
  SHOPPING: 'Shopping',
  RELAXATION: 'Relaxation',
  TRANSPORT: 'Transport',
  OTHER: 'Other',
};

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  TRANSPORT: 'Transport',
  STAY: 'Stay',
  MEALS: 'Meals',
  ACTIVITIES: 'Activities',
  SHOPPING: 'Shopping',
  OTHER: 'Other',
};

export const TRIP_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PLANNED: 'Planned',
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  PLANNED: 'bg-primary/10 text-primary',
  ONGOING: 'bg-green-500/10 text-green-600',
  COMPLETED: 'bg-blue-500/10 text-blue-600',
  CANCELLED: 'bg-red-500/10 text-red-600',
};
