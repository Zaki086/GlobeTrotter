# GlobeTrotter — Frontend

Mobile-first React client for **GlobeTrotter**, a multi-city travel planning
platform. Plan trips, build day-by-day itineraries, watch the budget update
itself, and publish a read-only itinerary others can copy.

Design direction follows [`../design.md`](../design.md): Airbnb for cards and
spacing, Polarsteps for storytelling, Notion Calendar for the calendar,
Google Maps for search, Wanderlog for the itinerary workflow.

---

## Quick start

```bash
cd Frontend
npm install
cp .env.example .env
npm run dev          # http://localhost:5199
```

Out of the box it runs in **mock mode** — every screen is populated from typed
in-memory fixtures, so no backend is needed.

### Against the real API

```bash
# Frontend/.env
VITE_USE_MOCK=false
VITE_API_URL=http://localhost:4000/api/v1
```

Then start the backend (`cd ../Backend && docker compose up --build`) and sign
in with the seeded account `demo@globetrotter.app` / `DemoPass123!`.

> The URL **must** include `/api/v1`. The backend mounts every route under that
> prefix, so `http://localhost:4000/api` will 404 on everything.

Whichever origin you serve from must appear in the backend's `CORS_ORIGINS`.

---

## Stack

React 19 · Vite · TypeScript (strict) · Tailwind v4 · shadcn/ui · Framer Motion
· React Router · TanStack Query · Axios · Recharts · Lucide

---

## Structure

```
src/
├── components/          reusable UI (GlassCard, TripCard, BottomSheet, …)
│   ├── ui/              shadcn primitives
│   └── layouts/         AuthLayout, MainLayout
├── features/itinerary/  the itinerary builder's sheets and route preview
├── pages/               one file per route
├── hooks/               use-auth, use-theme, use-toast, use-debounced-value
├── services/            the ONLY place that talks to the API
├── types/               shared types mirroring the backend contract
├── lib/                 axios client, formatters, utils, constants
└── routes/              route table and guards
```

Two rules hold throughout:

1. **No Axios in components.** Every request goes through `services/*`, which
   TanStack Query calls. Swapping mock for real is a one-line env change.
2. **Types mirror the backend exactly.** `types/index.ts` is the contract. If
   the API changes, it changes here first.

---

## Routes

| Path | Screen |
| --- | --- |
| `/login`, `/signup`, `/forgot-password` | Auth, over a full-bleed hero |
| `/dashboard` | Home — hero, countdowns, budget overview, recommendations |
| `/trips` | Trip cards with search, filter and sort |
| `/trips/new` | Six-step creation flow, one step per screen |
| `/trips/:id` | Itinerary view — timeline / by-city toggle |
| `/trips/:id/build` | **Itinerary builder** — drag-to-reorder, add stops/activities |
| `/trips/:id/budget`, `/budget` | Donut, daily bars, per-stop, expense log |
| `/trips/:id/calendar`, `/calendar` | Month grid + agenda |
| `/cities`, `/activities` | Search with filters and bottom-sheet detail |
| `/public/:slug` | Public read-only itinerary + QR + copy |
| `/profile` | Settings, saved destinations, notifications, danger zone |
| `/admin` | KPIs, growth chart, popular cities/activities, user table |

---

## Notable behaviour

**Reordering stops** sends the *complete* ordered id list, because the backend
rejects a partial one. The local order updates instantly and rolls back to the
server's truth if the request fails.

**Token refresh** is handled in the Axios interceptor. Concurrent 401s share a
single in-flight refresh — issuing several would trip the backend's refresh
reuse detection and kill the session.

**Theme** is applied by an inline script in `index.html` before first paint, so
dark-mode users never see a white flash.

**Time-of-day blocks** group a stop's activities into Morning / Afternoon /
Evening. Unscheduled activities land in Morning rather than disappearing.

---

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Type-check then production build |
| `npm run preview` | Serve the production build |
| `npm run lint` | oxlint |

---

## Accessibility

48×48 minimum touch targets, visible focus rings, ARIA labels on icon-only
controls, `aria-pressed` on toggles, live-region toasts, and full
`prefers-reduced-motion` support (animations collapse to near-zero duration).
