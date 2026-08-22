/**
 * OpenAPI path definitions — every endpoint the API exposes.
 * Kept as data rather than JSDoc annotations so the spec is verifiable by
 * TypeScript and testable without a build step.
 */

const json = (schemaRef: string) => ({
  'application/json': { schema: { $ref: schemaRef } },
});

/** Standard success envelope wrapping a specific data schema. */
const ok = (description: string, dataSchema?: object) => ({
  description,
  content: {
    'application/json': {
      schema: {
        allOf: [
          { $ref: '#/components/schemas/SuccessResponse' },
          ...(dataSchema ? [{ type: 'object', properties: { data: dataSchema } }] : []),
        ],
      },
    },
  },
});

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const arrayOf = (name: string) => ({ type: 'array', items: ref(name) });

const authErrors = {
  401: { $ref: '#/components/responses/Unauthorized' },
  403: { $ref: '#/components/responses/Forbidden' },
  404: { $ref: '#/components/responses/NotFound' },
  422: { $ref: '#/components/responses/ValidationError' },
  429: { $ref: '#/components/responses/TooManyRequests' },
};

const secured = [{ bearerAuth: [] }];

export const paths = {
  // =========================================================================
  // Health
  // =========================================================================
  '/health': {
    get: {
      tags: ['Health'],
      summary: 'Service health check',
      description: 'Reports liveness plus the status of PostgreSQL and Redis. 503 when degraded.',
      security: [],
      responses: {
        200: ok('Service is healthy'),
        503: { description: 'One or more dependencies are down' },
      },
    },
  },

  // =========================================================================
  // Auth
  // =========================================================================
  '/auth/signup': {
    post: {
      tags: ['Auth'],
      summary: 'Create an account',
      description: 'Rate limited to **3 requests per hour per IP**. Passwords are hashed with Argon2id.',
      security: [],
      requestBody: { required: true, content: json('#/components/schemas/SignupRequest') },
      responses: {
        201: ok('Account created', ref('AuthResult')),
        409: { $ref: '#/components/responses/Conflict' },
        422: { $ref: '#/components/responses/ValidationError' },
        429: { $ref: '#/components/responses/TooManyRequests' },
      },
    },
  },

  '/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Sign in',
      description:
        'Returns an access token and a refresh token. Rate limited to **5 requests per minute** per IP + email.',
      security: [],
      requestBody: { required: true, content: json('#/components/schemas/LoginRequest') },
      responses: {
        200: ok('Signed in', ref('AuthResult')),
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        429: { $ref: '#/components/responses/TooManyRequests' },
      },
    },
  },

  '/auth/refresh': {
    post: {
      tags: ['Auth'],
      summary: 'Rotate the refresh token',
      description:
        'Issues a new token pair and revokes the presented refresh token. Reusing an already-rotated token is treated as a compromise and revokes the whole session.',
      security: [],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { refreshToken: { type: 'string' } },
              description: 'Omit to use the httpOnly `gt_refresh_token` cookie instead.',
            },
          },
        },
      },
      responses: {
        200: ok('Token refreshed', ref('AuthResult')),
        401: { $ref: '#/components/responses/Unauthorized' },
        429: { $ref: '#/components/responses/TooManyRequests' },
      },
    },
  },

  '/auth/logout': {
    post: {
      tags: ['Auth'],
      summary: 'Sign out of this device',
      security: secured,
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                refreshToken: { type: 'string' },
                allDevices: { type: 'boolean', default: false },
              },
            },
          },
        },
      },
      responses: { 200: ok('Signed out'), ...authErrors },
    },
  },

  '/auth/logout-all': {
    post: {
      tags: ['Auth'],
      summary: 'Sign out of every device',
      description: 'Revokes all sessions and refresh tokens for the current user.',
      security: secured,
      responses: { 200: ok('All sessions revoked'), ...authErrors },
    },
  },

  '/auth/me': {
    get: {
      tags: ['Auth'],
      summary: 'Current user',
      security: secured,
      responses: { 200: ok('Current user', ref('User')), ...authErrors },
    },
  },

  '/auth/sessions': {
    get: {
      tags: ['Auth'],
      summary: 'List active sessions',
      description: 'Shows every live session so the user can spot unfamiliar devices.',
      security: secured,
      responses: { 200: ok('Active sessions'), ...authErrors },
    },
  },

  '/auth/forgot-password': {
    post: {
      tags: ['Auth'],
      summary: 'Request a password reset',
      description:
        'Always returns 200 regardless of whether the email exists, so it cannot be used to enumerate accounts. Rate limited to **3 per hour**. Outside production the reset token is returned in the response for testing.',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email'],
              properties: { email: { type: 'string', format: 'email' } },
            },
          },
        },
      },
      responses: { 200: ok('Reset requested'), 429: { $ref: '#/components/responses/TooManyRequests' } },
    },
  },

  '/auth/reset-password': {
    post: {
      tags: ['Auth'],
      summary: 'Complete a password reset',
      description: 'Consumes the reset token and revokes every existing session.',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['token', 'password'],
              properties: { token: { type: 'string' }, password: { type: 'string' } },
            },
          },
        },
      },
      responses: {
        200: ok('Password reset'),
        400: { $ref: '#/components/responses/BadRequest' },
        422: { $ref: '#/components/responses/ValidationError' },
      },
    },
  },

  '/auth/change-password': {
    post: {
      tags: ['Auth'],
      summary: 'Change password while signed in',
      description: 'Revokes every other session, keeping only the one making the change.',
      security: secured,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['currentPassword', 'newPassword'],
              properties: { currentPassword: { type: 'string' }, newPassword: { type: 'string' } },
            },
          },
        },
      },
      responses: { 200: ok('Password changed'), ...authErrors },
    },
  },

  // =========================================================================
  // Dashboard
  // =========================================================================
  '/dashboard': {
    get: {
      tags: ['Dashboard'],
      summary: 'Home screen data',
      description:
        'Upcoming and recent trips, budget summary, recommended cities and trip countdowns in a single call. Cached for 60s per user.',
      security: secured,
      responses: { 200: ok('Dashboard', ref('Dashboard')), ...authErrors },
    },
  },

  // =========================================================================
  // Trips
  // =========================================================================
  '/trips': {
    post: {
      tags: ['Trips'],
      summary: 'Create a trip',
      description: 'Rate limited to **20 per hour**.',
      security: secured,
      requestBody: { required: true, content: json('#/components/schemas/CreateTripRequest') },
      responses: { 201: ok('Trip created', ref('TripSummary')), ...authErrors },
    },
    get: {
      tags: ['Trips'],
      summary: 'List my trips',
      security: secured,
      parameters: [
        { $ref: '#/components/parameters/PageParam' },
        { $ref: '#/components/parameters/LimitParam' },
        { name: 'search', in: 'query', schema: { type: 'string' } },
        {
          name: 'status',
          in: 'query',
          schema: { type: 'string', enum: ['DRAFT', 'PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED'] },
        },
        {
          name: 'filter',
          in: 'query',
          schema: { type: 'string', enum: ['all', 'upcoming', 'ongoing', 'past'], default: 'all' },
        },
        {
          name: 'sortBy',
          in: 'query',
          schema: { type: 'string', enum: ['startDate', 'createdAt', 'name'], default: 'startDate' },
        },
        { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
      ],
      responses: { 200: ok('Trips', arrayOf('TripSummary')), ...authErrors },
    },
  },

  '/trips/{id}': {
    get: {
      tags: ['Trips'],
      summary: 'Get one trip in full',
      description: 'Includes stops, scheduled activities, members, budget totals and share links.',
      security: secured,
      parameters: [{ $ref: '#/components/parameters/TripIdParam' }],
      responses: { 200: ok('Trip'), ...authErrors },
    },
    patch: {
      tags: ['Trips'],
      summary: 'Update a trip',
      description:
        'Narrowing the date range is rejected with 409 if stops would fall outside it. Budget totals recalculate automatically.',
      security: secured,
      parameters: [{ $ref: '#/components/parameters/TripIdParam' }],
      requestBody: { required: true, content: json('#/components/schemas/UpdateTripRequest') },
      responses: {
        200: ok('Trip updated', ref('TripSummary')),
        409: { $ref: '#/components/responses/Conflict' },
        ...authErrors,
      },
    },
    delete: {
      tags: ['Trips'],
      summary: 'Delete a trip',
      description: 'Owner only. Cascades to stops, scheduled activities, budget, expenses and shares.',
      security: secured,
      parameters: [{ $ref: '#/components/parameters/TripIdParam' }],
      responses: { 200: ok('Trip deleted'), ...authErrors },
    },
  },

  '/trips/{id}/itinerary': {
    get: {
      tags: ['Itinerary'],
      summary: 'Day-wise itinerary',
      description:
        'Returns both a `timeline` (per calendar day) and a `list` (grouped by city) so the view toggle needs no second request.',
      security: secured,
      parameters: [
        { $ref: '#/components/parameters/TripIdParam' },
        {
          name: 'view',
          in: 'query',
          schema: { type: 'string', enum: ['timeline', 'list'], default: 'timeline' },
        },
      ],
      responses: { 200: ok('Itinerary', ref('Itinerary')), ...authErrors },
    },
  },

  '/trips/{id}/calendar': {
    get: {
      tags: ['Itinerary'],
      summary: 'Calendar events grouped by date',
      description: 'Emits travel, stay and activity events per day for the calendar view.',
      security: secured,
      parameters: [
        { $ref: '#/components/parameters/TripIdParam' },
        { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
        { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
      ],
      responses: { 200: ok('Calendar', ref('Calendar')), ...authErrors },
    },
  },

  // =========================================================================
  // Stops
  // =========================================================================
  '/trips/{id}/stops': {
    get: {
      tags: ['Stops'],
      summary: 'List stops for a trip',
      security: secured,
      parameters: [{ $ref: '#/components/parameters/TripIdParam' }],
      responses: { 200: ok('Stops', arrayOf('Stop')), ...authErrors },
    },
    post: {
      tags: ['Stops'],
      summary: 'Add a stop',
      description: 'Dates must fall inside the trip range. Omit `sequence` to append.',
      security: secured,
      parameters: [{ $ref: '#/components/parameters/TripIdParam' }],
      requestBody: { required: true, content: json('#/components/schemas/CreateStopRequest') },
      responses: { 201: ok('Stop added', ref('Stop')), ...authErrors },
    },
  },

  '/stops/reorder': {
    patch: {
      tags: ['Stops'],
      summary: 'Reorder stops (drag & drop)',
      description:
        'Send the **complete** ordered list of stop ids for the trip. Partial lists are rejected, which makes the call idempotent and safe against stale drags. Set `shiftDates` to re-flow arrival/departure dates into the new order.',
      security: secured,
      requestBody: { required: true, content: json('#/components/schemas/ReorderStopsRequest') },
      responses: {
        200: ok('Stops reordered', arrayOf('Stop')),
        400: { $ref: '#/components/responses/BadRequest' },
        ...authErrors,
      },
    },
  },

  '/stops/{id}': {
    get: {
      tags: ['Stops'],
      summary: 'Get a stop',
      security: secured,
      parameters: [{ $ref: '#/components/parameters/StopIdParam' }],
      responses: { 200: ok('Stop', ref('Stop')), ...authErrors },
    },
    patch: {
      tags: ['Stops'],
      summary: 'Update a stop',
      description:
        'Activities scheduled outside the new date range are unscheduled rather than deleted.',
      security: secured,
      parameters: [{ $ref: '#/components/parameters/StopIdParam' }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              minProperties: 1,
              properties: {
                cityId: { type: 'string', format: 'uuid' },
                arrivalDate: { type: 'string', format: 'date' },
                departureDate: { type: 'string', format: 'date' },
                notes: { type: 'string', nullable: true },
                accommodationCost: { type: 'number' },
                transportCost: { type: 'number' },
                mealsPerDayCost: { type: 'number' },
              },
            },
          },
        },
      },
      responses: { 200: ok('Stop updated', ref('Stop')), ...authErrors },
    },
    delete: {
      tags: ['Stops'],
      summary: 'Delete a stop',
      description: 'Remaining stops are resequenced so the order stays dense.',
      security: secured,
      parameters: [{ $ref: '#/components/parameters/StopIdParam' }],
      responses: { 200: ok('Stop removed'), ...authErrors },
    },
  },

  // =========================================================================
  // Cities
  // =========================================================================
  '/cities': {
    get: {
      tags: ['Cities'],
      summary: 'Search cities',
      description:
        'Seeded reference data — no third-party geocoding involved. Rate limited to **60 per minute**, cached for 10 minutes.',
      security: [],
      parameters: [
        { $ref: '#/components/parameters/PageParam' },
        { $ref: '#/components/parameters/LimitParam' },
        {
          name: 'search',
          in: 'query',
          schema: { type: 'string' },
          description: 'Matches city or country name',
        },
        { name: 'country', in: 'query', schema: { type: 'string' }, example: 'Japan' },
        { name: 'region', in: 'query', schema: { type: 'string' }, example: 'Asia' },
        { name: 'minCostIndex', in: 'query', schema: { type: 'integer', minimum: 0, maximum: 100 } },
        { name: 'maxCostIndex', in: 'query', schema: { type: 'integer', minimum: 0, maximum: 100 } },
        {
          name: 'sortBy',
          in: 'query',
          schema: { type: 'string', enum: ['popularity', 'name', 'costIndex'], default: 'popularity' },
        },
        { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
      ],
      responses: { 200: ok('Cities', arrayOf('City')), 429: { $ref: '#/components/responses/TooManyRequests' } },
    },
  },

  '/cities/facets': {
    get: {
      tags: ['Cities'],
      summary: 'Distinct countries and regions',
      description: 'Populates the search filter dropdowns.',
      security: [],
      responses: { 200: ok('Filters') },
    },
  },

  '/cities/popular': {
    get: {
      tags: ['Cities'],
      summary: 'Most-visited cities across all trips',
      security: [],
      parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', default: 10, maximum: 50 } }],
      responses: { 200: ok('Popular cities') },
    },
  },

  '/cities/{id}': {
    get: {
      tags: ['Cities'],
      summary: 'City detail with its top activities',
      security: [],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: { 200: ok('City', ref('City')), 404: { $ref: '#/components/responses/NotFound' } },
    },
  },

  // =========================================================================
  // Activities
  // =========================================================================
  '/activities': {
    get: {
      tags: ['Activities'],
      summary: 'Search the activity catalog',
      description: 'Filter by city, type, cost and duration. Rate limited to **60 per minute**.',
      security: [],
      parameters: [
        { $ref: '#/components/parameters/PageParam' },
        { $ref: '#/components/parameters/LimitParam' },
        { name: 'search', in: 'query', schema: { type: 'string' } },
        { name: 'cityId', in: 'query', schema: { type: 'string', format: 'uuid' } },
        {
          name: 'type',
          in: 'query',
          schema: {
            type: 'string',
            enum: [
              'SIGHTSEEING',
              'FOOD',
              'ADVENTURE',
              'CULTURE',
              'NATURE',
              'NIGHTLIFE',
              'SHOPPING',
              'RELAXATION',
              'TRANSPORT',
              'OTHER',
            ],
          },
        },
        { name: 'minCost', in: 'query', schema: { type: 'number', minimum: 0 } },
        { name: 'maxCost', in: 'query', schema: { type: 'number', minimum: 0 } },
        {
          name: 'maxDuration',
          in: 'query',
          schema: { type: 'integer', minimum: 1 },
          description: 'Maximum duration in minutes',
        },
        {
          name: 'sortBy',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['popularity', 'name', 'estimatedCost', 'durationMinutes'],
            default: 'popularity',
          },
        },
        { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
      ],
      responses: { 200: ok('Activities', arrayOf('Activity')), 429: { $ref: '#/components/responses/TooManyRequests' } },
    },
  },

  '/activities/popular': {
    get: {
      tags: ['Activities'],
      summary: 'Most-scheduled activities across all trips',
      security: [],
      parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', default: 10, maximum: 50 } }],
      responses: { 200: ok('Popular activities') },
    },
  },

  '/activities/{id}': {
    get: {
      tags: ['Activities'],
      summary: 'Activity detail',
      security: [],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: { 200: ok('Activity', ref('Activity')), 404: { $ref: '#/components/responses/NotFound' } },
    },
  },

  '/stops/{id}/activities': {
    get: {
      tags: ['Activities'],
      summary: 'List activities scheduled at a stop',
      security: secured,
      parameters: [{ $ref: '#/components/parameters/StopIdParam' }],
      responses: { 200: ok('Scheduled activities', arrayOf('StopActivity')), ...authErrors },
    },
    post: {
      tags: ['Activities'],
      summary: 'Schedule an activity into a stop',
      description:
        'The activity must belong to the stop\'s city. Cost and duration overrides are stored per-trip and never mutate the catalog. Rate limited to **120 per minute**.',
      security: secured,
      parameters: [{ $ref: '#/components/parameters/StopIdParam' }],
      requestBody: { required: true, content: json('#/components/schemas/AddStopActivityRequest') },
      responses: {
        201: ok('Activity scheduled', ref('StopActivity')),
        409: { $ref: '#/components/responses/Conflict' },
        ...authErrors,
      },
    },
  },

  '/stops/{id}/activities/{activityId}': {
    patch: {
      tags: ['Activities'],
      summary: 'Update a scheduled activity',
      security: secured,
      parameters: [
        { $ref: '#/components/parameters/StopIdParam' },
        { name: 'activityId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              minProperties: 1,
              properties: {
                scheduledDate: { type: 'string', format: 'date', nullable: true },
                startTime: { type: 'string', nullable: true },
                endTime: { type: 'string', nullable: true },
                sequence: { type: 'integer' },
                costOverride: { type: 'number', nullable: true },
                durationOverride: { type: 'integer', nullable: true },
                notes: { type: 'string', nullable: true },
              },
            },
          },
        },
      },
      responses: { 200: ok('Updated', ref('StopActivity')), ...authErrors },
    },
    delete: {
      tags: ['Activities'],
      summary: 'Remove an activity from a stop',
      security: secured,
      parameters: [
        { $ref: '#/components/parameters/StopIdParam' },
        { name: 'activityId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: { 200: ok('Activity removed'), ...authErrors },
    },
  },

  // =========================================================================
  // Budget
  // =========================================================================
  '/trips/{id}/budget': {
    get: {
      tags: ['Budget'],
      summary: 'Budget and cost breakdown',
      description:
        'Recomputed on every read. Returns totals by category, percentages for charting, per-day average, a per-day breakdown and the list of overbudget days.',
      security: secured,
      parameters: [{ $ref: '#/components/parameters/TripIdParam' }],
      responses: { 200: ok('Budget', ref('Budget')), ...authErrors },
    },
    patch: {
      tags: ['Budget'],
      summary: 'Set the budget ceiling and daily limit',
      security: secured,
      parameters: [{ $ref: '#/components/parameters/TripIdParam' }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              minProperties: 1,
              properties: {
                plannedTotal: { type: 'number', nullable: true },
                dailyLimit: {
                  type: 'number',
                  nullable: true,
                  description: 'Days above this are reported as overbudget',
                },
                currency: { type: 'string', minLength: 3, maxLength: 3 },
              },
            },
          },
        },
      },
      responses: { 200: ok('Budget updated', ref('Budget')), ...authErrors },
    },
  },

  '/trips/{id}/expenses': {
    get: {
      tags: ['Budget'],
      summary: 'List logged expenses',
      security: secured,
      parameters: [
        { $ref: '#/components/parameters/TripIdParam' },
        { $ref: '#/components/parameters/PageParam' },
        { $ref: '#/components/parameters/LimitParam' },
        {
          name: 'category',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['TRANSPORT', 'STAY', 'MEALS', 'ACTIVITIES', 'SHOPPING', 'OTHER'],
          },
        },
        { name: 'stopId', in: 'query', schema: { type: 'string', format: 'uuid' } },
        { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
        { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
      ],
      responses: { 200: ok('Expenses'), ...authErrors },
    },
    post: {
      tags: ['Budget'],
      summary: 'Log an expense',
      description: 'Recalculates the budget rollup immediately.',
      security: secured,
      parameters: [{ $ref: '#/components/parameters/TripIdParam' }],
      requestBody: { required: true, content: json('#/components/schemas/CreateExpenseRequest') },
      responses: { 201: ok('Expense recorded'), ...authErrors },
    },
  },

  '/trips/{id}/expenses/{expenseId}': {
    delete: {
      tags: ['Budget'],
      summary: 'Delete an expense',
      security: secured,
      parameters: [
        { $ref: '#/components/parameters/TripIdParam' },
        { name: 'expenseId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: { 200: ok('Expense deleted'), ...authErrors },
    },
  },

  // =========================================================================
  // Sharing
  // =========================================================================
  '/trips/{id}/share': {
    post: {
      tags: ['Sharing'],
      summary: 'Create a public share link',
      description:
        'Owner only. Generates a cryptographically random slug. Rate limited to **30 per hour**.',
      security: secured,
      parameters: [{ $ref: '#/components/parameters/TripIdParam' }],
      requestBody: { content: json('#/components/schemas/CreateShareRequest') },
      responses: { 201: ok('Share link created', ref('ShareLink')), ...authErrors },
    },
    get: {
      tags: ['Sharing'],
      summary: 'List share links for a trip',
      security: secured,
      parameters: [{ $ref: '#/components/parameters/TripIdParam' }],
      responses: { 200: ok('Share links', arrayOf('ShareLink')), ...authErrors },
    },
  },

  '/trips/{id}/share/{shareId}': {
    delete: {
      tags: ['Sharing'],
      summary: 'Revoke a share link',
      description: 'The trip returns to private once its last active link is revoked.',
      security: secured,
      parameters: [
        { $ref: '#/components/parameters/TripIdParam' },
        { name: 'shareId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: { 200: ok('Share link revoked'), ...authErrors },
    },
  },

  '/public/{slug}': {
    get: {
      tags: ['Sharing'],
      summary: 'View a shared itinerary (read-only, public)',
      description:
        'No authentication required. Strips private data: no member list, no itemised expenses, no owner email. Increments the view counter.',
      security: [],
      parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: ok('Shared itinerary'),
        404: { $ref: '#/components/responses/NotFound' },
        429: { $ref: '#/components/responses/TooManyRequests' },
      },
    },
  },

  '/public/{slug}/copy': {
    post: {
      tags: ['Sharing'],
      summary: 'Copy a shared itinerary into my trips',
      description:
        'Requires authentication. Creates an independent private DRAFT trip with its own stops, activities and budget. Supply `startDate` to shift the whole plan while preserving stop spacing. Rate limited to **10 per hour**.',
      security: secured,
      parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: { content: json('#/components/schemas/CopyTripRequest') },
      responses: {
        // authErrors already covers 403 (the owner may disallow copying).
        201: ok('Itinerary copied'),
        ...authErrors,
      },
    },
  },

  // =========================================================================
  // Trip members
  // =========================================================================
  '/trips/{id}/members': {
    post: {
      tags: ['Trips'],
      summary: 'Add a collaborator',
      description: 'Owner only. EDITOR can modify the itinerary; VIEWER is read-only.',
      security: secured,
      parameters: [{ $ref: '#/components/parameters/TripIdParam' }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email'],
              properties: {
                email: { type: 'string', format: 'email' },
                role: { type: 'string', enum: ['EDITOR', 'VIEWER'], default: 'VIEWER' },
              },
            },
          },
        },
      },
      responses: { 201: ok('Member added'), 409: { $ref: '#/components/responses/Conflict' }, ...authErrors },
    },
  },

  '/trips/{id}/members/{memberId}': {
    delete: {
      tags: ['Trips'],
      summary: 'Remove a collaborator',
      security: secured,
      parameters: [
        { $ref: '#/components/parameters/TripIdParam' },
        { name: 'memberId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: { 200: ok('Member removed'), ...authErrors },
    },
  },

  // =========================================================================
  // Profile
  // =========================================================================
  '/profile': {
    get: {
      tags: ['Profile'],
      summary: 'Get my profile',
      description: 'Saved destinations are hydrated into full city objects.',
      security: secured,
      responses: { 200: ok('Profile', ref('Profile')), ...authErrors },
    },
    patch: {
      tags: ['Profile'],
      summary: 'Update my profile',
      security: secured,
      requestBody: { required: true, content: json('#/components/schemas/UpdateProfileRequest') },
      responses: { 200: ok('Profile updated', ref('Profile')), ...authErrors },
    },
    delete: {
      tags: ['Profile'],
      summary: 'Delete my account permanently',
      description:
        'Irreversible. Requires the current password plus `confirm: "DELETE"`. Cascades to trips, stops, sessions and notifications.',
      security: secured,
      requestBody: { required: true, content: json('#/components/schemas/DeleteProfileRequest') },
      responses: { 200: ok('Account deleted'), ...authErrors },
    },
  },

  '/profile/saved-destinations/{cityId}': {
    post: {
      tags: ['Profile'],
      summary: 'Save a destination',
      security: secured,
      parameters: [
        { name: 'cityId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: { 200: ok('Destination saved', ref('Profile')), ...authErrors },
    },
    delete: {
      tags: ['Profile'],
      summary: 'Remove a saved destination',
      security: secured,
      parameters: [
        { name: 'cityId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: { 200: ok('Destination removed', ref('Profile')), ...authErrors },
    },
  },

  '/profile/notifications': {
    get: {
      tags: ['Profile'],
      summary: 'List my notifications',
      security: secured,
      parameters: [
        { $ref: '#/components/parameters/PageParam' },
        { $ref: '#/components/parameters/LimitParam' },
        { name: 'unreadOnly', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
      ],
      responses: { 200: ok('Notifications'), ...authErrors },
    },
  },

  '/profile/notifications/read-all': {
    patch: {
      tags: ['Profile'],
      summary: 'Mark every notification read',
      security: secured,
      responses: { 200: ok('All marked read'), ...authErrors },
    },
  },

  '/profile/notifications/{id}': {
    patch: {
      tags: ['Profile'],
      summary: 'Mark one notification read',
      security: secured,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: { 200: ok('Marked read'), ...authErrors },
    },
  },

  // =========================================================================
  // Admin
  // =========================================================================
  '/admin/analytics': {
    get: {
      tags: ['Admin'],
      summary: 'Platform analytics',
      description:
        'ADMIN only. Total users and trips, popular cities and activities, user growth series and engagement metrics.',
      security: secured,
      parameters: [
        {
          name: 'days',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 365, default: 30 },
          description: 'Window for the growth and engagement series',
        },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 } },
      ],
      responses: { 200: ok('Analytics', ref('Analytics')), ...authErrors },
    },
  },

  '/admin/users': {
    get: {
      tags: ['Admin'],
      summary: 'List users',
      security: secured,
      parameters: [
        { $ref: '#/components/parameters/PageParam' },
        { $ref: '#/components/parameters/LimitParam' },
        { name: 'search', in: 'query', schema: { type: 'string' } },
        { name: 'role', in: 'query', schema: { type: 'string', enum: ['USER', 'ADMIN'] } },
        { name: 'isActive', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
      ],
      responses: { 200: ok('Users'), ...authErrors },
    },
  },

  '/admin/users/{userId}': {
    get: {
      tags: ['Admin'],
      summary: 'Get one user with their recent trips',
      security: secured,
      parameters: [
        { name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: { 200: ok('User'), ...authErrors },
    },
    patch: {
      tags: ['Admin'],
      summary: 'Change a user\'s role or active status',
      description:
        'Deactivating revokes all of that user\'s sessions immediately. Admins cannot demote or deactivate themselves, and the last active admin cannot be removed.',
      security: secured,
      parameters: [
        { name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              minProperties: 1,
              properties: {
                role: { type: 'string', enum: ['USER', 'ADMIN'] },
                isActive: { type: 'boolean' },
              },
            },
          },
        },
      },
      responses: { 200: ok('User updated'), 409: { $ref: '#/components/responses/Conflict' }, ...authErrors },
    },
  },

  '/admin/audit-logs': {
    get: {
      tags: ['Admin'],
      summary: 'Query the audit trail',
      security: secured,
      parameters: [
        { $ref: '#/components/parameters/PageParam' },
        { $ref: '#/components/parameters/LimitParam' },
        { name: 'action', in: 'query', schema: { type: 'string' }, example: 'user.login' },
        { name: 'actorId', in: 'query', schema: { type: 'string', format: 'uuid' } },
        { name: 'resourceType', in: 'query', schema: { type: 'string' }, example: 'trip' },
        { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
        { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
      ],
      responses: { 200: ok('Audit logs'), ...authErrors },
    },
  },
} as const;
