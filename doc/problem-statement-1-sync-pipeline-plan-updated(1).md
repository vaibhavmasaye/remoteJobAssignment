# Problem Statement 1 — Reliable Multi-Source Sync Pipeline Plan (Updated)

> **Companion files**
> - `sync-pipeline-project-status.md` — live checklist and progress tracker.
> - `.env.example` — environment variables template with safe placeholders.
>
> Update the status tracker during implementation. Never place real credentials in any committed file.

## 1. Assignment Interpretation

This submission addresses **Problem Statement 1 only**: build a backend-focused synchronization pipeline that imports records from three external systems into a normalized database without silently losing, duplicating, or corrupting data.

The three selected sources are:

1. **HubSpot CRM** — contacts and optionally companies/deals.
2. **Stripe Test Mode** — customers, payments/payment intents, and related payment events.
3. **Google Calendar API** — calendar events.

There is no UI requirement. The solution will expose a small REST API for triggering and inspecting sync runs, plus webhook endpoints for supported sources. All endpoints can be demonstrated through curl or Postman.

---

## 2. Primary Goals

The implementation must prove the following properties:

- **No duplicate normalized rows** when a webhook is delivered more than once.
- **No duplicate rows** when a sync is run repeatedly with no source changes.
- **No silent data loss** when an incremental cursor becomes invalid or expires.
- **Source isolation:** a failure in one integration must not stop the remaining sources.
- **Atomic checkpoint advancement:** a source checkpoint is never moved forward unless its corresponding data has been committed successfully.
- **Recoverability:** failed records and failed source runs can be retried safely.
- **Traceability:** every normalized record can be traced back to its source and external identifier.
- **Security:** secrets, webhook endpoints, administrative operations, logs, and stored personal data receive appropriate protection.

---

## 3. Prerequisites Before Development

Complete this checklist before implementing adapters or deploying the service. Keep production secrets only in Render environment variables or a local `.env` file that is excluded from Git.

### 3.1 Local Development Tools

- [ ] Git installed and authenticated with GitHub.
- [ ] Node.js 22 LTS and npm installed.
- [ ] Docker Desktop installed for local PostgreSQL and integration tests.
- [ ] PostgreSQL client such as `psql`, DBeaver, or TablePlus available.
- [ ] Postman or curl available for endpoint and webhook testing.
- [ ] A screen recorder available for the five-minute demo.
- [ ] Optional: Render CLI and GitHub CLI installed.

### 3.2 Required Accounts

- [ ] GitHub account and public repository created.
- [ ] Render account created.
- [ ] Render Free PostgreSQL database created.
- [ ] Render Web Service created or ready to create from the GitHub repository.
- [ ] HubSpot developer account and test account created.
- [ ] Stripe account with test mode enabled.
- [ ] Google Cloud project created.
- [ ] Google Calendar API enabled in the Google Cloud project.
- [ ] OAuth consent screen configured for Google Calendar access.

### 3.3 Database Information

Collect these values from the Render PostgreSQL dashboard. Do not paste real values into the repository or README.

| Item | Required value | Where it is used | Status |
|---|---|---|---|
| Internal database URL | `DATABASE_URL` | Render Web Service and Prisma runtime | ⬜ |
| Direct database URL | `DIRECT_URL` | Prisma migrations, when needed | ⬜ |
| Database host | Render-generated host | Manual troubleshooting only | ⬜ |
| Database name | Render-generated database name | Manual troubleshooting only | ⬜ |
| Database user | Render-generated user | Manual troubleshooting only | ⬜ |
| Database password | Render-generated password | Secret; never commit | ⬜ |
| SSL requirement | Usually enabled for external access | PostgreSQL connection configuration | ⬜ |

Recommended local `.env` placeholders:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
DIRECT_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
DB_SSL=true
```

### 3.4 HubSpot Prerequisites

- [ ] Create and seed at least five sample contacts.
- [ ] Create a HubSpot private app for API access.
- [ ] Grant only the minimum CRM scopes needed for contacts.
- [ ] Save the private-app access token securely.
- [ ] Record the HubSpot account or portal ID.
- [ ] Configure webhook subscriptions if webhooks are included in the demo.
- [ ] Record the webhook signing secret or application secret needed for signature verification.

```env
HUBSPOT_ACCESS_TOKEN=<secret>
HUBSPOT_PORTAL_ID=<portal-id>
HUBSPOT_CLIENT_SECRET=<secret-for-webhook-validation>
```

### 3.5 Stripe Test-Mode Prerequisites

- [ ] Enable Stripe test mode.
- [ ] Create at least five test customers.
- [ ] Create several test PaymentIntents or charges, including successful and failed examples.
- [ ] Save the test secret key.
- [ ] Create a webhook endpoint after the Render URL is available.
- [ ] Save the endpoint signing secret.
- [ ] Install Stripe CLI locally if local webhook forwarding will be demonstrated.

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 3.6 Google Calendar Prerequisites

- [ ] Enable the Google Calendar API.
- [ ] Create OAuth 2.0 credentials for a web application.
- [ ] Add the local OAuth redirect URI.
- [ ] Add the deployed Render OAuth redirect URI.
- [ ] Create or select a dedicated test calendar.
- [ ] Seed at least five events, including an updated and a cancelled event.
- [ ] Complete OAuth once and securely store the refresh token.
- [ ] Record the calendar ID.

```env
GOOGLE_CLIENT_ID=<oauth-client-id>
GOOGLE_CLIENT_SECRET=<oauth-client-secret>
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
GOOGLE_REFRESH_TOKEN=<secret>
GOOGLE_CALENDAR_ID=<calendar-id-or-primary>
GOOGLE_WEBHOOK_TOKEN=<random-secret>
```

### 3.7 Application and Security Secrets

Generate independent, high-entropy values. Never reuse account passwords.

```env
ADMIN_API_KEY=<minimum-32-random-bytes>
CREDENTIAL_ENCRYPTION_KEY=<32-byte-encryption-key>
LOG_LEVEL=info
SYNC_PAGE_SIZE=50
SYNC_MAX_RETRIES=3
SYNC_REQUEST_TIMEOUT_MS=10000
APP_BASE_URL=http://localhost:3000
```

- [ ] Generate the admin API key.
- [ ] Generate the credential-encryption key.
- [ ] Add `.env`, logs, exports, and local database files to `.gitignore`.
- [ ] Add an `.env.example` containing placeholders only.
- [ ] Confirm logs redact authorisation headers, API keys, tokens, cookies, and database URLs.

### 3.8 URLs Needed During Deployment

Replace `<service-name>` after Render creates the public service URL.

| Purpose | URL |
|---|---|
| Base API | `https://<service-name>.onrender.com` |
| Health check | `https://<service-name>.onrender.com/health` |
| Readiness check | `https://<service-name>.onrender.com/ready` |
| Swagger docs | `https://<service-name>.onrender.com/docs` |
| Manual sync | `POST https://<service-name>.onrender.com/api/v1/sync-runs` |
| Sync-run status | `GET https://<service-name>.onrender.com/api/v1/sync-runs/:id` |
| HubSpot webhook | `POST https://<service-name>.onrender.com/webhooks/hubspot` |
| Stripe webhook | `POST https://<service-name>.onrender.com/webhooks/stripe` |
| Google notification | `POST https://<service-name>.onrender.com/webhooks/google-calendar` |
| Google OAuth callback | `https://<service-name>.onrender.com/auth/google/callback` |

### 3.9 Start-Gate Checklist

Development can begin when all mandatory items below are available:

- [ ] Render `DATABASE_URL` works from the application.
- [ ] HubSpot access token can list seeded contacts.
- [ ] Stripe test key can list seeded customers or PaymentIntents.
- [ ] Google OAuth refresh token can list seeded calendar events.
- [ ] All secrets are stored outside Git.
- [ ] Public GitHub repository exists.
- [ ] Local tests can connect to a disposable PostgreSQL database.

---

## 4. Proposed Technology Stack

### Application

