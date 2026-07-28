# Sync Pipeline Project Status

Use this file as the single source of truth for project execution. Update it after every development session and commit status changes with the related code.

**Last updated:** 2026-07-28  
**Overall status:** 🟡 Planning complete; implementation not started  
**Current phase:** Phase 0 — Prerequisites and accounts  
**Target deployment:** Render Web Service + Render Free PostgreSQL

## Status Legend

- ⬜ Not started
- 🟡 In progress
- 🟢 Complete
- 🔴 Blocked
- ⚪ Optional

## 1. Prerequisite Readiness

| ID | Requirement | Status | Value/evidence to record safely | Notes |
|---|---|---:|---|---|
| PRE-01 | Public GitHub repository created | ⬜ | Repository URL | Do not commit secrets |
| PRE-02 | Render account available | ⬜ | Account verified | |
| PRE-03 | Render Free PostgreSQL created | ⬜ | Database name only | Never record password here |
| PRE-04 | Render internal `DATABASE_URL` added to service | ⬜ | “Configured” | Do not paste the URL |
| PRE-05 | Local PostgreSQL/test database available | ⬜ | Connection test command | Docker is acceptable |
| PRE-06 | HubSpot developer/test account created | ⬜ | Portal/account ID | |
| PRE-07 | HubSpot private app and scopes configured | ⬜ | Scope list | Store token only in secrets manager or `.env` |
| PRE-08 | HubSpot sample contacts seeded | ⬜ | Record count | Target: 5–10 contacts |
| PRE-09 | Stripe test mode enabled | ⬜ | Test dashboard verified | |
| PRE-10 | Stripe sample customers/payments seeded | ⬜ | Record count | Include success and failure examples |
| PRE-11 | Google Cloud project created | ⬜ | Project ID | |
| PRE-12 | Google Calendar API enabled | ⬜ | API enabled screenshot/reference | |
| PRE-13 | Google OAuth client configured | ⬜ | Redirect URIs recorded | Local and Render callback URLs |
| PRE-14 | Google refresh token obtained | ⬜ | “Configured” | Never paste token here |
| PRE-15 | Google Calendar sample events seeded | ⬜ | Event count | Include updated, cancelled, all-day, recurring |
| PRE-16 | Admin API key generated | ⬜ | “Configured” | At least 32 random bytes |
| PRE-17 | Credential encryption key generated | ⬜ | “Configured” | Exactly appropriate length for chosen cipher |
| PRE-18 | `.env.example` committed without secrets | ⬜ | Commit hash | |
| PRE-19 | `.gitignore` protects `.env` and local artefacts | ⬜ | Commit hash | |
| PRE-20 | API credentials tested independently | ⬜ | Test script names | Each source must return seeded data |

## 2. Milestone Dashboard

| Milestone | Status | Progress | Completion condition |
|---|---:|---:|---|
| Planning and architecture | 🟢 | 100% | Design, security, use cases, edge cases, and plan documented |
| Prerequisites and credentials | ⬜ | 0% | All mandatory prerequisite checks pass |
| Project foundation | ⬜ | 0% | App starts, validates config, logs safely, and exposes health endpoints |
| Database and persistence | ⬜ | 0% | Prisma migrations and correctness constraints verified |
| Common sync framework | ⬜ | 0% | Adapter contract, retries, validation, and idempotent writer complete |
| HubSpot integration | ⬜ | 0% | Full/incremental sync and failure tests pass |
| Stripe integration | ⬜ | 0% | Pagination, events/webhooks, deduplication, and reconciliation pass |
| Google Calendar integration | ⬜ | 0% | Full/incremental sync and stale-token fallback pass |
| Orchestration and isolation | ⬜ | 0% | One source failure does not stop the others |
| Security hardening | ⬜ | 0% | Auth, signatures, encryption, rate limits, and redaction verified |
| Automated testing and CI | ⬜ | 0% | Required unit/integration/contract tests pass in CI |
| Render deployment | ⬜ | 0% | Live API and Render PostgreSQL work together |
| Documentation and demo | ⬜ | 0% | README, references, AI disclosure, commands, and video ready |
| Submission | ⬜ | 0% | Public repo, live URL, and video submitted |

## 3. Detailed To-Do List

### Phase 0 — Accounts and Source Setup

- [ ] **P-01** Create public GitHub repository.
- [ ] **P-02** Create Render Free PostgreSQL database.
- [ ] **P-03** Verify local access to Render PostgreSQL using the external URL where required.
- [ ] **P-04** Plan production use of Render’s internal database URL.
- [ ] **P-05** Create HubSpot test account, private app, and least-privilege scopes.
- [ ] **P-06** Seed HubSpot contacts.
- [ ] **P-07** Seed Stripe test customers and PaymentIntents/charges.
- [ ] **P-08** Create Google Cloud project and enable Calendar API.
- [ ] **P-09** Configure Google OAuth consent screen and client credentials.
- [ ] **P-10** Obtain refresh token and seed calendar events.
- [ ] **P-11** Run one independent API smoke test for each source.

