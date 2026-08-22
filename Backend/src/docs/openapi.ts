import { env } from '../config/env';
import { parameters, responses, schemas, securitySchemes } from './components';
import { paths } from './paths';

/**
 * The complete OpenAPI 3.0 document, served at /api/docs (UI) and
 * /api/docs.json (raw). Paths are relative to the API prefix, which is
 * carried in the server URL.
 */
export const openApiDocument = {
  openapi: '3.0.3',

  info: {
    title: 'GlobeTrotter API',
    version: '1.0.0',
    description: `
Backend for **GlobeTrotter** — a personalized, multi-city travel planning platform.

### Conventions

Every response uses the same envelope:

\`\`\`json
{ "success": true, "data": {}, "message": "" }
\`\`\`

\`\`\`json
{ "success": false, "message": "Validation failed", "errors": [] }
\`\`\`

Paginated endpoints add a \`meta\` object with \`page\`, \`limit\`, \`total\`,
\`totalPages\`, \`hasNextPage\` and \`hasPrevPage\`.

### Authentication

\`POST /auth/login\` returns a short-lived **access token** (default 15m) and a
long-lived **refresh token** (default 30d). Send the access token as
\`Authorization: Bearer <token>\`.

Refresh tokens rotate on every use and are stored only as SHA-256 digests.
Presenting an already-rotated token is treated as a compromise and revokes the
entire session.

### Rate limiting

All limits use a **sliding window** in Redis, so a burst cannot be smuggled
across a window boundary. Responses carry \`RateLimit-Limit\`,
\`RateLimit-Remaining\` and \`RateLimit-Policy\`; a 429 also sets \`Retry-After\`.

| Route | Limit |
| --- | --- |
| \`POST /auth/login\` | 5 / minute / IP+email |
| \`POST /auth/signup\` | 3 / hour / IP |
| \`POST /auth/forgot-password\` | 3 / hour |
| \`GET /cities\`, \`GET /activities\` | 60 / minute |
| \`POST /trips\` | 20 / hour |
| \`POST /stops/:id/activities\` | 120 / minute |
| \`POST /trips/:id/share\` | 30 / hour |
| \`POST /public/:slug/copy\` | 10 / hour |
| everything else | 300 / minute |
    `.trim(),
    contact: { name: 'GlobeTrotter API' },
    license: { name: 'MIT' },
  },

  servers: [
    { url: `http://localhost:${env.PORT}${env.API_PREFIX}`, description: 'Local development' },
    { url: env.API_PREFIX, description: 'Same-origin (relative)' },
  ],

  tags: [
    { name: 'Health', description: 'Liveness and readiness' },
    { name: 'Auth', description: 'Registration, sign-in, token rotation and session management' },
    { name: 'Dashboard', description: 'Home screen aggregate' },
    { name: 'Trips', description: 'Trip CRUD and collaborators' },
    { name: 'Stops', description: 'Multi-city stops, including drag-and-drop reordering' },
    { name: 'Cities', description: 'Seeded city catalog and search' },
    { name: 'Activities', description: 'Activity catalog and per-stop scheduling' },
    { name: 'Itinerary', description: 'Day-wise itinerary and calendar views' },
    { name: 'Budget', description: 'Automatic cost breakdown and expense logging' },
    { name: 'Sharing', description: 'Public read-only itineraries and trip copying' },
    { name: 'Profile', description: 'User settings, saved destinations and notifications' },
    { name: 'Admin', description: 'Platform analytics and user management (ADMIN only)' },
  ],

  components: {
    securitySchemes,
    schemas,
    parameters,
    responses,
  },

  // Secured by default; public endpoints opt out with `security: []`.
  security: [{ bearerAuth: [] }],

  paths,
} as const;

export default openApiDocument;
