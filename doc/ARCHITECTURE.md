# Architecture Guide

## System Design

The Sync Pipeline is architected for **reliability**, **scalability**, and **maintainability**.

```
┌─────────────────────────────────────────────────────────────────┐
│                     HTTP API Layer                              │
│  (Fastify with rate limiting, validation, security headers)    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  Authentication & Authorization                 │
│  (Bearer token validation, admin auth guard)                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              Sync Orchestration Layer                           │
│  (Coordinate multiple sources, isolation via Promise.allSettled)│
└─────────────────────────────────────────────────────────────────┘
                              ↓
          ┌───────────────────┼───────────────────┐
          ↓                   ↓                   ↓
   ┌─────────────┐    ┌─────────────┐    ┌──────────────┐
   │ HubSpot     │    │   Stripe    │    │   Google     │
   │ Adapter     │    │  Adapter    │    │  Calendar    │
   └─────────────┘    └─────────────┘    └──────────────┘
          ↓                   ↓                   ↓
   ┌─────────────┐    ┌─────────────┐    ┌──────────────┐
   │ Error Class │    │ Error Class │    │ Error Class  │
   │ + Retry     │    │ + Retry     │    │ + Retry      │
   └─────────────┘    └─────────────┘    └──────────────┘
          ↓                   ↓                   ↓
   ┌─────────────┐    ┌─────────────┐    ┌──────────────┐
   │ Idempotent  │    │ Idempotent  │    │ Idempotent   │
   │ Writer      │    │ Writer      │    │ Writer       │
   └─────────────┘    └─────────────┘    └──────────────┘
          ↓                   ↓                   ↓
┌─────────────────────────────────────────────────────────────────┐
│                  Database Access Layer                          │
│              (Prisma ORM with typed repositories)              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 PostgreSQL Database                             │
│  (Checkpoints, SyncRuns, ExternalRecords, NormalizedRecords)   │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. API Layer (Fastify)

**Location**: `src/app.ts`, `src/routes/sync.routes.ts`

**Responsibilities**:
- Route registration
- Request/response handling
- Middleware orchestration
- Graceful shutdown

**Features**:
- Rate limiting (100 req/min per IP)
- Request body validation (Zod schemas)
- Security headers (HSTS, CSP, etc.)
- Global error handling
- Structured logging

### 2. Authentication

**Location**: `src/security/admin-auth.ts`, `src/security/webhook-verification.ts`

**Admin Auth Guard**:
- Validates bearer token from `Authorization` header
- Compares against `ADMIN_AUTH_TOKEN` environment variable
- Returns 401 if token missing or invalid

**Webhook Verification** (planned):
- HMAC signature validation
- Timestamp verification
- Request replay protection

### 3. Sync Orchestrator

**Location**: `src/sync/orchestrator.ts`

**Responsibilities**:
- Coordinate multi-source syncs
- Create SyncRun and SourceSyncRun records
- Manage checkpoints
- Isolate source failures

**Key Design Pattern: Promise.allSettled**
```typescript
// Each source runs in parallel
const results = await Promise.allSettled([
  hubspotSync(),
  stripeSync(),
  googleCalendarSync(),
]);

// One failure doesn't block others
results.forEach(result => {
  if (result.status === 'fulfilled') {
    // Success
  } else {
    // Failure - logged but doesn't stop other sources
  }
});
```

**Benefits**:
- Independent failure domains
- Parallel execution
- Fault isolation
- Better observability

### 4. Source Adapters

**Location**: `src/sync/adapters/`

**Interface**: `SourceAdapter<TCursor>`
```typescript
interface SourceAdapter<TCursor = string | null> {
  source: SourceType;
  fullSync(ctx: SyncContext): AsyncGenerator<SourcePage<TCursor>>;
  incrementalSync(checkpoint, ctx): AsyncGenerator<SourcePage<TCursor>>;
  isStaleCursorError(error): boolean;
  normalize(raw): NormalizedRecord;
}
```

**Per-Source Implementations**:

#### HubSpot Adapter
- **Full sync**: Paginated API with large offset support
- **Incremental sync**: Watermark-based with overlap to handle deletes
- **Normalization**: Contact → Person, Deal → (future), Company → (future)
- **Stale cursor**: Detects when watermark is too old, triggers full resync

#### Stripe Adapter
- **Full sync**: Customer pagination + Payment intent/charge pagination
- **Incremental sync**: Event stream (webhook-driven or polling)
- **Normalization**: Customer → Person, Charge → Payment
- **Idempotent keys**: Built into Stripe API

#### Google Calendar Adapter
- **Full sync**: Calendar list + Event list with minimal fields
- **Incremental sync**: syncToken-based (efficiency, less bandwidth)
- **Normalization**: CalendarEvent → CalendarEvent
- **Stale token**: 410 Gone fallback to full resync
- **OAuth refresh**: Automatic token refresh via Google client

### 5. Error Classification

**Location**: `src/sync/error-classifier.ts`

**Classification Strategy**:
```
┌─ HTTP Errors
│  ├─ 4xx: PERMANENT (400, 404) → don't retry
│  ├─ 401/403: AUTH_FAILURE → requires intervention
│  ├─ 429: RATE_LIMITED → retry with backoff
│  ├─ 5xx: RETRYABLE (500, 502, 503, 504) → retry
│  └─ 410: STALE_CURSOR → full resync
├─ Network Errors
│  ├─ Timeout: RETRYABLE
│  ├─ ECONNREFUSED: RETRYABLE
│  ├─ ENOTFOUND: RETRYABLE
│  └─ ECONNRESET: RETRYABLE
├─ Parsing Errors
│  └─ PERMANENT (malformed JSON)
└─ Validation Errors
   └─ PERMANENT (schema mismatch)