| Area | Technology | Reason |
|---|---|---|
| Runtime | Node.js 22 LTS | Strong API ecosystem and quick integration development |
| Language | TypeScript | Compile-time validation and safer source adapters |
| Framework | Fastify | Lightweight, fast, schema-driven validation and structured logging |
| Validation | Zod | Runtime validation of untrusted third-party payloads |
| HTTP Client | Undici / native `fetch` | Modern HTTP client with timeout and abort support |
| ORM | Prisma | Database migrations, transactions, unique constraints, typed queries |
| Database | Render Free PostgreSQL | Managed PostgreSQL on the same deployment platform; supports transactions, constraints, JSONB, locks, and reliable upserts |
| Logging | Pino | Structured JSON logs compatible with Render logs |
| Retry | Custom exponential backoff with jitter | Fine control over retryable and permanent failures |
| API Docs | OpenAPI / Swagger | Easy evaluator testing of live endpoints |
| Testing | Vitest + Testcontainers or local PostgreSQL | Unit and integration testing |
| Mocking | MSW or Nock | Simulate stale cursors, malformed payloads, timeouts, and 5xx responses |
| Deployment | Render free Web Service | Required live deployment target |
| Source Control | GitHub Actions | Run lint, type-check, tests, and Prisma validation on each push |

### External Sources

| Source | Account mode | Main objects |
|---|---|---|
| HubSpot | Free developer/test account | Contacts |
| Stripe | Free test mode | Customers, PaymentIntents/Charges, Events |
| Google Calendar | Free Google Cloud project | Calendar Events |

### Why PostgreSQL Instead of an In-Memory or Local Database

A local SQLite file or in-memory database would be unsafe on Render because the web-service filesystem must not be treated as durable application storage. This implementation will use a **Render Free PostgreSQL** database. PostgreSQL provides durable relational storage, unique indexes, transactions, row-level locking, advisory locks, JSONB, and atomic checkpoint updates. The application and database will both be hosted on Render, and the application will connect using Render's database connection URL supplied through environment variables. No Neon, Supabase, local database file, or in-memory production database is required.


### Render PostgreSQL Configuration

Use one Render PostgreSQL database for normalized records, raw payload envelopes, webhook receipts, sync checkpoints, sync runs, and dead-letter records.

Recommended environment configuration:

```env
DATABASE_URL=<Render internal PostgreSQL URL>
DIRECT_URL=<Render internal PostgreSQL URL>
DB_SSL=true
```

Operational rules:

- Use the **internal** Render database URL when the web service and database are in the same Render region.
- Use Prisma migrations rather than `prisma db push` for the deployed environment.
- Run `prisma migrate deploy` during the release/build workflow.
- Keep connection pooling conservative because a free database has limited resources.
- Set a connection timeout and fail health/readiness checks when the database is unavailable.
- Never log `DATABASE_URL`, credentials, OAuth tokens, or complete third-party payloads.
- Backfill in small pages and short transactions to reduce database pressure.
- Store all cursors and checkpoints in PostgreSQL, never only in application memory.

---

## 5. High-Level Architecture

```mermaid
flowchart LR
    subgraph External[External Systems]
        HS[HubSpot CRM]
        ST[Stripe Test Mode]
        GC[Google Calendar]
    end

    subgraph Render[Render Web Service]
        API[Fastify API]
        AUTH[Admin API Authentication]
        ORCH[Sync Orchestrator]
        HSA[HubSpot Adapter]
        STA[Stripe Adapter]
        GCA[Google Calendar Adapter]
        VAL[Validation and Normalization]
        WR[Idempotent Writer]
        WH[Webhook Handlers]
        OBS[Logs and Health Metrics]
    end

    DB[(Render Free PostgreSQL)]
    DLQ[(Dead Letter / Failed Items)]

    HS -->|Incremental / Full API| HSA
    ST -->|Incremental / Full API| STA
    GC -->|syncToken / Full API| GCA

    HS -->|Signed Webhook| WH
    ST -->|Signed Webhook| WH
    GC -->|Push Notification| WH

    API --> AUTH --> ORCH
    WH --> ORCH
    ORCH --> HSA
    ORCH --> STA
    ORCH --> GCA

    HSA --> VAL
    STA --> VAL
    GCA --> VAL
    VAL --> WR
    WR -->|Transaction + Upsert| DB
    VAL -->|Invalid record| DLQ
    ORCH --> OBS
    WR --> OBS
```

---

## 6. Correctness Model

The pipeline provides **at-least-once ingestion with idempotent writes**, producing an effectively-once final database state for each source object version.

Exactly-once delivery cannot be guaranteed across independent external APIs, networks, and webhook systems. Instead, correctness is achieved through:

1. Stable source identity: `source + external_object_type + external_id`.
2. Database unique constraints.
3. Transactional upserts.
4. Webhook event deduplication.
5. Checkpoints advanced only after successful commits.
6. Scheduled reconciliation to recover missed or delayed webhooks.
7. Source-specific failure boundaries.
8. Full backfill when an incremental token is rejected or invalidated.

---

## 7. Normalized Data Model

The three sources represent different business concepts. Forcing every field into one flat table would create a weak schema. The recommended model uses a shared normalized envelope plus type-specific tables.

### 6.1 `source_connections`

Stores one logical connection per source.

```text
id UUID PK
source ENUM('hubspot', 'stripe', 'google_calendar')
account_external_id TEXT NULL
status ENUM('active', 'degraded', 'disabled', 'auth_required')
encrypted_credentials JSONB
last_success_at TIMESTAMPTZ NULL
last_error_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
UNIQUE(source, account_external_id)
```

### 6.2 `sync_checkpoints`

```text
id UUID PK
connection_id UUID FK
object_type TEXT
cursor TEXT NULL
watermark TIMESTAMPTZ NULL
cursor_version INTEGER DEFAULT 1
last_full_sync_at TIMESTAMPTZ NULL
last_incremental_sync_at TIMESTAMPTZ NULL
updated_at TIMESTAMPTZ
UNIQUE(connection_id, object_type)
```

A source can use either `cursor`, `watermark`, or both. The checkpoint row is locked during a source sync to prevent two workers from racing.

### 6.3 `sync_runs`

```text
id UUID PK
trigger_type ENUM('manual', 'scheduled', 'webhook', 'recovery')
status ENUM('running', 'partial_success', 'success', 'failed')
started_at TIMESTAMPTZ
finished_at TIMESTAMPTZ NULL
requested_by TEXT NULL
correlation_id TEXT
summary JSONB
```

### 6.4 `source_sync_runs`

One child record per source in a parent run.

```text
id UUID PK
sync_run_id UUID FK
connection_id UUID FK
source TEXT
mode ENUM('incremental', 'full', 'webhook_reconcile')
status ENUM('running', 'success', 'failed', 'skipped', 'fallback_full')
records_seen INTEGER DEFAULT 0
records_written INTEGER DEFAULT 0
records_skipped INTEGER DEFAULT 0
records_failed INTEGER DEFAULT 0
cursor_before TEXT NULL
cursor_after TEXT NULL
error_code TEXT NULL
error_message TEXT NULL
started_at TIMESTAMPTZ
finished_at TIMESTAMPTZ NULL
```

### 6.5 `external_records`

Canonical identity and source traceability.

```text
id UUID PK
connection_id UUID FK
source TEXT
external_object_type TEXT
external_id TEXT
external_version TEXT NULL
source_updated_at TIMESTAMPTZ NULL
normalized_type ENUM('person', 'payment', 'calendar_event')
normalized_id UUID
is_deleted BOOLEAN DEFAULT FALSE
raw_payload JSONB
payload_hash TEXT
first_seen_at TIMESTAMPTZ
last_seen_at TIMESTAMPTZ
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
UNIQUE(connection_id, external_object_type, external_id)
```

### 6.6 `people`

```text
id UUID PK
full_name TEXT NULL
first_name TEXT NULL
last_name TEXT NULL
email TEXT NULL
phone TEXT NULL
company_name TEXT NULL
status TEXT NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

HubSpot contacts and Stripe customers may both map to people, but they remain separate normalized records unless deterministic identity-linking is explicitly implemented. Automatically merging people only by email is risky and is outside the minimum assignment scope.

### 6.7 `payments`

```text
id UUID PK
customer_external_id TEXT NULL
amount_minor BIGINT
currency CHAR(3)
status TEXT
payment_method_type TEXT NULL
paid_at TIMESTAMPTZ NULL
refunded_amount_minor BIGINT DEFAULT 0
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Money is stored in the smallest currency unit to avoid floating-point errors.

### 6.8 `calendar_events`

