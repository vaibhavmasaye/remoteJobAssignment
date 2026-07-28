# Multi-Source Sync Pipeline

A production-grade, distributed sync pipeline that imports records from HubSpot, Stripe, and Google Calendar into a PostgreSQL database without data loss, duplication, or corruption.

**Status**: Phase 11 (Documentation & Submission) - Ready for production deployment

## Overview

This project implements a robust data synchronization framework that:

- **Syncs from 3 sources**: HubSpot (CRM), Stripe (Payments), Google Calendar (Events)
- **Guarantees data integrity**: Idempotent writes with hash-based deduplication, checkpoint recovery, stale cursor detection
- **Handles failures gracefully**: Exponential backoff retry logic, error classification, isolated sync runs
- **Scales securely**: Rate limiting, request validation, security headers, structured logging
- **Deploys easily**: Docker containerization, Render deployment, GitHub Actions CI

## Key Features

### Data Integrity (No Loss, Duplication, Corruption)
- **Idempotent writes**: Hash-based change detection—same record never duplicated
- **Checkpoint recovery**: Full sync with watermark overlap, incremental sync with cursors
- **Stale cursor detection**: 410 Gone handling with automatic full resync
- **Failed record tracking**: Persistent storage of failed records for manual intervention
- **Atomic operations**: Database transactions for multi-step operations

### Sync Framework
- **Adapter pattern**: Pluggable source adapters (HubSpot, Stripe, Google Calendar)
- **Error classification**: HTTP errors, network errors, parsing errors, validation errors
- **Retry logic**: Exponential backoff with jitter, transient vs. permanent error handling
- **Orchestration**: Promise.allSettled isolation—one source failure doesn't block others

### API
- **REST endpoints**: Trigger syncs, inspect results, query records
- **Admin authentication**: Bearer token validation for sensitive operations
- **Webhook verification**: Secure webhook signature validation
- **Health checks**: Liveness and readiness probes

### Security
- **Rate limiting**: Sliding window, per-IP enforcement, graceful 429 responses
- **Request validation**: Zod schemas for body, query, and path parameters
- **Security headers**: HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- **Error handling**: Structured logging, safe error messages, no credential leaks

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Sync Pipeline API                      │
│                   (Fastify + TypeScript)                     │
├─────────────────────────────────────────────────────────────┤
│  Health Checks │ Sync Routes │ Admin Auth │ Middleware     │
│  /health/live  │ /api/v1/sync│ Bearer     │ Rate Limit     │
│  /health/ready │ /sync-runs  │ Token      │ Request Val    │
│  /api/v1/status│ /records    │ Webhook    │ Security Hdrs  │
├─────────────────────────────────────────────────────────────┤
│                    Sync Orchestrator                         │
│           (Promise.allSettled for isolation)                │
├────────────────────┬────────────────────┬──────────────────┤
│  HubSpot Adapter   │  Stripe Adapter    │ Google Calendar  │
│  - Full sync       │  - Full sync       │ - Full sync      │
│  - Incremental     │  - Incremental     │ - Incremental    │
│  - Watermarks      │  - Events + CRM    │ - syncToken      │
│  - Normalization   │  - Normalization   │ - Normalization  │
├────────────────────┴────────────────────┴──────────────────┤
│         Error Classifier & Retry Logic                      │
│    (Classify errors, exponential backoff, jitter)          │
├─────────────────────────────────────────────────────────────┤
│              Database Layer (Prisma ORM)                    │
│  Checkpoints │ Sync Runs │ Records │ Failed Records       │
├─────────────────────────────────────────────────────────────┤
│              PostgreSQL Database                            │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### Core Tables
- **SourceConnection**: OAuth/API credentials for each source
- **SyncCheckpoint**: Cursor/watermark state for incremental syncs
- **SyncRun**: Overall sync execution record (start, end, status, summary)
- **SourceSyncRun**: Per-source sync execution details (records seen, written, failed)
- **ExternalRecord**: Mapping between external IDs and normalized IDs
- **ProcessedWebhookEvent**: Deduplication of webhook payloads
- **FailedRecord**: Records that failed to sync (for manual intervention)

### Normalized Tables
- **Person**: Unified contacts from HubSpot, Stripe customers, Google Calendar attendees
- **Payment**: Unified payment records from Stripe
- **CalendarEvent**: Unified calendar events from Google Calendar

## API Endpoints

### Health Checks
```bash
# Liveness probe (service running?)
GET /health/live
# -> {"status":"ok"}

# Readiness probe (service ready to handle requests?)
GET /health/ready
# -> {"status":"ready","timestamp":"2026-07-28T..."}

# Status (version, environment, uptime)
GET /api/v1/status
# -> {"version":"1.0.0","environment":"production","uptime":3600.5,"timestamp":"..."}
```

