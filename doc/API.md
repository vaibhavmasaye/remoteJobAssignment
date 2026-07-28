# API Documentation

## Overview

The Sync Pipeline API provides endpoints to manage and monitor data synchronization from HubSpot, Stripe, and Google Calendar.

**Base URL**: `https://your-service.onrender.com` (or `http://localhost:3000` for local development)

**Authentication**: Bearer token (required for all endpoints except health checks)

## Health Check Endpoints

### Liveness Probe

Check if the service is running.

```
GET /health/live
```

**Response** (200 OK)
```json
{
  "status": "ok"
}
```

**Use case**: Used by container orchestrators (Kubernetes, Render) to determine if the service should be restarted.

---

### Readiness Probe

Check if the service is ready to handle requests.

```
GET /health/ready
```

**Response** (200 OK)
```json
{
  "status": "ready",
  "timestamp": "2026-07-28T12:00:00.000Z"
}
```

**Response** (503 Service Unavailable)
```json
{
  "status": "not_ready",
  "error": "Database connection failed"
}
```

**Use case**: Used during deployment to detect when to start routing traffic to the service.

---

### Status Endpoint

Get service information (version, environment, uptime).

```
GET /api/v1/status
```

**Response** (200 OK)
```json
{
  "version": "1.0.0",
  "environment": "production",
  "uptime": 3600.5,
  "timestamp": "2026-07-28T12:00:00.000Z"
}
```

---

## Sync Endpoints

### Trigger Sync

Initiate a full sync of all sources (HubSpot, Stripe, Google Calendar).

```
POST /api/v1/sync
Authorization: Bearer YOUR_ADMIN_AUTH_TOKEN
Content-Type: application/json
```

**Request Body** (optional)
```json
{
  "idempotency-key": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response** (202 Accepted)
```json
{
  "status": "accepted",
  "runId": "550e8400-e29b-41d4-a716-446655440001",
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Sync run initiated"
}
```

**Error Responses**

```json
// 401 Unauthorized - Missing or invalid token
{
  "error": "AUTH_FAILED",
  "message": "Authentication required - credentials may be revoked",
  "timestamp": "2026-07-28T12:00:00.000Z"
}

// 429 Too Many Requests - Rate limit exceeded
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please retry after some time.",
  "retryAfter": 60,
  "timestamp": "2026-07-28T12:00:00.000Z"
}

// 500 Internal Server Error
{
  "error": "UNKNOWN_ERROR",
  "message": "An unexpected error occurred",
  "requestId": "req-12345",
  "timestamp": "2026-07-28T12:00:00.000Z"
}
```

**Notes**:
- Returns immediately with 202 Accepted (sync runs asynchronously)
- Use `idempotency-key` to safely retry without creating duplicate syncs
- Poll `/api/v1/sync-runs/:runId` to check sync progress

**Example** (cURL)
```bash
curl -X POST https://your-service.onrender.com/api/v1/sync \
  -H "Authorization: Bearer YOUR_ADMIN_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)"

# Response:
# {"status":"accepted","runId":"...","message":"Sync run initiated"}
```

---

### List Sync Runs

Get recent sync run summaries.

```
GET /api/v1/sync-runs?limit=20
Authorization: Bearer YOUR_ADMIN_AUTH_TOKEN
```

**Query Parameters**
- `limit` (optional, default: 20, max: 100): Number of runs to return

**Response** (200 OK)
```json
{
  "count": 3,
  "runs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "correlationId": "sync-2026-07-28-12:00:00",
      "status": "COMPLETED",
      "triggerType": "MANUAL",
      "startedAt": "2026-07-28T12:00:00.000Z",
      "finishedAt": "2026-07-28T12:05:30.000Z",
      "summary": {
        "totalSeen": 1500,
        "totalWritten": 1480,
        "totalSkipped": 15,
        "totalFailed": 5
      }
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "correlationId": "sync-2026-07-28-11:00:00",
      "status": "COMPLETED",
      "triggerType": "SCHEDULED",
      "startedAt": "2026-07-28T11:00:00.000Z",
      "finishedAt": "2026-07-28T11:04:15.000Z",
      "summary": {
        "totalSeen": 1200,
        "totalWritten": 1195,
        "totalSkipped": 5,
        "totalFailed": 0
      }
    }
  ]
}
```

**Example** (cURL)
```bash
curl https://your-service.onrender.com/api/v1/sync-runs?limit=10 \
  -H "Authorization: Bearer YOUR_ADMIN_AUTH_TOKEN"