```text
id UUID PK
calendar_external_id TEXT
summary TEXT NULL
description TEXT NULL
start_at TIMESTAMPTZ NULL
end_at TIMESTAMPTZ NULL
is_all_day BOOLEAN DEFAULT FALSE
timezone TEXT NULL
status TEXT
organizer_email TEXT NULL
attendees JSONB
recurring_event_external_id TEXT NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### 6.9 `processed_webhook_events`

```text
id UUID PK
source TEXT
external_event_id TEXT
payload_hash TEXT
received_at TIMESTAMPTZ
processed_at TIMESTAMPTZ NULL
status ENUM('received', 'processed', 'failed', 'ignored')
retry_count INTEGER DEFAULT 0
last_error TEXT NULL
UNIQUE(source, external_event_id)
```

For sources without a stable webhook event ID, use a deterministic hash of selected immutable event fields and the raw body.

### 6.10 `failed_records`

```text
id UUID PK
source_sync_run_id UUID FK
source TEXT
external_object_type TEXT NULL
external_id TEXT NULL
stage ENUM('fetch', 'validate', 'normalize', 'write')
error_code TEXT
error_message TEXT
raw_payload JSONB NULL
retryable BOOLEAN
retry_count INTEGER DEFAULT 0
next_retry_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ NULL
```

---

## 8. Example Source-to-Normalized Mapping

| Normalized field | HubSpot | Stripe | Google Calendar |
|---|---|---|---|
| External ID | `contact.id` | `customer.id`, `payment_intent.id` | `event.id` |
| Updated time | `updatedAt` / last modified property | Event/object timestamp where available | `event.updated` |
| Person email | `properties.email` | `customer.email` | Organizer/attendee email, not auto-merged |
| Name | firstname + lastname | customer.name | event summary is not a person name |
| Payment amount | N/A | `amount` minor units | N/A |
| Event start | N/A | N/A | `start.dateTime` or `start.date` |
| Event end | N/A | N/A | `end.dateTime` or `end.date` |
| Deleted state | Archived/deleted event or reconciliation | deletion event / deleted object where applicable | `status = cancelled` with deleted events included |
| Raw source | full response object | full response object | full response object |

---

## 9. Sync Orchestration Design

### 8.1 Parent Run

`POST /api/v1/sync` creates a parent `sync_runs` row and starts three independent source tasks using `Promise.allSettled`, not `Promise.all`.

```ts
const results = await Promise.allSettled([
  syncHubSpot(runId),
  syncStripe(runId),
  syncGoogleCalendar(runId),
]);
```

The final run status is:

- `success`: all enabled sources succeeded.
- `partial_success`: at least one source succeeded and at least one failed.
- `failed`: every enabled source failed.

One failed source never prevents commits from successful sources.

### 8.2 Per-Source Lock

Before a source sync begins:

1. Start a database transaction.
2. Lock its checkpoint row using `SELECT ... FOR UPDATE` or acquire a PostgreSQL advisory lock.
3. If another run owns the lock, mark this source as `skipped` or return `409 SOURCE_SYNC_ALREADY_RUNNING`.
4. Release the lock after completion or failure.

This prevents simultaneous manual, scheduled, and webhook-triggered reconciliation runs from corrupting checkpoints.

### 8.3 Page-Level Processing

For each API page:

1. Fetch page with timeout.
2. Validate top-level response.
3. Validate each record independently.
4. Normalize valid records.
5. Write a page in one database transaction.
6. Record invalid individual records in `failed_records` without discarding valid siblings.
7. Continue to the next page.
8. Save only a **safe resumable page cursor** after that page commits.
9. Publish the final incremental checkpoint only after all pages succeed.

A conservative implementation may keep a temporary page-resume cursor inside the source run but retain the previous official checkpoint until the whole run is successful. Reprocessing already committed pages is harmless because writes are idempotent.

---

## 10. Incremental and Full Sync Strategy by Source

## 10.1 HubSpot CRM

### Full Sync

- List all contacts using cursor pagination.
- Request only required properties plus source update timestamps.
- Follow `paging.next.after` until exhausted.
- Upsert each contact using `(connection_id, 'contact', hubspot_contact_id)`.
- Optionally request archived contacts separately or process deletion webhooks.

### Incremental Sync

Use HubSpot CRM search filtered and sorted by an update timestamp. Store a high-watermark consisting of:

```text
last_modified_timestamp + last_external_id_at_same_timestamp
```

A timestamp alone is unsafe because multiple contacts may share the same modification time. The query should use a small overlap window, for example re-fetch the previous 2–5 minutes, then rely on idempotent upserts. The overlap protects against clock precision, eventual consistency, and late indexing.

### HubSpot Cursor Rejection

HubSpot pagination cursors are generally page cursors rather than durable long-term sync tokens. If a saved pagination cursor is rejected, malformed, or inconsistent:

1. Mark the incremental attempt as failed/fallback.
2. Do not advance the prior checkpoint.
3. Start a full HubSpot backfill from page one.
4. Upsert all rows.
5. Rebuild a valid high-watermark from the successfully completed full sync.

### HubSpot Webhooks

Webhooks act as a hint, not the only source of truth. A webhook handler:

1. Verifies HubSpot signature and timestamp.
2. Deduplicates the webhook event.
3. Quickly stores the event and returns `2xx`.
4. Fetches the current contact by ID.
5. Upserts it.
6. Leaves scheduled reconciliation enabled to catch missed deliveries.

---

## 10.2 Stripe Test Mode

### Full Sync

- List customers and PaymentIntents or Charges using `starting_after` pagination.
- Continue while `has_more` is true.
- Upsert each object by its Stripe ID.
- Store amount in minor units and currency in lowercase or uppercase consistently.

### Incremental Sync

Stripe Events provide a practical incremental change feed. Store the last safely processed event creation time and event ID tie-breaker. Query events after the watermark, page through them, and fetch the latest object when necessary.

A periodic bounded reconciliation should also list recently updated/relevant payment objects because webhook/event delivery should not be treated as the only correctness mechanism.

### Stripe Cursor Rejection or Missing History

If the saved event cursor no longer works, history is unavailable, or the incremental query is inconsistent:

1. Keep the old checkpoint unchanged.
2. Run a full list of customers and payments.
3. Upsert all objects.
4. Set a new event watermark at a safe point captured at full-sync start/end.
5. Run a short overlap reconciliation after the backfill to close the race window.

### Stripe Webhooks

- Verify `Stripe-Signature` using the endpoint secret and the exact raw request body.
- Deduplicate using Stripe `event.id`.
- Return quickly after durable receipt.
- Handle event ordering as non-guaranteed: fetch the latest source object instead of assuming webhook arrival order equals object version order.

---

## 10.3 Google Calendar

### Full Sync

- Call `events.list` for a selected calendar.
- Set `showDeleted=true` so cancellations/deletions can be represented.
- Follow page tokens.
- Store the final `nextSyncToken` only after every page has been committed.

### Incremental Sync

- Call `events.list` using the stored `syncToken`.
- Use the same relevant query settings as the initial full sync.
- Process changed and deleted events.
- Follow page tokens.
- Replace the stored token only with the final `nextSyncToken` after successful completion.

### Google `410 Gone`

Google explicitly requires a full resynchronization when a sync token is invalidated:

1. Catch `410 Gone` as a known stale-token condition.
2. Mark the source run as `fallback_full` rather than an unclassified crash.
3. Clear or supersede the invalid token inside a controlled transaction.
4. Run a new full sync.
5. Upsert current events and mark records no longer present appropriately.
6. Store the new final `nextSyncToken` only after the full sync commits.

Do not blindly delete the local event table before the replacement full sync succeeds. A safer implementation uses a **generation marker**:

- Start full sync with `generation_id`.
- Mark every seen event with that generation.
- After successful completion, mark older unseen records as deleted/cancelled.
- If the full sync fails, the prior local state remains available.

### Google Push Notifications

Calendar push notifications usually indicate that something changed; they are not a complete record payload. On receipt, trigger an incremental sync using the stored sync token. Validate channel/resource identifiers and maintain channel expiration/renewal.

---

## 11. Idempotent Write Algorithm

For every normalized record:

1. Compute stable key: `(connection_id, external_object_type, external_id)`.
2. Compute `payload_hash` from a canonical JSON representation.
3. Begin transaction.
4. Insert or update the type-specific normalized row.
5. Upsert `external_records` using the stable unique key.
6. Reject an older update when `source_updated_at` is earlier than the stored source version, unless processing an authoritative full reconciliation.
7. If hash and version are unchanged, update only `last_seen_at` or perform no write.
8. Commit.

Example SQL concept:

```sql
INSERT INTO external_records (...)
VALUES (...)
ON CONFLICT (connection_id, external_object_type, external_id)
DO UPDATE SET
  source_updated_at = EXCLUDED.source_updated_at,
  payload_hash = EXCLUDED.payload_hash,
  raw_payload = EXCLUDED.raw_payload,
  is_deleted = EXCLUDED.is_deleted,
  last_seen_at = now(),
  updated_at = now()
