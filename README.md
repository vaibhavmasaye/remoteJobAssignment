# Reliable Multi-Source Sync Pipeline

A TypeScript service that synchronizes records from HubSpot, Stripe, and Google Calendar into PostgreSQL. It supports paginated full and incremental syncs, persistent checkpoints, per-source failure isolation, retry classification, normalized records, health checks, and an authenticated operations API.

## Submission links

- Live API: https://remotejobassignment.onrender.com
- Health check: https://remotejobassignment.onrender.com/health/live
- Demo video (maximum five minutes): **TODO: add public video URL**
- GitHub repository: https://github.com/vaibhavmasaye/remoteJobAssignment
- AI chat history/export: **TODO: add the shared Codex/ChatGPT conversation URL**

Do not submit until the remaining `TODO` entries above have been replaced.

## What it does

- Reads HubSpot contacts, Stripe customers/payment intents/events, and Google Calendar events.
- Uses full sync on the first run and checkpoint-driven incremental sync afterward.
- Handles cursor pagination and configurable page limits.
- Classifies authentication, rate-limit, transient, permanent, and stale-cursor errors.
- Isolates source failures with `Promise.allSettled`, so one integration does not cancel the others.
- Stores sync runs, source runs, checkpoints, raw external records, normalized records, and failed records.
- Uses Prisma ORM for typed PostgreSQL access.
- Protects operations endpoints with a bearer API key, rate limiting, and security headers.
- Exposes separate liveness and database-readiness endpoints.

## Architecture

```text
Fastify API
    │
    ├── authentication, rate limiting, validation, error handling
    │
    ▼
Sync orchestrator
    │
    ├── HubSpot adapter
    ├── Stripe adapter
    └── Google Calendar adapter
           │
           ▼
error classification → retry/checkpoint logic → idempotent writer
           │
           ▼
Prisma repositories → PostgreSQL
```

The source adapters implement a common async-generator interface. Each page is normalized and persisted before the checkpoint advances. Source run results are recorded independently and summarized by the parent sync run.

More detail is available in [the architecture guide](doc/ARCHITECTURE.md) and [API documentation](doc/API.md).

## API

| Method | Path | Authentication | Purpose |
|---|---|---|---|
| `GET` | `/health/live` | No | Process liveness |
| `GET` | `/health/ready` | No | Database readiness |
| `GET` | `/api/v1/status` | No | Version, environment, and uptime |
| `POST` | `/api/v1/sync` | Bearer key | Run enabled source syncs |
| `GET` | `/api/v1/sync-runs` | Bearer key | List recent runs |
| `GET` | `/api/v1/sync-runs/:runId` | Bearer key | Inspect one run and its sources |
| `GET` | `/api/v1/records` | Bearer key | Inspect a specific external record |

Examples:

```bash
curl "$BASE_URL/health/live"

curl "$BASE_URL/health/ready"

curl -X POST "$BASE_URL/api/v1/sync" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Idempotency-Key: demo-$(date +%s)"

curl "$BASE_URL/api/v1/sync-runs?limit=10" \
  -H "Authorization: Bearer $ADMIN_API_KEY"
```

Never put the real admin key in this README, a demo description, or a recorded terminal command. Store it in your shell and Render Environment settings.

## Run locally

Requirements:

- Node.js 22
- npm
- PostgreSQL 15+ (local, Docker, or hosted)

Install and configure:

```bash
git clone https://github.com/vaibhavmasaye/remoteJobAssignment.git
cd remoteJobAssignment
npm ci
cp .env.example .env
```