### Phase 1 — Project Foundation

- [ ] **F-01** Initialise Node.js 22, TypeScript, Fastify, Prisma, and Vitest.
- [ ] **F-02** Add ESLint, formatting, strict TypeScript, and scripts.
- [ ] **F-03** Add Zod-based environment validation.
- [ ] **F-04** Add `.env.example` and secure `.gitignore`.
- [ ] **F-05** Add Pino structured logging with secret redaction.
- [ ] **F-06** Add request correlation IDs.
- [ ] **F-07** Add `/health/live`, `/health/ready`, and Swagger documentation.
- [ ] **F-08** Add graceful shutdown for HTTP and database connections.

### Phase 2 — Database and Correctness Model

- [ ] **DB-01** Define Prisma models for normalized records.
- [ ] **DB-02** Define source connections and encrypted credentials metadata.
- [ ] **DB-03** Define sync runs and per-source run records.
- [ ] **DB-04** Define source checkpoints/cursors.
- [ ] **DB-05** Define webhook receipts with unique provider event IDs.
- [ ] **DB-06** Define raw payload envelope and dead-letter records.
- [ ] **DB-07** Add unique key `(source, objectType, externalId)`.
- [ ] **DB-08** Add indexes for sync queries and retries.
- [ ] **DB-09** Create initial Prisma migration.
- [ ] **DB-10** Verify migration against an empty PostgreSQL database.
- [ ] **DB-11** Implement transactional checkpoint repository.
- [ ] **DB-12** Verify failed transactions never advance checkpoints.

### Phase 3 — Shared Sync Framework

- [ ] **C-01** Define common `SourceAdapter` interface.
- [ ] **C-02** Implement normalized record schema and validators.
- [ ] **C-03** Implement idempotent upsert writer.
- [ ] **C-04** Implement payload hashing/version comparison.
- [ ] **C-05** Implement timeout and `AbortController` handling.
- [ ] **C-06** Implement exponential backoff with jitter.
- [ ] **C-07** Classify retryable, permanent, auth, stale-cursor, and garbage-data errors.
- [ ] **C-08** Implement pagination loop protection and maximum-page guard.
- [ ] **C-09** Implement dead-letter handling without blocking valid records.
- [ ] **C-10** Add per-source PostgreSQL advisory lock or row lock.

### Phase 4 — HubSpot

- [ ] **H-01** Implement full contact fetch with pagination.
- [ ] **H-02** Implement incremental update-watermark fetch with overlap window.
- [ ] **H-03** Normalize HubSpot contacts.
- [ ] **H-04** Handle archived/deleted contacts.
- [ ] **H-05** Detect invalid/stale incremental state and trigger safe full backfill.
- [ ] **H-06** Add webhook signature verification if webhooks are enabled.
- [ ] **H-07** Deduplicate repeated webhook deliveries.
- [ ] **H-08** Test 401/403, 429, 5xx, timeout, malformed record, and repeated sync.

### Phase 5 — Stripe

- [ ] **S-01** Implement full customer fetch.
- [ ] **S-02** Implement full PaymentIntent/charge fetch.
- [ ] **S-03** Implement cursor pagination.
- [ ] **S-04** Implement incremental processing using Stripe Events plus reconciliation.
- [ ] **S-05** Normalize customers and payment records.
- [ ] **S-06** Preserve money in integer minor units and retain currency.
- [ ] **S-07** Verify webhook signatures using the raw body.
- [ ] **S-08** Deduplicate using Stripe event ID.
- [ ] **S-09** Test duplicate webhook, 429, timeout, malformed object, and reordered events.

### Phase 6 — Google Calendar

- [ ] **G-01** Implement full sync with `pageToken` pagination.
- [ ] **G-02** Save final `nextSyncToken` only after successful commit.
- [ ] **G-03** Implement incremental sync using `syncToken`.
- [ ] **G-04** Detect `410 Gone` and discard stale token safely.
- [ ] **G-05** Run a full reconciliation after stale-token detection.
- [ ] **G-06** Handle cancelled/deleted events.
- [ ] **G-07** Handle all-day, timed, recurring, and exception events.
- [ ] **G-08** Normalize time zones and source timestamps.
- [ ] **G-09** Validate notification channel identifiers if push notifications are used.
- [ ] **G-10** Test expired token, pagination, deletion, recurring events, and duplicate runs.

### Phase 7 — Orchestration and API

- [ ] **O-01** Implement parent sync run.
- [ ] **O-02** Implement independent source child runs.
- [ ] **O-03** Use `Promise.allSettled` or equivalent isolation.
- [ ] **O-04** Return `success`, `partial_success`, or `failed` accurately.
- [ ] **O-05** Prevent concurrent syncs for the same source/object.
- [ ] **O-06** Add authenticated manual sync endpoint.
- [ ] **O-07** Add sync-run inspection endpoint.
- [ ] **O-08** Add normalized record inspection endpoint.
- [ ] **O-09** Add controlled retry/dead-letter replay endpoint.
- [ ] **O-10** Add disabled-by-default demo failure injection.