WHERE
  external_records.source_updated_at IS NULL
  OR EXCLUDED.source_updated_at IS NULL
  OR EXCLUDED.source_updated_at >= external_records.source_updated_at;
```

The database constraint, not application memory, is the final deduplication authority.

---

## 12. Failure Handling Strategy

### Retryable Failures

Retry with exponential backoff and jitter for:

- HTTP 408, 425, 429.
- HTTP 500, 502, 503, 504.
- Connection resets.
- DNS/transient network errors.
- Request timeouts.

Rules:

- Respect `Retry-After` when present.
- Maximum attempts per request, for example 4.
- Bound total source sync time.
- Do not retry permanent validation or authentication failures indefinitely.

### Permanent or Operator-Action Failures

Do not automatically retry repeatedly for:

- HTTP 400 caused by a bad request.
- HTTP 401/403 due to revoked or missing credentials.
- Invalid webhook signature.
- Unsupported source schema.
- Record that repeatedly fails schema validation.

Mark the connection `auth_required` for credential failures and expose the reason in the run status without exposing secret values.

### Poison Records

A malformed record must not block its page or its source:

- Validate records individually.
- Store invalid payload safely in `failed_records` with sensitive fields redacted where appropriate.
- Continue processing valid records.
- Mark source run `success_with_record_errors` through metrics/summary, or `partial_success` at the source level if desired.

### Source Circuit Breaker

Optional high-level resilience:

- Open circuit after repeated failures for one source.
- Skip that source temporarily while other sources continue.
- Allow a manual probe or automatic half-open retry.

For the assignment, a simple per-run isolation plus bounded retry is sufficient; a circuit breaker can be documented as an extension.

---

## 13. API Design

### Public Operational Endpoints

```text
GET  /health/live
GET  /health/ready
GET  /api/v1/status
```

### Protected Administrative Endpoints

```text
POST /api/v1/sync
POST /api/v1/sync/:source
GET  /api/v1/sync-runs
GET  /api/v1/sync-runs/:runId
POST /api/v1/sync-runs/:runId/retry-failures
GET  /api/v1/records?source=&type=&externalId=
```

Example trigger:

```bash
curl -X POST "https://<render-service>/api/v1/sync" \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  -H "Idempotency-Key: demo-run-001"
```

`Idempotency-Key` prevents an evaluator from accidentally launching duplicate manual runs. A unique database constraint can map the key to the first run response.

### Webhook Endpoints

```text
POST /webhooks/hubspot
POST /webhooks/stripe
POST /webhooks/google-calendar
```

Webhook routes must use raw-body access where signature validation requires it.

### Demo-Only Failure Injection

A protected endpoint or environment-controlled mode can make edge cases repeatable:

```text
POST /api/v1/demo/failures/google-calendar/stale-token
POST /api/v1/demo/failures/stripe/duplicate-webhook
POST /api/v1/demo/failures/hubspot/malformed-record
POST /api/v1/demo/failures/:source/unavailable
```

These endpoints must be disabled outside demo mode and protected by the admin token.

---

## 14. Security Design

## 14.1 Secrets and Credentials

- Store API keys, OAuth client secrets, refresh tokens, webhook secrets, database URL, and admin token only in Render environment variables or an external secret manager.
- Never commit `.env` files.
- Include `.env.example` with placeholders.
- Encrypt OAuth refresh/access tokens before storing them in PostgreSQL. Use AES-256-GCM with a separate encryption key from environment configuration.
- Do not log tokens, Authorization headers, cookies, raw secret-bearing URLs, or webhook signatures.
- Rotate credentials after the demo if they appear in video or logs.

## 14.2 Authentication and Authorisation

- Require a high-entropy bearer token for manual sync and inspection endpoints.
- Keep health endpoints minimal and free of sensitive diagnostics.
- Apply route-level allow-lists so demo failure endpoints are available only when `DEMO_MODE=true`.
- For a larger system, replace the single admin token with OAuth/JWT and RBAC.

## 14.3 Webhook Security

- HubSpot: verify the appropriate HubSpot signature version, timestamp freshness, and use constant-time comparison.
- Stripe: verify `Stripe-Signature` against the exact raw body and endpoint signing secret.
- Google Calendar: verify expected channel token, channel ID, and resource ID; do not trust notification headers alone to contain record data.
- Enforce HTTPS.
- Reject stale replayed requests.
- Persist event IDs for replay/deduplication defence.
- Return generic errors without exposing internal details.

## 14.4 Input and Data Security

- Treat all third-party data as untrusted.
- Validate response envelopes and every record with Zod.
- Set maximum request body size for webhook routes.
- Use parameterised queries through Prisma.
- Restrict stored raw payload fields to necessary debugging data; redact card/customer secrets and unnecessary personal data.
- Use retention rules for raw payloads and failed records.
- Avoid storing full payment method or card data; Stripe IDs and non-sensitive metadata are enough.

## 14.5 Availability and Abuse Protection

- Apply rate limits to administrative and demo endpoints.
- Add timeouts to every outbound call.
- Limit page size and total records per manually triggered run where appropriate.
- Prevent concurrent syncs for the same connection/object.
- Ensure webhook endpoints acknowledge only after durable receipt.
- Set a maximum payload size and reject unsupported content types.

## 14.6 Database Security

- Use TLS database connections.
- Give the application only the database privileges it needs.
- Run migrations through a controlled deployment step.
- Back up or export sample data before submission where free-tier retention is uncertain.
- Do not expose the database publicly beyond provider requirements.

## 14.7 Supply-Chain and Deployment Security

- Pin major dependency versions and commit the lock file.
- Run `npm audit` or an equivalent dependency scan.
- Enable Dependabot.
- Use GitHub secret scanning.
- Run as a non-root user in Docker where possible.
- Add security headers with Helmet-equivalent Fastify plugins.
- Do not print environment variables during build or startup.

---

## 15. Use Cases

### UC-01 — Initial Full Sync

**Actor:** Administrator  
**Trigger:** First deployment or missing checkpoint  
**Flow:** Each adapter fetches all pages, validates, normalizes, upserts, and stores a fresh checkpoint.  
**Expected result:** All valid source records appear once in normalized storage.

### UC-02 — Normal Incremental Sync

**Actor:** Scheduler or administrator  
**Trigger:** Existing valid checkpoint  
**Flow:** Fetch only changed records, upsert them, store next checkpoint.  
**Expected result:** Changed records update; unchanged records do not duplicate.

### UC-03 — Repeated Back-to-Back Sync

**Actor:** Administrator  
**Trigger:** Same sync called twice with no changes  
**Expected result:** Row counts remain unchanged; second run reports zero or no-op updates.

### UC-04 — Duplicate Webhook

**Actor:** External source  
**Trigger:** Same webhook event delivered twice  
**Expected result:** First event processes; second is acknowledged as duplicate and makes no duplicate row.

### UC-05 — Stale Google Calendar Token

**Actor:** Google Calendar  
**Trigger:** Incremental request returns `410 Gone`  
**Expected result:** Pipeline records fallback, completes a full sync, safely reconciles deleted events, and stores a new token.

### UC-06 — Invalid HubSpot/Stripe Cursor

**Actor:** External API  
**Trigger:** Saved cursor is rejected  
**Expected result:** Old checkpoint is not advanced; a full backfill runs and creates no duplicates.

### UC-07 — One Source Unavailable

**Actor:** External API  
**Trigger:** Stripe returns 503 while HubSpot and Google are healthy  
**Expected result:** HubSpot and Google commit successfully; parent run is `partial_success`; Stripe failure is retryable.

### UC-08 — Malformed Record in a Valid Page

**Actor:** External source  
**Trigger:** One record has invalid type or missing required identity  
**Expected result:** Invalid record enters `failed_records`; valid sibling records commit.

### UC-09 — Authentication Revoked

**Actor:** Source owner  
**Trigger:** OAuth token revoked or API key invalid  
**Expected result:** Connection becomes `auth_required`; other sources continue; no infinite retry.

### UC-10 — Record Updated

**Actor:** User in source system  
**Trigger:** Contact/payment/event changes  
**Expected result:** Existing normalized record is updated in place and raw/source metadata is refreshed.

### UC-11 — Record Deleted or Cancelled

**Actor:** User in source system  
**Trigger:** Contact archived, payment object deleted where applicable, or calendar event cancelled  
**Expected result:** Record is soft-deleted/marked cancelled; historical trace is retained.

### UC-12 — Concurrent Manual and Webhook Sync

**Actor:** Administrator and webhook provider  
**Trigger:** Both attempt to sync same source simultaneously  
**Expected result:** Per-source lock serialises or skips the second job; checkpoint remains valid.

### UC-13 — Retry Failed Records

**Actor:** Administrator  
**Trigger:** Schema mapping is fixed after poison records were recorded  
**Expected result:** Retry processes only unresolved failed records and marks them resolved.

### UC-14 — Inspect a Run

**Actor:** Evaluator  
**Trigger:** Request run details  
**Expected result:** API returns status per source, counts, timing, fallback reason, and sanitized errors.

### UC-15 — Render Cold Start

**Actor:** Evaluator  
**Trigger:** First request after idle period  
**Expected result:** Service wakes, readiness remains false until DB connection is established, then endpoint responds.

---

## 16. Edge Cases and Expected Behaviour

### Identity and Deduplication

1. Same external ID arrives from webhook and polling simultaneously — unique key and transaction prevent duplication.
2. Same external ID exists in two different sources — retained as two source identities; no unsafe auto-merge.
3. Webhook has no stable event ID — generate deterministic event fingerprint.
4. Same webhook ID arrives with different payload — flag as suspicious conflict and preserve first receipt plus hash mismatch log.
5. Source object re-created with a reused ID — compare source version/timestamps and record source behaviour; external APIs normally provide stable IDs.
6. Duplicate records already exist due to a historic bug — migration/deduplication script picks canonical row before adding unique constraint.

### Ordering and Versioning

7. Older webhook arrives after a newer update — ignore downgrade based on source update timestamp/version.
8. Two updates share the exact timestamp — use external ID/event ID tie-breaker and overlap window.
9. Source timestamps have lower precision — use overlap plus idempotent upserts.
10. Local clock differs from source clock — rely on source timestamps and server response tokens, not local time alone.
11. Webhook arrives during full sync — deduplicate/upsert; run a final overlap reconciliation.
12. Object changes between list pages — overlap/reconciliation ensures eventual correction.

### Cursor and Pagination

13. Cursor is null on first run — execute full sync.
14. Cursor is malformed in DB — mark invalid and perform controlled full backfill.
15. Incremental token expires — known fallback to full sync.
16. API returns empty page with a next cursor — protect against cursor loops and cap page count.
17. API repeats the same next cursor — detect loop, fail source safely, keep old checkpoint.
18. API returns records but no expected next token — finish only if source contract permits; otherwise classify malformed response.
19. Last page commits but checkpoint write fails — rerun reprocesses safely and does not duplicate.
20. Checkpoint advances but data transaction rolls back — prevented by writing data and checkpoint in the correct transaction boundary.
21. Full sync fails halfway — previous official checkpoint/state remains; committed pages can be safely reprocessed.
22. Token invalidates again during fallback full sync — fail source with clear error; do not erase prior valid local state.

### Data Quality

23. Missing external ID — reject record to `failed_records` because idempotency cannot be guaranteed.
24. Missing optional fields — normalize to null.
25. Unexpected extra fields — preserve in raw JSON but ignore in normalized schema.
26. Wrong field type — reject or coerce only through explicit documented rules.
27. Invalid email — store as null or raw value based on policy; do not fail entire record unless required.
28. Invalid UTF-8/unusual Unicode — ensure database and JSON parser support UTF-8; sanitize control characters in logs.
29. Extremely long text — enforce safe maximum lengths and retain truncated/raw metadata as policy allows.
30. Unknown enum/status — map to `unknown` plus retain raw source status.
31. Null vs absent field — adapter defines whether absent means unchanged and null means clear.
32. Amount uses decimal string — convert exactly to minor units using source-provided integer wherever possible.
33. Currency is missing/unsupported — reject payment record or map to unknown according to invariant.
34. Negative/refunded amount — model refund separately or track refunded amount; do not assume all amounts are positive.
35. Calendar all-day event uses `date`, not `dateTime` — set `is_all_day=true` and normalize dates correctly.
36. Calendar event has timezone/DST transition — store UTC timestamp plus source timezone.
37. Recurring calendar event changes — preserve recurring parent ID and individual instance IDs.
38. Calendar event cancelled — soft-delete or status `cancelled`, not physical deletion.
39. HubSpot contact archived — represent `is_deleted=true` while keeping traceability.

### External Failures

40. DNS failure — bounded retry; source fails independently.
41. Timeout — abort request, retry with jitter, never wait forever.
42. HTTP 429 — honour `Retry-After`; do not hammer source.
43. HTTP 5xx — retry then fail only that source.
44. HTTP 401/403 — mark credentials/action required; no repeated retries.
45. HTTP 410 — source-specific stale token fallback.
46. HTTP 200 with HTML/non-JSON body — classify garbage response, fail source safely.
47. HTTP 200 with malformed JSON structure — schema validation error; do not advance checkpoint.
48. Partial/truncated HTTP response — parse failure, retry safely.
49. API returns duplicate objects in same page — in-memory page dedup plus database unique constraint.
50. API rate limit changes — central rate-limit handling and configurable concurrency.

### Database and Runtime

51. Database unavailable before sync — readiness fails and no source calls begin.
52. Database fails during page transaction — rollback page; keep official checkpoint.
53. Process crashes after data commit but before response — rerun is idempotent.
54. Process crashes after webhook receipt but before processing — durable `received` row is retried.
55. Render restarts or redeploys — no reliance on local filesystem or in-memory checkpoints.
56. Two service instances run same source — PostgreSQL lock protects source checkpoint.
57. Migration mismatch — startup readiness fails rather than running with incompatible schema.
58. Disk/log volume grows — structured logs and retention; raw payload retention limits.

### Security

59. Forged webhook — signature/channel verification rejects it.
60. Replay attack — timestamp freshness and event dedup reject/reduce replay impact.
61. Timing attack on signature comparison — use constant-time comparison.
62. Oversized webhook body — request-size limit rejects it.
63. SQL injection string in source data — parameterised ORM prevents query injection.
64. Secret appears in source error body — sanitize before logging and API response.
65. Admin endpoint brute force — high-entropy token, TLS, rate limiting.
66. Demo failure endpoint exposed accidentally — require both `DEMO_MODE=true` and admin auth.
67. PII exposed through list API — redact/minimize response and require authentication.
68. Raw card/payment details — never store; use Stripe identifiers and non-sensitive metadata only.

### Operational and Demo

69. Free Render service sleeps — document cold start and wake it before demo recording.
70. Scheduled job on free tier is not available without cost — use protected HTTP trigger, GitHub Actions schedule, or an external free scheduler if allowed; manual trigger remains sufficient for assignment demonstration.
71. OAuth consent/token expires before evaluator tests — readiness/status reports `auth_required`; README includes reconnection instructions.
72. Google push channel expires — renew channel and keep periodic polling/reconciliation.
73. Webhook delivery arrives before deployment is awake — source retries plus reconciliation recover it.
74. Evaluator triggers sync multiple times — manual request idempotency key and source lock prevent duplicate concurrent work.
75. Seed data is modified after recording — README provides reproducible seeding steps.

---

## 17. Detailed System Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant API as Render API
    participant O as Orchestrator
    participant A as Source Adapter
    participant S as External Source
    participant DB as PostgreSQL

    Admin->>API: POST /api/v1/sync (Bearer token)
    API->>DB: Create parent sync_run
    API->>O: Start independent source tasks
    O->>DB: Acquire source lock and read checkpoint

    alt Valid incremental checkpoint
        O->>A: runIncremental(checkpoint)
        A->>S: Fetch changes/page
    else Missing or known invalid checkpoint
        O->>A: runFullSync()
        A->>S: Fetch all/page
    end

    S-->>A: Records + next page/token
    A->>A: Validate and normalize each record
    A->>DB: Transactional upserts + failed record entries

    alt More pages
        A->>S: Fetch next page
    else All pages committed
        A->>DB: Atomically store final checkpoint
        A-->>O: Source success and counts
    end

    O->>DB: Finalize source run
    O->>DB: Finalize parent status
    API-->>Admin: 202/run ID or final result
```