At minimum, set these values in `.env`:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
ADMIN_API_KEY=a-random-secret-with-at-least-32-characters
CREDENTIAL_ENCRYPTION_KEY=another-random-value-with-at-least-32-characters
```

Add credentials for each source you want to demonstrate:

```dotenv
HUBSPOT_ACCESS_TOKEN=...
STRIPE_SECRET_KEY=sk_test_...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
```

Create/update the database schema and start the server:

```bash
npm run db:push
npm run dev
```

Then verify it:

```bash
curl http://localhost:3000/health/live
curl http://localhost:3000/health/ready
```

If port 3000 is occupied, use `PORT=3001 npm run dev`.

Useful commands:

```bash
npm run build
npm test
npm run type-check
npm run db:studio
```

## Deploy on Render free tier

1. Create a free Render PostgreSQL database.
2. Create a Web Service from this repository and select **Docker**.
3. Keep the Dockerfile path as `./Dockerfile` and build context as `.`.
4. Set the health-check path to `/health/live`.
5. Add the required environment variables from `.env.example` in Render. Use the database's internal URL as `DATABASE_URL` when the services share a region.
6. Apply the schema once against the Render database with `npm run db:push` from a trusted environment, or configure that command as Render's pre-deploy command where available.
7. Deploy and confirm both `/health/live` and `/health/ready`.

The application listens on `0.0.0.0` and uses Render's `PORT` value. The Docker image uses Node 22 and generates Prisma Client during its build.

Do not commit `.env`. Rotate any credential that has ever appeared in source code, logs, screenshots, or Git history before making the repository public.

## Failure and edge-case behavior

- Missing or invalid bearer credentials return `401` or `403`.
- HTTP `429` and transient `5xx`/network errors are classified as retryable.
- Permanent client and validation errors are not retried indefinitely.
- A stale Google Calendar sync token (`410`) clears the checkpoint so the next run performs a full sync.
- Source failures are stored on their source run; successful sources can still complete.
- Page limits and request timeouts bound runaway integration calls.
- Repeated external IDs are skipped to prevent duplicate raw records.
- `/health/live` remains available when PostgreSQL is unavailable; `/health/ready` reports `503`.

## Tradeoffs and limitations

- This assignment uses `prisma db push` for simple free-tier deployment. A production team should commit reviewed Prisma migrations and run `prisma migrate deploy`.
- Sync jobs execute in the web process. A durable queue/worker would be safer for long jobs, retries, restarts, and horizontal scaling.
- The API currently uses one configured connection per source rather than multi-tenant connection management.
- The in-memory rate limiter is per process; distributed replicas would need Redis or a similar shared store.
- The request idempotency header is returned for traceability but is not yet persisted as a unique job key.
- Existing external IDs are skipped. Production change detection should persist and compare source versions or content hashes before updating normalized data.
- Unit tests cover error classification and rate limiting. Live integration behavior depends on external test accounts and should additionally have contract/integration tests.
- Webhook signature helpers exist, but webhook ingestion routes and durable replay handling are not complete.

## Five-minute demo outline

1. **0:00–0:35 — Problem and architecture:** show this README and the adapter/orchestrator/Prisma flow.
2. **0:35–1:05 — Prove deployment:** open the Render service and call `/health/live` and `/health/ready`.
3. **1:05–2:45 — Live job:** trigger `POST /api/v1/sync`, then query `/api/v1/sync-runs/:runId` and show the persisted per-source results.
4. **2:45–3:40 — Failure case:** call a protected endpoint without the bearer token and show `401`. Optionally demonstrate an invalid source credential and show that another source is isolated.
5. **3:40–4:30 — Reliability:** show checkpoints, retry/error classification, failed records, and stale-token handling.
6. **4:30–5:00 — Tradeoffs:** cover in-process jobs, `db push`, single connections, and next steps.

Record in an incognito window or hide the Render Environment page so no credentials appear in the video.

## Sources and references

The implementation was informed by these primary sources:

- [Render Docker deployment documentation](https://render.com/docs/docker)
- [Render web services and port binding](https://render.com/docs/web-services)
- [Render health checks](https://render.com/docs/health-checks)
- [Prisma schema documentation](https://docs.prisma.io/docs/orm/prisma-schema/overview)
- [Prisma `db push` documentation](https://www.prisma.io/docs/cli/db/push)
- [Fastify hooks documentation](https://fastify.dev/docs/latest/Reference/Hooks/)
- [HubSpot Contacts API](https://developers.hubspot.com/docs/api-reference/latest/crm/objects/contacts/guide)
- [Stripe cursor pagination](https://docs.stripe.com/api/pagination?lang=curl)
- [Google Calendar incremental synchronization](https://developers.google.com/workspace/calendar/api/guides/sync)
- [Node.js release schedule](https://nodejs.org/en/about/previous-releases)

Libraries and services used: Node.js, TypeScript, Fastify, Prisma ORM, PostgreSQL, Zod, Pino, Vitest, Docker, Render, HubSpot developer/test account, Stripe test mode, and Google Calendar API/OAuth.

No Stack Overflow answer or copied blog implementation was required for the current version.

## AI usage disclosure

AI tools were used substantially for requirements analysis, code generation, debugging, Prisma migration, Render troubleshooting, tests, and documentation. The developer reviewed changes through local builds, Prisma validation, unit tests, Git diffs, and deployment logs.

Tools used include Claude and OpenAI Codex/ChatGPT. The required public conversation share/export URL must be added under **Submission links** before submission. A detailed disclosure is available in [doc/AI_DISCLOSURE.md](doc/AI_DISCLOSURE.md).

## Verification

```text
Prisma schema validation: passed
TypeScript build: passed
Unit tests: 51 passed
```

The authenticated live integration run must be verified separately after the final Render deploy.

Live verification on July 29, 2026 (Asia/Kolkata): `/health/live`, `/health/ready`, and `/api/v1/status` returned HTTP 200; `/api/v1/sync-runs` without credentials returned the expected HTTP 401 edge case. The authenticated sync trigger still needs to be recorded and verified after deploying the latest commit.

## License

ISC