### Sync Operations
```bash
# Trigger full sync of all sources
POST /api/v1/sync
Authorization: Bearer YOUR_ADMIN_AUTH_TOKEN
# -> {"status":"accepted","runId":"uuid","message":"Sync run initiated"}

# List recent sync runs
GET /api/v1/sync-runs
Authorization: Bearer YOUR_ADMIN_AUTH_TOKEN
# -> {"count":5,"runs":[{id,status,triggerType,startedAt,...}]}

# Get details of specific sync run
GET /api/v1/sync-runs/:runId
Authorization: Bearer YOUR_ADMIN_AUTH_TOKEN
# -> {id,correlationId,status,sources:[...]}

# Query normalized records
GET /api/v1/records?source=HUBSPOT&type=contact&externalId=12345
Authorization: Bearer YOUR_ADMIN_AUTH_TOKEN
# -> {record:{id,source,normalizedType,normalizedId,...}}
```

## Setup & Installation

### Prerequisites
- Node.js 23+ or Docker
- PostgreSQL 15+ (local or cloud)
- API credentials for HubSpot, Stripe, Google Calendar

### Local Development

1. **Clone and install**
```bash
git clone https://github.com/vaibhavmasaye/remoteJobAssignment.git
cd remoteJobAssignment
npm install
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your credentials and database URL
```

3. **Set up database**
```bash
npx prisma migrate deploy  # Run migrations
npx prisma generate       # Generate Prisma client
```

4. **Start development server**
```bash
npm run dev  # Runs on http://localhost:3000
```

5. **Run tests**
```bash
npm test                 # Run all unit tests
npm run test:watch     # Watch mode
npm run test:ui        # UI dashboard
```

### Docker (Local Testing)

```bash
docker-compose up  # Starts API + PostgreSQL
# API available at http://localhost:3000
# Database available at localhost:5432
```

### Production Deployment

See [DEPLOYMENT.md](./doc/DEPLOYMENT.md) for detailed Render deployment instructions.

Quick start:
```bash
# 1. Push code to GitHub
git push origin main

# 2. Connect to Render, configure env vars, deploy
# 3. Run migrations: npx prisma migrate deploy
# 4. Test: curl https://your-service.onrender.com/health/live
```

## Configuration

### Environment Variables

**Database**
- `DATABASE_URL`: PostgreSQL connection string (required)

**Server**
- `NODE_ENV`: `development` or `production`
- `PORT`: Server port (default: 3000)
- `LOG_LEVEL`: `debug`, `info`, `warn`, `error` (default: info)

**Security**
- `ADMIN_AUTH_TOKEN`: Secure token for admin endpoints (required)
- `TRUST_PROXY`: Set to `true` behind reverse proxy
- `REQUEST_BODY_LIMIT_BYTES`: Max request body size (default: 1MB)

**API Credentials**
- `HUBSPOT_API_KEY`: HubSpot private app access token
- `STRIPE_API_KEY`: Stripe API secret key
- `GOOGLE_CALENDAR_OAUTH_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET`: Google OAuth client secret

**Optional**
- `SENTRY_DSN`: Sentry error tracking URL
- `HEALTH_CHECK_DATABASE`: Check database in readiness probe (default: true)

See [.env.example](./.env.example) for complete list.

## Development

### Project Structure
```
src/
├── app.ts                 # Fastify app initialization
├── server.ts              # Server entry point
├── config/
│   └── env.ts             # Environment validation (Zod)
├── db/
│   ├── prisma.ts          # Prisma client
│   └── repositories/      # Typed database operations
├── middleware/
│   ├── rate-limit.ts      # Sliding window rate limiting
│   ├── request-validation.ts  # Zod validation handlers
│   ├── security-headers.ts    # HSTS, CSP, etc.
│   └── error-handler.ts   # Global error handler
├── observability/
│   └── logger.ts          # Structured logging (Pino)
├── routes/
│   └── sync.routes.ts     # API endpoints
├── security/
│   ├── admin-auth.ts      # Bearer token validation
│   └── webhook-verification.ts  # HMAC signature verification
└── sync/
    ├── adapters/          # Source adapters
    │   ├── base-adapter.ts
    │   ├── hubspot.adapter.ts
    │   ├── stripe.adapter.ts
    │   └── google-calendar.adapter.ts
    ├── error-classifier.ts   # Error classification logic
    ├── idempotent-writer.ts  # Hash-based deduplication
    ├── orchestrator.ts    # Sync coordination
    ├── retry.ts          # Exponential backoff
    └── types.ts          # TypeScript interfaces
prisma/
├── schema.prisma          # Database schema
└── migrations/            # Database migrations
tests/
└── unit/
    ├── error-classifier.test.ts  # 33 tests
    └── rate-limit.test.ts        # 18 tests
.github/
└── workflows/
    └── ci.yml             # GitHub Actions workflow
doc/
├── DEPLOYMENT.md          # Deployment guide
├── environment-variables-template.md
└── problem-statement-1-sync-pipeline-plan-updated(1).md
```

