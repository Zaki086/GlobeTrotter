/** Reusable OpenAPI schemas, parameters and responses. */

export const securitySchemes = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description:
      'Access token from POST /auth/login or /auth/signup. Send as `Authorization: Bearer <token>`.',
  },
} as const;

export const schemas = {
  // --- Envelopes -----------------------------------------------------------
  SuccessResponse: {
    type: 'object',
    required: ['success', 'data', 'message'],
    properties: {
      success: { type: 'boolean', example: true },
      data: { type: 'object' },
      message: { type: 'string', example: 'Operation completed' },
      meta: { $ref: '#/components/schemas/PaginationMeta' },
    },
  },

  ErrorResponse: {
    type: 'object',
    required: ['success', 'message'],
    properties: {
      success: { type: 'boolean', example: false },
      message: { type: 'string', example: 'Something went wrong' },
      code: { type: 'string', example: 'BAD_REQUEST' },
      errors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string', example: 'email' },
            message: { type: 'string', example: 'Must be a valid email address' },
          },
        },
      },
    },
  },

  ValidationErrorResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      message: { type: 'string', example: 'Validation failed' },
      errors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string', example: 'password' },
            message: { type: 'string', example: 'Password must contain an uppercase letter' },
          },
        },
      },
    },
  },

  PaginationMeta: {
    type: 'object',
    properties: {
      page: { type: 'integer', example: 1 },
      limit: { type: 'integer', example: 20 },
      total: { type: 'integer', example: 137 },
      totalPages: { type: 'integer', example: 7 },
      hasNextPage: { type: 'boolean', example: true },
      hasPrevPage: { type: 'boolean', example: false },
    },
  },

  // --- Auth ----------------------------------------------------------------
  SignupRequest: {
    type: 'object',
    required: ['name', 'email', 'password'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 120, example: 'Ada Lovelace' },
      email: { type: 'string', format: 'email', example: 'ada@example.com' },
      password: {
        type: 'string',
        minLength: 8,
        description:
          'Must contain lowercase, uppercase, a number and a special character, and must not repeat a character 4+ times.',
        example: 'Str0ng!Passw0rd',
      },
    },
  },

  LoginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', example: 'demo@globetrotter.app' },
      password: { type: 'string', example: 'DemoPass123!' },
      deviceLabel: { type: 'string', maxLength: 120, example: 'Pixel 8' },
    },
  },

  TokenPair: {
    type: 'object',
    properties: {
      accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...' },
      refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...' },
      expiresIn: { type: 'integer', example: 900, description: 'Access token lifetime, seconds' },
      tokenType: { type: 'string', example: 'Bearer' },
    },
  },

  User: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string', example: 'Ada Lovelace' },
      email: { type: 'string', format: 'email' },
      role: { type: 'string', enum: ['USER', 'ADMIN'] },
      emailVerified: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
      lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },

  AuthResult: {
    type: 'object',
    properties: {
      user: { $ref: '#/components/schemas/User' },
      tokens: { $ref: '#/components/schemas/TokenPair' },
    },
  },

  // --- Trips ---------------------------------------------------------------
  CreateTripRequest: {
    type: 'object',
    required: ['name', 'startDate', 'endDate'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 160, example: 'Cherry Blossom Japan' },
      description: { type: 'string', maxLength: 5000 },
      coverImageUrl: { type: 'string', format: 'uri' },
      startDate: { type: 'string', format: 'date', example: '2026-03-28' },
      endDate: { type: 'string', format: 'date', example: '2026-04-10' },
      travelers: { type: 'integer', minimum: 1, maximum: 50, default: 1 },
      currency: { type: 'string', minLength: 3, maxLength: 3, default: 'USD', example: 'JPY' },
      status: {
        type: 'string',
        enum: ['DRAFT', 'PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED'],
        default: 'PLANNED',
      },
      plannedTotal: { type: 'number', minimum: 0, example: 4500, description: 'Optional budget ceiling' },
    },
  },

  UpdateTripRequest: {
    type: 'object',
    minProperties: 1,
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 160 },
      description: { type: 'string', nullable: true },
      coverImageUrl: { type: 'string', format: 'uri', nullable: true },
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' },
      travelers: { type: 'integer', minimum: 1, maximum: 50 },
      currency: { type: 'string', minLength: 3, maxLength: 3 },
      status: { type: 'string', enum: ['DRAFT', 'PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED'] },
      plannedTotal: { type: 'number', minimum: 0, nullable: true },
    },
  },

  TripSummary: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      description: { type: 'string', nullable: true },
      coverImageUrl: { type: 'string', nullable: true },
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' },
      durationDays: { type: 'integer', example: 14 },
      daysUntilStart: { type: 'integer', example: 62 },
      travelers: { type: 'integer' },
      currency: { type: 'string' },
      status: { type: 'string', enum: ['DRAFT', 'PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED'] },
      isPublic: { type: 'boolean' },
      stopCount: { type: 'integer' },
      activityCount: { type: 'integer' },
      cities: { type: 'array', items: { type: 'string' } },
      estimatedTotal: { type: 'number' },
      role: { type: 'string', enum: ['OWNER', 'EDITOR', 'VIEWER'] },
    },
  },

  // --- Stops ---------------------------------------------------------------
  CreateStopRequest: {
    type: 'object',
    required: ['cityId', 'arrivalDate', 'departureDate'],
    properties: {
      cityId: { type: 'string', format: 'uuid' },
      arrivalDate: { type: 'string', format: 'date', example: '2026-03-28' },
      departureDate: { type: 'string', format: 'date', example: '2026-04-01' },
      sequence: { type: 'integer', minimum: 0, description: 'Omit to append to the end' },
      notes: { type: 'string', maxLength: 2000 },
      accommodationCost: { type: 'number', minimum: 0, description: 'Total lodging for the stop' },
      transportCost: { type: 'number', minimum: 0, description: 'Cost of travelling to this stop' },
      mealsPerDayCost: { type: 'number', minimum: 0, description: 'Per person, per day' },
    },
  },

  ReorderStopsRequest: {
    type: 'object',
    required: ['tripId', 'stopIds'],
    properties: {
      tripId: { type: 'string', format: 'uuid' },
      stopIds: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
        description: 'The complete, ordered list of stop ids for the trip.',
      },
      shiftDates: {
        type: 'boolean',
        default: false,
        description: 'Recompute arrival/departure dates to follow the new order.',
      },
    },
  },

  Stop: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      tripId: { type: 'string', format: 'uuid' },
      sequence: { type: 'integer' },
      arrivalDate: { type: 'string', format: 'date' },
      departureDate: { type: 'string', format: 'date' },
      days: { type: 'integer' },
      nights: { type: 'integer' },
      notes: { type: 'string', nullable: true },
      accommodationCost: { type: 'number' },
      transportCost: { type: 'number' },
      mealsPerDayCost: { type: 'number' },
      city: { $ref: '#/components/schemas/City' },
      activities: { type: 'array', items: { $ref: '#/components/schemas/StopActivity' } },
    },
  },

  // --- Reference data ------------------------------------------------------
  City: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string', example: 'Kyoto' },
      country: { type: 'string', example: 'Japan' },
      countryCode: { type: 'string', example: 'JP' },
      region: { type: 'string', example: 'Asia' },
      timezone: { type: 'string', example: 'Asia/Tokyo' },
      latitude: { type: 'number' },
      longitude: { type: 'number' },
      costIndex: { type: 'integer', minimum: 0, maximum: 100, description: 'Relative daily spend' },
      popularity: { type: 'integer', minimum: 0, maximum: 100 },
      currency: { type: 'string' },
      description: { type: 'string', nullable: true },
      imageUrl: { type: 'string', nullable: true },
      activityCount: { type: 'integer' },
    },
  },

  Activity: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string', example: 'Fushimi Inari Shrine hike' },
      type: {
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
      description: { type: 'string', nullable: true },
      imageUrl: { type: 'string', nullable: true },
      estimatedCost: { type: 'number', description: 'Per person' },
      currency: { type: 'string' },
      durationMinutes: { type: 'integer' },
      popularity: { type: 'integer' },
      city: { type: 'object' },
    },
  },

  AddStopActivityRequest: {
    type: 'object',
    required: ['activityId'],
    properties: {
      activityId: { type: 'string', format: 'uuid' },
      scheduledDate: { type: 'string', format: 'date', description: 'Must fall inside the stop' },
      startTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '09:30' },
      endTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '12:00' },
      sequence: { type: 'integer', minimum: 0 },
      costOverride: { type: 'number', minimum: 0, description: 'Overrides the catalog price' },
      durationOverride: { type: 'integer', minimum: 1 },
      notes: { type: 'string', maxLength: 1000 },
    },
  },

  StopActivity: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      activityId: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      type: { type: 'string' },
      scheduledDate: { type: 'string', format: 'date', nullable: true },
      startTime: { type: 'string', nullable: true },
      endTime: { type: 'string', nullable: true },
      sequence: { type: 'integer' },
      cost: { type: 'number', description: 'Effective cost after any override' },
      durationMinutes: { type: 'integer' },
      isCostOverridden: { type: 'boolean' },
      notes: { type: 'string', nullable: true },
    },
  },

  // --- Budget --------------------------------------------------------------
  Budget: {
    type: 'object',
    properties: {
      tripId: { type: 'string', format: 'uuid' },
      currency: { type: 'string' },
      travelers: { type: 'integer' },
      totalDays: { type: 'integer' },
      total: { type: 'number' },
      plannedTotal: { type: 'number', nullable: true },
      remaining: { type: 'number', nullable: true },
      isOverBudget: { type: 'boolean' },
      breakdown: {
        type: 'object',
        properties: {
          transport: { type: 'number' },
          stay: { type: 'number' },
          meals: { type: 'number' },
          activities: { type: 'number' },
          other: { type: 'number' },
        },
      },
      breakdownPercentage: { type: 'object', description: 'Each category as a % of the total' },
      perDayAverage: { type: 'number' },
      perPersonTotal: { type: 'number' },
      dailyLimit: { type: 'number', nullable: true },
      daily: {
        type: 'array',
        description: 'Per-day cost breakdown across the trip',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string', format: 'date' },
            dayNumber: { type: 'integer' },
            city: { type: 'string', nullable: true },
            total: { type: 'number' },
            isOverBudget: { type: 'boolean' },
          },
        },
      },
      overBudgetDays: { type: 'array', items: { type: 'object' } },
      overBudgetDayCount: { type: 'integer' },
      byStop: { type: 'array', items: { type: 'object' } },
    },
  },

  CreateExpenseRequest: {
    type: 'object',
    required: ['category', 'title', 'amount', 'incurredOn'],
    properties: {
      category: {
        type: 'string',
        enum: ['TRANSPORT', 'STAY', 'MEALS', 'ACTIVITIES', 'SHOPPING', 'OTHER'],
      },
      title: { type: 'string', maxLength: 160, example: 'Shinkansen Tokyo → Kyoto' },
      amount: { type: 'number', minimum: 0, example: 137.5 },
      currency: { type: 'string', minLength: 3, maxLength: 3 },
      incurredOn: { type: 'string', format: 'date' },
      stopId: { type: 'string', format: 'uuid' },
      notes: { type: 'string', maxLength: 1000 },
    },
  },

  // --- Itinerary / calendar ------------------------------------------------
  Itinerary: {
    type: 'object',
    properties: {
      trip: { type: 'object' },
      view: { type: 'string', enum: ['timeline', 'list'] },
      summary: {
        type: 'object',
        properties: {
          totalDays: { type: 'integer' },
          totalStops: { type: 'integer' },
          totalActivities: { type: 'integer' },
          totalCities: { type: 'integer' },
          countries: { type: 'array', items: { type: 'string' } },
          activitiesCost: { type: 'number' },
        },
      },
      timeline: {
        type: 'array',
        description: 'Day-wise structure',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string', format: 'date' },
            dayNumber: { type: 'integer' },
            weekday: { type: 'string' },
            city: { type: 'object', nullable: true },
            isArrivalDay: { type: 'boolean' },
            isDepartureDay: { type: 'boolean' },
            activities: { type: 'array', items: { type: 'object' } },
            dayCost: { type: 'number' },
            totalMinutes: { type: 'integer' },
          },
        },
      },
      list: { type: 'array', description: 'Grouped by city/stop', items: { type: 'object' } },
    },
  },

  Calendar: {
    type: 'object',
    properties: {
      tripId: { type: 'string', format: 'uuid' },
      currency: { type: 'string' },
      from: { type: 'string', format: 'date' },
      to: { type: 'string', format: 'date' },
      totalEvents: { type: 'integer' },
      days: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string', format: 'date' },
            weekday: { type: 'string' },
            eventCount: { type: 'integer' },
            totalCost: { type: 'number' },
            events: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  kind: { type: 'string', enum: ['travel', 'stay', 'activity'] },
                  title: { type: 'string' },
                  startTime: { type: 'string', nullable: true },
                  endTime: { type: 'string', nullable: true },
                  cost: { type: 'number' },
                  allDay: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
  },

  // --- Sharing -------------------------------------------------------------
  CreateShareRequest: {
    type: 'object',
    properties: {
      allowCopy: { type: 'boolean', default: true },
      expiresInDays: { type: 'integer', minimum: 1, maximum: 365 },
    },
  },

  ShareLink: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      slug: { type: 'string', example: 'cherry-blossom-japan-4f7bqm2xk9dh' },
      url: { type: 'string', format: 'uri' },
      allowCopy: { type: 'boolean' },
      isActive: { type: 'boolean' },
      viewCount: { type: 'integer' },
      copyCount: { type: 'integer' },
      expiresAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },

  CopyTripRequest: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 160 },
      startDate: {
        type: 'string',
        format: 'date',
        description: 'Shift the whole plan to start here, preserving stop spacing.',
      },
    },
  },

  // --- Profile -------------------------------------------------------------
  UpdateProfileRequest: {
    type: 'object',
    minProperties: 1,
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 120 },
      avatarUrl: { type: 'string', format: 'uri', nullable: true },
      bio: { type: 'string', maxLength: 500, nullable: true },
      language: { type: 'string', example: 'en' },
      currency: { type: 'string', minLength: 3, maxLength: 3, example: 'EUR' },
      country: { type: 'string', nullable: true },
      phone: { type: 'string', nullable: true },
      savedDestinations: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
        description: 'Full replacement of the saved city list',
      },
    },
  },

  DeleteProfileRequest: {
    type: 'object',
    required: ['password', 'confirm'],
    properties: {
      password: { type: 'string' },
      confirm: { type: 'string', enum: ['DELETE'] },
    },
  },

  Profile: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      role: { type: 'string', enum: ['USER', 'ADMIN'] },
      avatarUrl: { type: 'string', nullable: true },
      bio: { type: 'string', nullable: true },
      language: { type: 'string' },
      currency: { type: 'string' },
      country: { type: 'string', nullable: true },
      phone: { type: 'string', nullable: true },
      savedDestinations: { type: 'array', items: { $ref: '#/components/schemas/City' } },
      stats: { type: 'object' },
    },
  },

  // --- Dashboard / admin ---------------------------------------------------
  Dashboard: {
    type: 'object',
    properties: {
      user: { type: 'object' },
      welcomeMessage: { type: 'string', example: '62 days until "Cherry Blossom Japan".' },
      stats: { type: 'object' },
      upcomingTrips: { type: 'array', items: { type: 'object' } },
      ongoingTrips: { type: 'array', items: { type: 'object' } },
      recentTrips: { type: 'array', items: { type: 'object' } },
      countdowns: { type: 'array', items: { type: 'object' } },
      budgetSummary: { type: 'object' },
      recommendedCities: { type: 'array', items: { $ref: '#/components/schemas/City' } },
    },
  },

  Analytics: {
    type: 'object',
    properties: {
      generatedAt: { type: 'string', format: 'date-time' },
      windowDays: { type: 'integer' },
      totals: { type: 'object' },
      users: { type: 'object', description: 'Totals, new/active counts, activation rate' },
      trips: { type: 'object' },
      popularCities: { type: 'array', items: { type: 'object' } },
      popularActivities: { type: 'array', items: { type: 'object' } },
      userGrowth: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string', format: 'date' },
            count: { type: 'integer' },
            cumulative: { type: 'integer' },
          },
        },
      },
      tripGrowth: { type: 'array', items: { type: 'object' } },
      engagement: { type: 'object' },
    },
  },
} as const;

export const parameters = {
  PageParam: {
    name: 'page',
    in: 'query',
    schema: { type: 'integer', minimum: 1, default: 1 },
    description: 'Page number (1-indexed)',
  },
  LimitParam: {
    name: 'limit',
    in: 'query',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    description: 'Items per page',
  },
  TripIdParam: {
    name: 'id',
    in: 'path',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Trip id',
  },
  StopIdParam: {
    name: 'id',
    in: 'path',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Stop id',
  },
} as const;

export const responses = {
  BadRequest: {
    description: 'Malformed request',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  },
  Unauthorized: {
    description: 'Missing, expired or invalid access token',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  },
  Forbidden: {
    description: 'Authenticated but not permitted to perform this action',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  },
  NotFound: {
    description: 'Resource does not exist (or is not visible to the caller)',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  },
  Conflict: {
    description: 'Conflicts with the current state of the resource',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  },
  ValidationError: {
    description: 'Request failed schema validation',
    content: {
      'application/json': { schema: { $ref: '#/components/schemas/ValidationErrorResponse' } },
    },
  },
  TooManyRequests: {
    description: 'Rate limit exceeded — see the RateLimit-* and Retry-After headers',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  },
} as const;