```

**Benefits**:
- Prevents wasting retries on permanent failures
- Differentiates auth issues from transient errors
- Handles stale cursors specially

### 6. Retry Logic

**Location**: `src/sync/retry.ts`

**Algorithm**: Exponential backoff with jitter
```
Attempt 1: immediate
Attempt 2: base_delay * 2^1 + jitter
Attempt 3: base_delay * 2^2 + jitter
...
Attempt N: MIN(max_delay, base_delay * 2^N + jitter)
```

**Default Configuration**:
```typescript
{
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitterFactor: 0.1,
}
```

**Transient Error Retry**: Errors classified as RETRYABLE (network, timeouts, 5xx)

**Permanent Error**: Errors classified as PERMANENT (4xx, parsing, validation) - no retry

### 7. Idempotent Writer

**Location**: `src/sync/idempotent-writer.ts`

**Algorithm**: Hash-based change detection

```typescript
// Step 1: Compute hash of record content
const hash = SHA256(JSON.stringify(normalizedData));

// Step 2: Query ExternalRecord for existing record
const existing = await repo.getExternalRecord(connectionId, type, externalId);

// Step 3: Compare hashes
if (existing && existing.hash === hash) {
  // No change - skip
  return { skipped: true };
}

// Step 4: Write or update
await repo.upsertExternalRecord({
  ...data,
  hash,
});
```

**Benefits**:
- Detects duplicates without fetching full record
- Handles updates (same ID, different content)
- Prevents database churn
- Works across multiple adapters

### 8. Checkpoint Management

**Location**: Database repositories

**Full Sync Checkpoints**:
- Tracks when full sync last completed
- Used to determine if full resync needed
- Persisted after successful completion

**Incremental Sync Checkpoints**:
- Cursor: Pointer to next page/time
- Watermark: Timestamp of last processed record
- Overlap: For handling deletes (HubSpot)

**Stale Cursor Detection**:
- Adapter returns true from `isStaleCursorError()`
- Orchestrator discards checkpoint
- Next sync triggers full resync

### 9. Database Layer

**Location**: `src/db/repositories/`

**Design Pattern**: Typed repositories for each entity
```typescript
class SyncRunRepository {
  async createSyncRun(...): Promise<SyncRun>
  async getSyncRun(id): Promise<SyncRun>
  async getRecentSyncRuns(limit): Promise<SyncRun[]>
  async updateSyncRunStatus(id, status): Promise<void>
}
```

**Benefits**:
- Type-safe database operations
- Encapsulated queries
- Easy to test
- Centralized error handling

**Schema**:
- SourceConnection: Credentials (encrypted)
- SyncCheckpoint: Cursor/watermark state
- SyncRun: Overall sync execution
- SourceSyncRun: Per-source execution
- ExternalRecord: External ID → Normalized ID mapping
- Normalized tables: Person, Payment, CalendarEvent
- ProcessedWebhookEvent: Webhook deduplication
- FailedRecord: Failed records for manual intervention

### 10. Middleware

**Location**: `src/middleware/`

**Rate Limiting**:
- Sliding window algorithm
- Per-IP enforcement
- In-memory store with cleanup
- 100 req/min default

**Request Validation**:
- Zod schema validation
- Pre-handler middleware
- Detailed error messages

**Security Headers**:
- HSTS: Force HTTPS
- CSP: Content Security Policy
- X-Frame-Options: Prevent clickjacking
- X-Content-Type-Options: Prevent MIME sniffing

**Error Handler**:
- Global error handler
- HTTP status code mapping
- Structured error responses
- Request ID tracking

## Data Flow: Sync Lifecycle

### 1. Trigger
```
POST /api/v1/sync
↓
AdminAuthGuard validates token
↓
RateLimitHandler checks limit
↓
SyncOrchestrator.triggerSync(connectionIds)
```

### 2. Initialization
```
Create SyncRun record (status: IN_PROGRESS)
Create SourceSyncRun for each source (status: PENDING)
Retrieve checkpoints for each source
```

### 3. Execution (Parallel)
```
Promise.allSettled([
  executeHubSpotSync(),
  executeStripeSync(),
  executeGoogleCalendarSync()
])
```

### 4. Per-Source Execution
```
FOR EACH source:
  1. Determine sync mode (FULL or INCREMENTAL)
  2. Call adapter.fullSync() or .incrementalSync()
  3. FOR EACH page of records:
     a. Normalize records
     b. Call IdempotentWriter.write()
     c. Handle failures → FailedRecord
  4. Update checkpoint
  5. Update SourceSyncRun status