### Phase 8 — Security

- [ ] **SEC-01** Protect admin endpoints with bearer/API key authentication.
- [ ] **SEC-02** Compare API keys safely and never log them.
- [ ] **SEC-03** Validate webhook authenticity before processing payloads.
- [ ] **SEC-04** Encrypt OAuth refresh tokens and stored credentials.
- [ ] **SEC-05** Apply request-body size limits.
- [ ] **SEC-06** Apply rate limits to public and administrative endpoints.
- [ ] **SEC-07** Add security headers and deny-by-default CORS.
- [ ] **SEC-08** Redact authorisation headers, cookies, database URLs, and PII from logs.
- [ ] **SEC-09** Add dependency audit and secret scanning in CI.
- [ ] **SEC-10** Verify no secrets exist in Git history or demo screenshots.

### Phase 9 — Testing and CI

- [ ] **T-01** Unit-test source normalizers.
- [ ] **T-02** Unit-test error classification and retry policy.
- [ ] **T-03** Test same record twice produces one row.
- [ ] **T-04** Test same webhook twice produces one receipt and one final state.
- [ ] **T-05** Test data failure does not advance checkpoint.
- [ ] **T-06** Test stale cursor triggers full fallback.
- [ ] **T-07** Test one source failure while two sources succeed.
- [ ] **T-08** Test poison record isolation.
- [ ] **T-09** Test concurrent sync locking.
- [ ] **T-10** Test 429 with `Retry-After`, timeout, 503, malformed JSON, and cursor loops.
- [ ] **T-11** Add GitHub Actions for lint, type-check, tests, Prisma validation, audit, and secret scan.

### Phase 10 — Render Deployment

- [ ] **D-01** Add Dockerfile and/or `render.yaml`.
- [ ] **D-02** Create Render Web Service from GitHub.
- [ ] **D-03** Configure all Render environment variables.
- [ ] **D-04** Use Render internal `DATABASE_URL` for production runtime.
- [ ] **D-05** Run `prisma migrate deploy` during deployment.
- [ ] **D-06** Configure health-check path.
- [ ] **D-07** Verify live health, readiness, docs, and authenticated sync endpoints.
- [ ] **D-08** Register deployed webhook URLs and Google OAuth callback URL.
- [ ] **D-09** Verify cold-start behaviour does not break correctness.
- [ ] **D-10** Verify no runtime depends on Render’s ephemeral local filesystem.

### Phase 11 — Documentation, Demo, Submission

- [ ] **DOC-01** Complete README local setup and architecture.
- [ ] **DOC-02** Document environment variables without exposing values.
- [ ] **DOC-03** Document seed scripts and API commands.
- [ ] **DOC-04** Document correctness guarantees and tradeoffs.
- [ ] **DOC-05** List official sources and references.
- [ ] **DOC-06** Add AI usage declaration and shared chat/export link.
- [ ] **DOC-07** Prepare curl or Postman demo collection.
- [ ] **DOC-08** Record a demo under five minutes.
- [ ] **DOC-09** Show idempotency and at least one failure edge case live.
- [ ] **SUB-01** Verify public repository contains no secrets.
- [ ] **SUB-02** Verify live Render endpoint from a clean browser/client.
- [ ] **SUB-03** Submit repo URL, live URL, video URL, references, and AI disclosure.

## 4. Current Sprint

### Goal

Complete prerequisites and establish a secure, testable project foundation.

### In Progress

- [ ] Collect all required environment values without committing secrets.
- [ ] Create external source accounts and seed records.
- [ ] Initialise the repository and configuration validation.

### Next Up

1. `P-01` to `P-11`
2. `F-01` to `F-08`
3. `DB-01` to `DB-12`

### Blockers

| Blocker | Owner | Needed action | Status |
|---|---|---|---|
| None recorded | Vaibhav | Add blockers as they occur | 🟢 |

## 5. Work Session Log

Copy this block for every work session:

```text
Date: YYYY-MM-DD
Overall status: Not started / In progress / Blocked / Complete
Completed task IDs:
In-progress task IDs:
Blocked task IDs and reason:
Tests run and result:
Latest working endpoint or command:
Next task IDs:
Notes / decisions:
```

## 6. Definition of Done

- [ ] Live Render endpoint is reachable.
- [ ] Render Free PostgreSQL is the production database.
- [ ] All three seeded sources sync into the normalized schema.
- [ ] Re-running the same sync creates no duplicate rows.
- [ ] Replaying the same webhook creates no duplicate rows.
- [ ] Invalid/expired incremental state falls back to a full reconciliation.
- [ ] One failed source does not stop the other two sources.
- [ ] Checkpoints advance only for committed data.
- [ ] Garbage records are visible and retryable without blocking valid records.
- [ ] Administrative endpoints require authentication.
- [ ] Webhook authenticity checks are enabled.
- [ ] Logs, Git history, screenshots, and video reveal no secrets.
- [ ] CI is green.
- [ ] README, references, AI disclosure, live URL, and demo video are complete.