### Stale Cursor Fallback Sequence

```mermaid
sequenceDiagram
    autonumber
    participant O as Source Orchestrator
    participant G as Google Calendar API
    participant DB as PostgreSQL

    O->>DB: Read current sync token
    O->>G: events.list(syncToken)
    G-->>O: 410 Gone
    O->>DB: Record fallback reason; preserve prior state
    O->>G: Full events.list(page 1)
    loop Every full-sync page
        G-->>O: Events + nextPageToken
        O->>DB: Upsert page with generation ID
        O->>G: Request next page
    end
    G-->>O: Final page + nextSyncToken
    O->>DB: Transaction: reconcile unseen rows + save new token
    O->>DB: Mark source run fallback_full/success
```

---

## 18. Suggested Project Structure

```text
src/
  app.ts
  server.ts
  config/
    env.ts
  routes/
    health.routes.ts
    sync.routes.ts
    records.routes.ts
    webhooks/
      hubspot.webhook.ts
      stripe.webhook.ts
      google-calendar.webhook.ts
  sync/
    orchestrator.ts
    locks.ts
    retry.ts
    checkpoint.service.ts
    types.ts
    adapters/
      source-adapter.interface.ts
      hubspot.adapter.ts
      stripe.adapter.ts
      google-calendar.adapter.ts
    normalizers/
      hubspot.normalizer.ts
      stripe.normalizer.ts
      google-calendar.normalizer.ts
    writers/
      idempotent-writer.ts
  security/
    admin-auth.ts
    encryption.ts
    webhook-verification.ts
    redaction.ts
  observability/
    logger.ts
    metrics.ts
  db/
    prisma.ts
prisma/
  schema.prisma
  migrations/
tests/
  unit/
  integration/
  fixtures/
scripts/
  seed-hubspot.ts
  seed-stripe.ts
  seed-google-calendar.ts
  trigger-sync.ts
  replay-webhook.ts
render.yaml
Dockerfile
README.md
.env.example
```