```

---

### Get Sync Run Details

Get detailed information about a specific sync run, including per-source breakdown.

```
GET /api/v1/sync-runs/:runId
Authorization: Bearer YOUR_ADMIN_AUTH_TOKEN
```

**Path Parameters**
- `runId` (required): UUID of the sync run

**Response** (200 OK)
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "correlationId": "sync-2026-07-28-12:00:00",
  "status": "COMPLETED",
  "triggerType": "MANUAL",
  "startedAt": "2026-07-28T12:00:00.000Z",
  "finishedAt": "2026-07-28T12:05:30.000Z",
  "requestedBy": "admin-user",
  "summary": {
    "totalSeen": 1500,
    "totalWritten": 1480,
    "totalSkipped": 15,
    "totalFailed": 5
  },
  "sources": [
    {
      "id": "hubspot-sync-1",
      "source": "HUBSPOT",
      "mode": "FULL",
      "status": "SUCCESS",
      "recordsSeen": 500,
      "recordsWritten": 490,
      "recordsSkipped": 5,
      "recordsFailed": 5,
      "errorCode": null,
      "errorMessage": null,
      "startedAt": "2026-07-28T12:00:00.000Z",
      "finishedAt": "2026-07-28T12:02:00.000Z"
    },
    {
      "id": "stripe-sync-1",
      "source": "STRIPE",
      "mode": "INCREMENTAL",
      "status": "SUCCESS",
      "recordsSeen": 800,
      "recordsWritten": 795,
      "recordsSkipped": 5,
      "recordsFailed": 0,
      "errorCode": null,
      "errorMessage": null,
      "startedAt": "2026-07-28T12:00:00.000Z",
      "finishedAt": "2026-07-28T12:03:30.000Z"
    },
    {
      "id": "google-calendar-sync-1",
      "source": "GOOGLE_CALENDAR",
      "mode": "INCREMENTAL",
      "status": "SUCCESS",
      "recordsSeen": 200,
      "recordsWritten": 195,
      "recordsSkipped": 5,
      "recordsFailed": 0,
      "errorCode": null,
      "errorMessage": null,
      "startedAt": "2026-07-28T12:00:00.000Z",
      "finishedAt": "2026-07-28T12:05:30.000Z"
    }
  ]
}
```

**Response** (404 Not Found)
```json
{
  "error": "Not found",
  "message": "Sync run 550e8400-e29b-41d4-a716-446655440999 not found",
  "timestamp": "2026-07-28T12:00:00.000Z"
}
```

**Example** (cURL)
```bash
curl https://your-service.onrender.com/api/v1/sync-runs/550e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer YOUR_ADMIN_AUTH_TOKEN"
```

---

### Query Records

Inspect normalized records to verify sync results.

```
GET /api/v1/records?source=HUBSPOT&type=contact&externalId=12345
Authorization: Bearer YOUR_ADMIN_AUTH_TOKEN
```

**Query Parameters** (all required)
- `source` (required): Source system (HUBSPOT, STRIPE, GOOGLE_CALENDAR)
- `type` (required): Object type (contact, payment, event, etc.)
- `externalId` (required): ID from the source system

**Response** (200 OK)
```json
{
  "record": {
    "id": "ext-record-uuid",
    "source": "HUBSPOT",
    "externalObjectType": "contact",
    "externalId": "12345",
    "normalizedType": "PERSON",
    "normalizedId": "person-uuid",
    "isDeleted": false,
    "sourceUpdatedAt": "2026-07-28T11:00:00.000Z",
    "lastSeenAt": "2026-07-28T12:00:00.000Z"
  }
}
```

**Response** (400 Bad Request - Missing required parameters)
```json
{
  "error": "Bad request",
  "message": "Must specify source, type, and externalId",
  "timestamp": "2026-07-28T12:00:00.000Z"
}
```

**Response** (404 Not Found)
```json
{
  "error": "Not found",
  "timestamp": "2026-07-28T12:00:00.000Z"
}
```

**Example** (cURL)
```bash
curl "https://your-service.onrender.com/api/v1/records?source=HUBSPOT&type=contact&externalId=12345" \
  -H "Authorization: Bearer YOUR_ADMIN_AUTH_TOKEN"
```