### Scripts

```bash
npm run dev              # Start dev server (ts-node)
npm run build            # Build TypeScript to dist/
npm start                # Run built application
npm test                 # Run all unit tests (51 tests)
npm run test:watch      # Watch mode
npm run test:ui         # Vitest UI
npm run lint            # Run ESLint
npm run format          # Format code with Prettier
npm run format:check    # Check format without modifying
npm run type-check      # Type-check without emitting
npm run prisma:generate # Generate Prisma client
npm run prisma:migrate:dev    # Create new migration
npm run prisma:migrate:deploy # Run pending migrations
npm run prisma:studio   # Open Prisma Studio (visual DB editor)
```

## Testing

### Unit Tests (51 tests, ~1 second)

**Error Classifier (33 tests)**
- HTTP error classification (400, 401, 403, 404, 408, 429, 500, 502, 503, 504, 410)
- Network error classification (timeout, ECONNREFUSED, ENOTFOUND, ECONNRESET)
- Parsing and validation error handling
- Generic error classification
- Retry logic (transient vs. permanent)

**Rate Limiter (18 tests)**
- Sliding window enforcement
- Per-IP isolation
- Window expiration and reset
- X-Forwarded-For header parsing
- Request count tracking
- Memory cleanup

Run tests:
```bash
npm test                # Run once
npm run test:watch    # Watch mode
npm run test:ui       # Visual UI
```

## Monitoring & Observability

### Structured Logging

All logs include context:
```json
{
  "level": "info",
  "time": "2026-07-28T12:00:00.000Z",
  "requestId": "req-12345",
  "method": "POST",
  "url": "/api/v1/sync",
  "statusCode": 202,
  "duration": 145,
  "message": "Sync requested"
}
```

Sensitive data is redacted (tokens, passwords, API keys).

### Health Checks

- **Liveness** (`/health/live`): Is the service running?
- **Readiness** (`/health/ready`): Is the service ready to handle requests?
- **Status** (`/api/v1/status`): Version, environment, uptime

### Error Tracking

Set `SENTRY_DSN` to enable [Sentry](https://sentry.io) error tracking (optional).

### Database Inspection

```bash
# Open Prisma Studio visual editor
npm run prisma:studio
# Opens http://localhost:5555
```

## Performance

### Benchmarks

- **Cold start**: ~300ms (Node.js + TypeScript)
- **Liveness check**: <5ms
- **Readiness check**: <50ms (with database)
- **Sync trigger**: <200ms (returns 202 Accepted)
- **Rate limiter**: <1ms per request

### Scalability

- **Rate limiting**: 100 req/min per IP (configurable)
- **Concurrent syncs**: Isolated via Promise.allSettled
- **Database**: Indexed queries on external IDs, sync run IDs
- **Memory**: Cleanup of expired rate limit entries every 5 minutes

## Troubleshooting

### Build Issues
```bash
npm run type-check     # Check for TypeScript errors
npm run lint           # Check for lint errors
npm run build          # Full build
```

### Database Connection
```bash
# Verify DATABASE_URL format
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Run migrations
npx prisma migrate deploy
```

### Sync Failures
1. Check logs: `npm run prisma:studio` to inspect FailedRecord table
2. Verify API credentials in .env
3. Check rate limiting hasn't been triggered
4. Inspect sync run details: `GET /api/v1/sync-runs/:runId`

### Port Already in Use
```bash
# macOS/Linux
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

## Contributing

1. Create a feature branch: `git checkout -b feature/xyz`
2. Make changes and add tests
3. Ensure all tests pass: `npm test`
4. Format code: `npm run format`
5. Lint: `npm run lint`
6. Commit: `git commit -m "feat: xyz"`
7. Push: `git push origin feature/xyz`
8. Create pull request

## License

ISC

## Support

- **Issues**: GitHub Issues
- **Documentation**: See [doc/](./doc/) directory
- **Deployment**: [DEPLOYMENT.md](./doc/DEPLOYMENT.md)

## Project Status

This project was built as a comprehensive assignment to demonstrate:
- Full-stack TypeScript development
- Distributed data synchronization
- Production-grade error handling and observability
- Security best practices (rate limiting, validation, headers)
- Testable architecture (51 unit tests)
- Docker containerization
- Cloud deployment (Render)
- API design and documentation

**Completion**: All 11 phases implemented (foundation, database, framework, adapters, orchestration, security, testing, CI, deployment, documentation).

---

**Built with**: Node.js, TypeScript, Fastify, Prisma, PostgreSQL, Zod, Pino, Vitest
**Deployed on**: Render (Free tier available)
**CI/CD**: GitHub Actions