---

## 19. Project To-Do List and Status Tracker

Use this section as the single project tracker. Update the status and evidence columns after each task.

**Status legend:** ⬜ Not started · 🟡 In progress · 🟢 Complete · 🔴 Blocked · ⚪ Optional

### 19.1 Milestone Summary

| Milestone | Current status | Completion condition |
|---|---|---|
| Planning and architecture | 🟢 Complete | Architecture, security approach, use cases, edge cases, and implementation plan documented |
| Accounts and credentials | ⬜ Not started | All start-gate prerequisites pass |
| Project foundation | ⬜ Not started | Service starts locally; lint, type-check, tests, and migrations run |
| Database and persistence | ⬜ Not started | Schema migrated and constraints verified |
| HubSpot integration | ⬜ Not started | Full/incremental sync, validation, retries, and idempotency tested |
| Stripe integration | ⬜ Not started | Full/incremental sync, webhook deduplication, and pagination tested |
| Google Calendar integration | ⬜ Not started | Full/incremental sync and `410 Gone` recovery tested |
| Orchestration and isolation | ⬜ Not started | One source can fail while other sources complete |
| Security hardening | ⬜ Not started | Authentication, signatures, redaction, encryption, and limits verified |
| Automated testing | ⬜ Not started | Required unit/integration/failure tests pass |
| Render deployment | ⬜ Not started | Live endpoint and database operate on Render |
| Documentation and demo | ⬜ Not started | README, references, AI disclosure, and video are ready |
| Submission | ⬜ Not started | Public repo, live URL, and video link submitted |

### 19.2 Detailed Trackable Tasks

| ID | Task | Status | Depends on | Evidence / link |
|---|---|---|---|---|
| P-01 | Create public GitHub repository | ⬜ | None | |
| P-02 | Create Render PostgreSQL database | ⬜ | None | |
| P-03 | Verify `DATABASE_URL` connectivity | ⬜ | P-02 | |
| P-04 | Create HubSpot test account and seed contacts | ⬜ | None | |
| P-05 | Create HubSpot private app and scopes | ⬜ | P-04 | |
| P-06 | Seed Stripe test customers and payments | ⬜ | None | |
| P-07 | Create Google Cloud project and OAuth credentials | ⬜ | None | |
| P-08 | Seed Google Calendar events and obtain refresh token | ⬜ | P-07 | |
| F-01 | Initialise Node.js, TypeScript, Fastify, Prisma, and Vitest | ⬜ | P-01 | |
| F-02 | Add formatting, linting, type-checking, and pre-commit checks | ⬜ | F-01 | |
| F-03 | Add validated configuration loader and `.env.example` | ⬜ | F-01 | |
| F-04 | Add structured logging with secret redaction | ⬜ | F-01 | |
| DB-01 | Implement Prisma schema | ⬜ | F-01, P-03 | |
| DB-02 | Create and apply initial migration | ⬜ | DB-01 | |
| DB-03 | Add unique constraints for source identity and webhook IDs | ⬜ | DB-01 | |
| DB-04 | Add transactional checkpoint repository | ⬜ | DB-02 | |
| DB-05 | Add sync-run, source-run, and dead-letter repositories | ⬜ | DB-02 | |
| C-01 | Define common source-adapter contract | ⬜ | F-01 | |
| C-02 | Implement canonical record validators and normalizers | ⬜ | C-01 | |
| C-03 | Implement timeout, retry, backoff, and error classification | ⬜ | C-01 | |
| C-04 | Implement idempotent transactional writer | ⬜ | DB-03, C-02 | |
| H-01 | Implement HubSpot full fetch with pagination | ⬜ | C-01, P-05 | |
| H-02 | Implement HubSpot incremental fetch | ⬜ | H-01 | |
| H-03 | Implement HubSpot normalization and field validation | ⬜ | H-01, C-02 | |
| H-04 | Implement HubSpot webhook signature verification and deduplication | ⬜ | H-01 | |
| H-05 | Test invalid token, rate limit, malformed record, and repeated sync | ⬜ | H-02, H-04 | |
| S-01 | Implement Stripe full fetch with cursor pagination | ⬜ | C-01, P-06 | |
| S-02 | Implement Stripe incremental/reconciliation strategy | ⬜ | S-01 | |
| S-03 | Implement Stripe normalization and field validation | ⬜ | S-01, C-02 | |
| S-04 | Implement Stripe signature verification and event deduplication | ⬜ | S-01 | |
| S-05 | Test duplicate webhook, timeout, 429, malformed object, and repeated sync | ⬜ | S-02, S-04 | |
| G-01 | Implement Google Calendar full sync | ⬜ | C-01, P-08 | |
| G-02 | Persist and use `nextSyncToken` for incremental sync | ⬜ | G-01 | |
| G-03 | Implement `410 Gone` detection and safe full-backfill fallback | ⬜ | G-02 | |
| G-04 | Handle cancelled events and recurring-event identifiers | ⬜ | G-01 | |
| G-05 | Implement notification-channel validation and reconciliation trigger | ⬜ | G-01 | |
| G-06 | Test expired token, deleted event, pagination, and repeated sync | ⬜ | G-03, G-04 | |
| O-01 | Implement parent sync orchestrator | ⬜ | C-04 | |
| O-02 | Run source adapters with independent failure boundaries | ⬜ | O-01 | |
| O-03 | Prevent concurrent syncs for the same source/object | ⬜ | DB-04, O-01 | |
| O-04 | Advance checkpoints only after committed pages/batches | ⬜ | DB-04, O-01 | |
| O-05 | Return `success`, `partial_success`, or `failed` summaries correctly | ⬜ | O-02 | |
| API-01 | Add authenticated manual-sync endpoint | ⬜ | O-01 | |
| API-02 | Add sync-run status and record-inspection endpoints | ⬜ | O-01 | |
| API-03 | Add health, readiness, and Swagger endpoints | ⬜ | F-01, DB-02 | |
| SEC-01 | Protect admin endpoints with constant-time API-key validation | ⬜ | API-01 | |
| SEC-02 | Validate all webhook signatures/tokens before parsing work | ⬜ | H-04, S-04, G-05 | |
| SEC-03 | Encrypt stored OAuth/API credentials | ⬜ | DB-01, F-03 | |
| SEC-04 | Add request size limits, rate limits, CORS policy, and security headers | ⬜ | F-01 | |
| SEC-05 | Verify logs and API responses do not leak secrets or unnecessary PII | ⬜ | F-04 | |
| T-01 | Unit-test normalizers and error classifiers | ⬜ | C-02, C-03 | |
| T-02 | Integration-test upserts, constraints, transactions, and checkpoints | ⬜ | DB-04, C-04 | |
| T-03 | Test one-source failure while two sources succeed | ⬜ | O-02 | |
| T-04 | Test crash before and after checkpoint commit | ⬜ | O-04 | |
| T-05 | Test repeated webhooks and back-to-back sync runs | ⬜ | H-04, S-04, O-04 | |
| T-06 | Run lint, type-check, test, migration validation, and dependency audit in CI | ⬜ | F-02 | |
| D-01 | Create Render Web Service from GitHub | ⬜ | P-01 | |
| D-02 | Add Render environment variables and secrets | ⬜ | D-01, prerequisites | |
| D-03 | Run `prisma migrate deploy` during deployment | ⬜ | D-02, DB-02 | |
| D-04 | Configure health check and verify live deployment | ⬜ | D-03, API-03 | |
| D-05 | Register deployed webhook and OAuth callback URLs | ⬜ | D-04 | |
| DOC-01 | Complete README setup, architecture, API, and tradeoff sections | ⬜ | Core implementation | |
| DOC-02 | Add official references and research sources | ⬜ | DOC-01 | |
| DOC-03 | Add AI-usage declaration and shared conversation link | ⬜ | DOC-01 | |
| DOC-04 | Prepare curl/Postman demo commands | ⬜ | API-01, D-04 | |
| DOC-05 | Record a demo under five minutes showing an edge case | ⬜ | D-05, T-03 or G-03 | |
| SUB-01 | Verify repository is public and contains no secrets | ⬜ | SEC-05, DOC-01 | |
| SUB-02 | Verify live URL works from an unauthenticated browser/client | ⬜ | D-04 | |
| SUB-03 | Submit repository, Render URL, demo video, sources, and AI disclosure | ⬜ | SUB-01, SUB-02, DOC-05 | |