---

## Authentication

### Bearer Token

All endpoints (except health checks) require a bearer token in the `Authorization` header:

```
Authorization: Bearer YOUR_ADMIN_AUTH_TOKEN
```

**Generate a Secure Token** (Node.js)
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Set in Environment**
```bash
export ADMIN_AUTH_TOKEN=<generated-token>
```

---

## Rate Limiting

The API enforces rate limiting to prevent abuse:

- **Limit**: 100 requests per 60 seconds per IP
- **Sliding window**: Enforced across the entire minute window
- **Response**: 429 Too Many Requests

**Rate Limit Response**
```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please retry after some time.",
  "retryAfter": 60,
  "timestamp": "2026-07-28T12:00:00.000Z"
}
```

**Behind Proxy**

If behind a reverse proxy (e.g., Render, AWS), set `TRUST_PROXY=true` so rate limiting uses `X-Forwarded-For` header.

---

## Error Handling

### Error Response Format

All errors follow this structure:

```json
{
  "error": "ERROR_CODE",
  "message": "User-friendly message",
  "code": "INTERNAL_ERROR_TYPE",
  "requestId": "req-unique-id",
  "timestamp": "2026-07-28T12:00:00.000Z",
  "details": {}
}
```

### Common Status Codes

| Code | Meaning | Cause |
|------|---------|-------|
| 200 | OK | Request succeeded |
| 202 | Accepted | Async operation accepted (sync triggered) |
| 400 | Bad Request | Invalid input (validation error) |
| 401 | Unauthorized | Missing or invalid auth token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Service not ready (database down) |

---

## Examples

### Complete Sync Workflow

```bash
#!/bin/bash

API_BASE="https://your-service.onrender.com"
AUTH_TOKEN="YOUR_ADMIN_AUTH_TOKEN"
IDEMPOTENCY_KEY=$(uuidgen)

# 1. Check service is ready
echo "1. Checking service status..."
curl -s "$API_BASE/health/ready" | jq

# 2. Trigger sync
echo "2. Triggering sync..."
SYNC_RESPONSE=$(curl -s -X POST "$API_BASE/api/v1/sync" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY")

RUN_ID=$(echo $SYNC_RESPONSE | jq -r '.runId')
echo "Sync run ID: $RUN_ID"

# 3. Poll for completion (with timeout)
echo "3. Waiting for sync to complete..."
TIMEOUT=300  # 5 minutes
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  STATUS=$(curl -s "$API_BASE/api/v1/sync-runs/$RUN_ID" \
    -H "Authorization: Bearer $AUTH_TOKEN" | jq -r '.status')
  
  if [ "$STATUS" = "COMPLETED" ] || [ "$STATUS" = "FAILED" ]; then
    echo "Sync $STATUS"
    break
  fi
  
  echo "Status: $STATUS (elapsed: ${ELAPSED}s)"
  sleep 10
  ELAPSED=$((ELAPSED + 10))
done

# 4. Get results
echo "4. Sync results:"
curl -s "$API_BASE/api/v1/sync-runs/$RUN_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq

# 5. Query a specific record
echo "5. Querying specific record..."
curl -s "$API_BASE/api/v1/records?source=HUBSPOT&type=contact&externalId=12345" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq
```

### Error Handling Example (JavaScript)

```javascript
async function triggerSync(baseUrl, authToken) {
  const response = await fetch(`${baseUrl}/api/v1/sync`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
  });

  if (response.status === 429) {
    const error = await response.json();
    console.error(`Rate limited. Retry after ${error.retryAfter} seconds`);
    throw new Error('Rate limited');
  }

  if (response.status === 401) {
    console.error('Invalid auth token');
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const error = await response.json();
    console.error(`Error: ${error.error} - ${error.message}`);
    throw new Error(error.message);
  }

  const { runId } = await response.json();
  return runId;
}
```

---

## Webhook Integration (Future)

Planned for Phase 12:
- POST `/webhooks/hubspot` - Receive HubSpot CRM updates
- POST `/webhooks/stripe` - Receive Stripe payment events
- POST `/webhooks/google-calendar` - Receive calendar event changes

---

## Support

For issues or questions:
- Check [README.md](../README.md)
- Review [DEPLOYMENT.md](./DEPLOYMENT.md)
- Check application logs
- Open GitHub issue