```

### 5. Error Handling
```
IF error occurs:
  1. ErrorClassifier.classifyError()
  2. IF RETRYABLE:
     a. RetryLogic.calculateBackoff()
     b. Wait and retry
  3. IF PERMANENT or exhausted retries:
     a. Log to SourceSyncRun
     b. Record in FailedRecord
     c. Continue with next source
```

### 6. Completion
```
Wait for all sources to complete (via Promise.allSettled)
Aggregate results into SyncRun.summary
Update SyncRun status to COMPLETED/FAILED
Log final summary
```

## Failure Modes & Recovery

### Network Timeout
```
ErrorClassifier → RETRYABLE
RetryLogic → exponential backoff
Result: Retries up to 3x, then fails if persistent
```

### Rate Limited (429)
```
ErrorClassifier → RATE_LIMITED
RetryLogic → exponential backoff (longer delay)
Result: Eventually succeeds or times out
```

### Auth Failure (401)
```
ErrorClassifier → AUTH_FAILURE
RetryLogic → does NOT retry
Result: Fails immediately, requires credential update
```

### Stale Cursor (410)
```
ErrorClassifier → STALE_CURSOR
Adapter → isStaleCursorError() returns true
Orchestrator → discards checkpoint
Result: Next sync triggers full resync
```

### Database Connection
```
HealthCheck → 503 Service Unavailable
Readiness probe → false
Load balancer → stops routing traffic
Result: Manual intervention required
```

## Performance Characteristics

### Latency
- Cold start: ~300ms (Node + TypeScript)
- Rate limiter: <1ms per request
- Health check: <5ms
- Sync trigger: <200ms (returns 202 Accepted)

### Concurrency
- All sources sync in parallel (3x faster than serial)
- Database connections: Prisma pool (default 5)
- Memory: Streaming pages (not loading all records)

### Scalability Limitations
- Single instance (no clustering yet)
- In-memory rate limiter (resets on restart)
- Database throughput (depends on PostgreSQL)
- Network bandwidth (depends on source APIs)

## Security Design

### Authentication
- Bearer token in Authorization header
- Constant-time comparison to prevent timing attacks
- Token should be 32+ random bytes

### Authorization
- Admin guard on sensitive operations
- Role-based access control (future)

### Data Protection
- Credentials encrypted at rest (future)
- Secrets from environment variables (not hardcoded)
- Structured logging with redaction
- No sensitive data in error messages

### Network
- HTTPS only (enforced in production)
- Security headers (HSTS, CSP, etc.)
- Rate limiting (prevent brute force/DDoS)
- Request validation (prevent injection)

## Testing Strategy

### Unit Tests (51 total)
- Error Classifier (33 tests): All error types, retry logic
- Rate Limiter (18 tests): Sliding window, per-IP isolation

### Integration Tests (future)
- End-to-end sync with mock sources
- Database transaction handling
- Webhook processing
- Concurrent sync runs

### Performance Tests (future)
- Sync throughput (records/sec)
- Memory usage (large page sizes)
- Database query performance

## Deployment Architecture

### Local Development
```
ts-node src/server.ts
PostgreSQL on localhost:5432
```

### Docker
```
Dockerfile (multi-stage build)
docker-compose.yml (with PostgreSQL service)
```

### Cloud (Render)
```
Web service on Render Free tier
PostgreSQL on Render or external
Auto-deploy on git push
```

## Future Enhancements

### Phase 12 (Webhooks)
- Receive real-time updates from sources
- Webhook signature verification
- Event queuing (SQS/RabbitMQ)

### Phase 13 (Clustering)
- Horizontal scaling (multiple instances)
- Distributed rate limiting (Redis)
- Session/state management

### Phase 14 (Analytics)
- Sync metrics and dashboards
- Performance monitoring
- Cost tracking

### Phase 15 (Advanced Sync)
- Bi-directional sync
- Conflict resolution
- Change data capture

## References

- **Error Handling**: src/sync/error-classifier.ts
- **Retry Logic**: src/sync/retry.ts
- **Adapters**: src/sync/adapters/
- **Database**: src/db/repositories/
- **Middleware**: src/middleware/
- **Tests**: tests/unit/