### 19.3 Suggested Progress Update Format

Update this summary at the end of each work session:

```text
Date: YYYY-MM-DD
Overall status: Not started / In progress / Blocked / Complete
Completed today: [task IDs]
In progress: [task IDs]
Blocked: [task IDs and reason]
Next tasks: [task IDs]
Latest working endpoint or test: [URL/command]
```

### 19.4 Definition of Done

The project is complete only when:

- [ ] The live Render endpoint is reachable.
- [ ] All three seeded sources sync into the normalized schema.
- [ ] Running the same sync twice does not create duplicate rows.
- [ ] Replaying the same webhook does not create duplicate rows.
- [ ] An invalid Google sync token triggers a full backfill.
- [ ] One deliberately failing source does not stop the other two.
- [ ] Checkpoints never advance for uncommitted data.
- [ ] Invalid records are visible in dead-letter/error tracking.
- [ ] Secrets are absent from Git history, logs, screenshots, and demo output.
- [ ] CI checks pass.
- [ ] README, references, AI disclosure, live URL, and demo video are complete.

---

## 20. Plan of Action

## Phase 0 — Scope and Accounts

- [ ] Confirm only contacts, payments, and calendar events are in scope.
- [ ] Create HubSpot developer/test account and seed 5–10 contacts.
- [ ] Create Stripe test-mode customers and successful/failed payments.
- [ ] Create Google Cloud project, enable Calendar API, configure OAuth, and seed 5–10 events including all-day and recurring events.
- [ ] Record source account IDs and required OAuth scopes.

**Deliverable:** Verified API access using curl/Postman or small scripts.

## Phase 1 — Repository and Foundation

- [ ] Create public GitHub repository.
- [ ] Initialise TypeScript, Fastify, Prisma, PostgreSQL, Vitest, ESLint, and formatter.
- [ ] Add strict environment validation.
- [ ] Add `/health/live` and `/health/ready`.
- [ ] Add structured logging and correlation IDs.
- [ ] Add `.env.example`, `.gitignore`, and secret-scanning protection.

**Deliverable:** Application starts locally and connects to PostgreSQL; production uses Render Free PostgreSQL through `DATABASE_URL`.

## Phase 2 — Database Schema

- [ ] Implement connection, checkpoint, run, source run, external record, normalized object, webhook event, and failed record tables.
- [ ] Add unique constraints for external identities and webhook event IDs.
- [ ] Add indexes on source, object type, external ID, status, updated timestamp, and retry time.
- [ ] Create initial migration.
- [ ] Add seed data only for local application metadata, not secrets.

**Deliverable:** Migration works from an empty database.

## Phase 3 — Adapter Contract

Define a common adapter interface:

```ts
interface SourceAdapter<TCursor, TRaw> {
  source: SourceName;
  fullSync(ctx: SyncContext): AsyncGenerator<SourcePage<TRaw, TCursor>>;
  incrementalSync(
    checkpoint: SyncCheckpoint,
    ctx: SyncContext,
  ): AsyncGenerator<SourcePage<TRaw, TCursor>>;
  normalize(raw: TRaw): NormalizedRecord;
  isStaleCursorError(error: unknown): boolean;
}
```

- [ ] Implement shared timeout, retry, rate-limit, and error classification utilities.
- [ ] Implement page loop protection and maximum-page guard.
- [ ] Implement checkpoint transaction rules.

**Deliverable:** Fake adapter passes full/incremental/failure tests.

## Phase 4 — HubSpot Adapter

- [ ] Implement paginated full contact fetch.
- [ ] Implement update-watermark incremental search with overlap.
- [ ] Implement contact validation and normalization.
- [ ] Implement archived/deleted handling.
- [ ] Add stale/malformed cursor fallback.
- [ ] Optionally add signed webhook route.

**Deliverable:** Initial sync, update sync, duplicate run, and forced fallback demonstrated.

## Phase 5 — Stripe Adapter

- [ ] Implement full customer and PaymentIntent/Charge pagination.
- [ ] Implement Stripe Events-based incremental ingestion.
- [ ] Validate amounts and currencies.
- [ ] Implement webhook raw-body signature verification.
- [ ] Add event ID deduplication.
- [ ] Add reconciliation of recent objects.

**Deliverable:** Duplicate Stripe webhook produces one database state.

## Phase 6 — Google Calendar Adapter

- [ ] Implement full sync with page tokens and final `nextSyncToken`.
- [ ] Implement incremental sync using `syncToken`.
- [ ] Handle deleted/cancelled and all-day events.
- [ ] Implement explicit `410 Gone` fallback.
- [ ] Implement generation-based safe full reconciliation.
- [ ] Optionally add push notification channel handling.

**Deliverable:** Forced stale token triggers successful full resync without duplicates.

## Phase 7 — Orchestration and Isolation

- [ ] Implement parent and child sync-run records.
- [ ] Use `Promise.allSettled` for independent source execution.
- [ ] Add PostgreSQL advisory lock or checkpoint row lock per source.
- [ ] Implement `success`, `partial_success`, and `failed` aggregation.
- [ ] Add manual trigger idempotency keys.
- [ ] Add run inspection endpoints.

**Deliverable:** Simulated Stripe outage still allows HubSpot and Google data to land.

## Phase 8 — Security Hardening

- [ ] Protect administrative APIs with high-entropy bearer token.
- [ ] Verify HubSpot and Stripe signatures; validate Google channel identifiers.
- [ ] Encrypt persisted OAuth tokens.
- [ ] Redact secrets and PII from logs.
- [ ] Add body-size limits, rate limiting, security headers, and CORS deny-by-default.
- [ ] Add dependency and secret scanning.
- [ ] Disable demo failure injection unless explicitly enabled.

**Deliverable:** Forged webhook and unauthenticated sync requests are rejected.

## Phase 9 — Testing

### Unit Tests

- [ ] Mapping each source shape to normalized schema.
- [ ] Canonical payload hash stability.
- [ ] Error classification.
- [ ] Timestamp tie-breaking.
- [ ] Money minor-unit handling.
- [ ] Calendar all-day and timezone mapping.

### Integration Tests

- [ ] Same record processed twice produces one row.
- [ ] Same webhook processed twice produces one event row and one normalized result.
- [ ] Data transaction failure does not advance checkpoint.
- [ ] Stale cursor performs full fallback.
- [ ] One source failure gives parent `partial_success`.
- [ ] Poison record does not block valid records.
- [ ] Concurrent sync obtains only one source lock.
- [ ] Crash-style rerun remains idempotent.

### Contract/Mock Tests

- [ ] 429 with `Retry-After`.
- [ ] 503 then success.
- [ ] Timeout.
- [ ] 200 with invalid JSON/schema.
- [ ] Repeated next cursor loop.
- [ ] Empty page with next token.

**Deliverable:** CI passes lint, type-check, tests, and migration validation.

## Phase 10 — Deployment on Render

- [ ] Add Dockerfile and/or `render.yaml`.
- [ ] Create Render free web service.
- [ ] Create and attach a Render Free PostgreSQL database.
- [ ] Set `DATABASE_URL` from Render’s internal database connection URL.
- [ ] Configure the remaining source credentials and security environment variables.
- [ ] Run Prisma migrations during deployment.
- [ ] Confirm live health and authenticated sync endpoints.
- [ ] Configure real webhook callback URLs after deployment.
- [ ] Note free-service cold-start behaviour in README.
- [ ] Avoid relying on Render local filesystem.

**Deliverable:** Public live endpoint responds and a real sync can be triggered.

## Phase 11 — README and Submission

README sections:

- [ ] Problem summary.
- [ ] Architecture diagram.
- [ ] Technology choices.
- [ ] Local setup.
- [ ] Environment variables.
- [ ] Database migration.
- [ ] How to seed all three sources.
- [ ] How to trigger full/incremental sync.
- [ ] How to reproduce stale cursor, duplicate webhook, malformed record, and source outage.
- [ ] API endpoint examples.
- [ ] Correctness guarantees and limitations.
- [ ] Security decisions.
- [ ] Tradeoffs and future improvements.
- [ ] Official references.
- [ ] AI usage declaration and shared conversation/export link.
- [ ] Live Render URL and demo video URL.

**Deliverable:** Evaluator can reproduce the project without private instructions.

---

## 21. Recommended Demo Video Flow — Maximum 5 Minutes

### 0:00–0:40 — Overview

- Show architecture diagram.
- Explain three adapters, PostgreSQL, checkpoints, and idempotent external identity.

### 0:40–1:40 — Live Initial Sync

- Show seeded records in HubSpot, Stripe test mode, and Google Calendar.
- Trigger `POST /api/v1/sync` on Render.
- Show source run counts and normalized records.

### 1:40–2:20 — Idempotency

- Run the same sync again.
- Show unchanged row counts.
- Replay one Stripe webhook twice.
- Show one processed event and one final payment record.

### 2:20–3:20 — Stale Cursor Fallback

- Inject/replace Google sync token with an invalid value through protected demo mechanism.
- Trigger Google sync.
- Show `410` classified as stale token, full fallback, successful new checkpoint, and no duplicated events.

### 3:20–4:10 — Source Isolation

- Force Stripe adapter to return simulated 503 or use mock/demo flag.
- Trigger all-source sync.
- Show HubSpot and Google success, Stripe failure, parent `partial_success`.

### 4:10–5:00 — Code and Tradeoffs

- Show unique database constraint, checkpoint transaction, and `Promise.allSettled`.
- Mention Render cold start, webhook reconciliation, no unsafe cross-source identity merge, and AI usage disclosure.

---

## 22. Acceptance Criteria Checklist

| Requirement | Verification |
|---|---|
| Three differently shaped sources | HubSpot, Stripe, Google Calendar adapters |
| Incremental fetch | HubSpot watermark, Stripe event watermark, Google sync token |
| Full fetch | Paginated source-specific backfills |
| Cursor stale/rejected fallback | Classified error triggers full sync |
| No silent loss | Checkpoint advances only after successful commit |
| Idempotent writes | Unique source identity + transactional upsert |
| Duplicate webhook safe | Unique webhook event ID/fingerprint |
| One source failure isolated | `Promise.allSettled` + source child runs |
| Garbage record isolated | Per-record validation + failed-record store |
| Live deployment | Render URL |
| Demonstrated edge case | Stale token, duplicate webhook, or source outage |
| README tradeoffs | Dedicated section |
| References | Official source list |
| AI disclosure | Tool name plus shared/exported conversation |

---

## 23. Tradeoffs

1. **At-least-once plus idempotency, not theoretical exactly-once:** this is the realistic guarantee across external APIs.
2. **Webhooks plus polling:** more components, but stronger correctness than either approach alone.
3. **Raw payload retention:** useful for debugging, but increases privacy/storage risk; use redaction and retention.
4. **No automatic cross-source person merge:** avoids incorrect identity joins; entity resolution can be added later.
5. **Single service for assignment:** adapters and orchestrator run in one deployable service for simplicity. Production scale could use a queue and dedicated workers.
6. **Page transactions rather than one giant transaction:** limits lock time and memory. Official checkpoints remain conservative so reruns are safe.
7. **Demo failure injection:** improves reproducibility but must be strongly protected and disabled in normal operation.
8. **Free-tier deployment:** sufficient for evaluation, but cold starts and database/account limits must be documented.

---

## 24. Future Improvements

- Add BullMQ/SQS/Pub/Sub for durable asynchronous jobs.
- Add OpenTelemetry traces and Prometheus-compatible metrics.
- Add source-specific dead-letter reprocessing workers.
- Add OAuth installation flow for multiple accounts.
- Add tenant isolation if supporting multiple customers.
- Add schema registry/versioning for source payload changes.
- Add reconciliation reports comparing source counts and checksums.
- Add soft-delete tombstone retention policies.
- Add alerting for stale checkpoints, repeated authentication failures, and increased poison-record rate.
- Add chaos tests and load tests.

---

## 25. Official Sources and References

Use current official documentation while implementing and pin API versions where supported.

- HubSpot CRM contacts API: https://developers.hubspot.com/docs/api-reference/crm-contacts-v3/guide
- HubSpot CRM search: https://developers.hubspot.com/docs/api-reference/latest/crm/search-the-crm
- HubSpot API usage guidelines: https://developers.hubspot.com/docs/developer-tooling/platform/usage-guidelines
- HubSpot request signature validation: https://developers.hubspot.com/docs/apps/legacy-apps/authentication/validating-requests
- Google Calendar incremental synchronization: https://developers.google.com/workspace/calendar/api/guides/sync
- Google Calendar events list API: https://developers.google.com/workspace/calendar/api/v3/reference/events/list
- Google Calendar push notifications: https://developers.google.com/workspace/calendar/api/guides/push
- Stripe API: https://docs.stripe.com/api
- Stripe pagination: https://docs.stripe.com/api/pagination
- Stripe Events list: https://docs.stripe.com/api/events/list
- Stripe webhook signatures: https://docs.stripe.com/webhooks/signature
- Stripe idempotent requests: https://docs.stripe.com/api/idempotent_requests
- Render free services: https://render.com/docs/free
- Render cron jobs: https://render.com/docs/cronjobs
- Render persistent disks/ephemeral filesystem: https://render.com/docs/disks
- PostgreSQL transaction isolation: https://www.postgresql.org/docs/current/transaction-iso.html
- Prisma transactions: https://www.prisma.io/docs/orm/prisma-client/queries/transactions
- OWASP API Security Top 10: https://owasp.org/API-Security/

---

## 26. AI Usage Declaration Template

> AI tools were used during architecture planning, edge-case review, documentation, and/or code assistance. All generated suggestions were reviewed, tested, and modified before inclusion. The repository contains the final implementation and tests that serve as the source of truth. Shared conversation/export: `<ADD CHATGPT OR OTHER AI SHARE LINK>`.

Do not claim that AI output was independently correct. Explain how generated code and design choices were verified through tests, official documentation, and live failure demonstrations.

---

## 27. Final Recommended Implementation Scope

To finish this assignment alone without overbuilding, implement the following minimum strong submission:

- HubSpot contacts only.
- Stripe customers and PaymentIntents, with Stripe Events/webhooks for changes.
- One Google Calendar and its events.
- PostgreSQL normalized tables and raw source envelope.
- Full sync and incremental sync for all three.
- Google `410 Gone` fallback.
- Idempotent database upserts and webhook deduplication.
- `Promise.allSettled` source isolation.
- Per-record validation and failed-record storage.
- Manual live sync endpoint plus run-status endpoints.
- Admin authentication, webhook verification, rate limits, secret redaction, and encrypted OAuth tokens.
- Automated tests for duplicate writes, stale token fallback, malformed records, and one-source outage.
- Render deployment, five-minute demo, public GitHub README, references, and AI disclosure.

This scope directly demonstrates every important evaluation criterion while remaining achievable by one developer.
