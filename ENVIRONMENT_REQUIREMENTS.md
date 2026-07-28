# 🔍 Environment Variables - What's TRULY Required?

## Executive Summary

| Category | Status | Can Project Run? |
|----------|--------|------------------|
| **Minimal Setup** | ✅ Only 2 REQUIRED values | YES - will start |
| **Full Setup** | ✅ 9 values needed for all integrations | YES - fully functional |
| **Optional Enhancements** | ⚠️ Webhooks, error tracking | NO - not required |

---

## 🚀 MINIMUM TO RUN THE PROJECT

**You MUST provide these 2 values, everything else has defaults:**

```
1. DATABASE_URL=postgresql://...
2. ADMIN_API_KEY=<32+ chars>
```

> **That's it!** The project will start with just these 2.

### Why Only These 2?

- `DATABASE_URL` → No default, project needs somewhere to store data
- `ADMIN_API_KEY` → No default, required for authentication (min 32 chars)
- Everything else → Has sensible defaults or is optional

---

## 📊 Complete Analysis by Category

### 1. APPLICATION CONFIG (All Have Defaults)
✅ **Can Skip - Will Use Defaults**

| Variable | Default | Required? |
|----------|---------|-----------|
| `NODE_ENV` | `development` | ❌ Can skip |
| `PORT` | `3000` | ❌ Can skip |
| `APP_BASE_URL` | `http://localhost:3000` | ❌ Can skip |
| `LOG_LEVEL` | `info` | ❌ Can skip |
| `ENABLE_DEMO_FAILURE_INJECTION` | `false` | ❌ Can skip |

---

### 2. DATABASE (1 Required, 1 Optional)
⚠️ **DATABASE_URL is REQUIRED**

| Variable | Required? | If Missing |
|----------|-----------|-----------|
| `DATABASE_URL` | ✅ **YES** | ❌ Project **CRASHES** |
| `DIRECT_URL` | ❌ Optional | ✅ Uses `DATABASE_URL` as fallback |
| `DB_SSL` | ❌ Default `true` | ✅ Fine |
| `DB_CONNECTION_LIMIT` | ❌ Default `5` | ✅ Fine |
| `DB_CONNECT_TIMEOUT_SECONDS` | ❌ Default `10` | ✅ Fine |

---

### 3. SECURITY (1 Required, 1 Optional)
⚠️ **ADMIN_API_KEY is REQUIRED**

| Variable | Required? | If Missing |
|----------|-----------|-----------|
| `ADMIN_API_KEY` | ✅ **YES** | ❌ Project **CRASHES** |
| `CREDENTIAL_ENCRYPTION_KEY` | ✅ **YES** | ❌ Project **CRASHES** |
| `ADMIN_IP_ALLOWLIST` | ❌ Optional | ✅ Empty = no IP restrictions |

---

### 4. HUBSPOT INTEGRATION (All Optional)
✅ **Can Skip - Will Disable HubSpot Sync**

| Variable | Required? | If Missing |
|----------|-----------|-----------|
| `HUBSPOT_ENABLED` | ❌ Default `true` | ⚠️ Will try to sync but fail gracefully |
| `HUBSPOT_ACCESS_TOKEN` | ❌ Optional | ✅ HubSpot sync disabled |
| `HUBSPOT_CLIENT_SECRET` | ❌ Optional | ✅ HubSpot sync disabled |
| `HUBSPOT_PORTAL_ID` | ❌ Optional | ✅ HubSpot sync disabled |

**To Disable HubSpot**: Set `HUBSPOT_ENABLED=false`

---

### 5. STRIPE INTEGRATION (All Optional)
✅ **Can Skip - Will Disable Stripe Sync**

| Variable | Required? | If Missing |
|----------|-----------|-----------|
| `STRIPE_ENABLED` | ❌ Default `true` | ⚠️ Will try to sync but fail gracefully |
| `STRIPE_SECRET_KEY` | ❌ Optional | ✅ Stripe sync disabled |
| `STRIPE_WEBHOOK_SECRET` | ❌ Optional | ✅ Webhooks won't work |

**To Disable Stripe**: Set `STRIPE_ENABLED=false`

---

### 6. GOOGLE CALENDAR INTEGRATION (Most Optional)
⚠️ **Need 3 Values for Google Calendar to Work**

| Variable | Required? | If Missing |
|----------|-----------|-----------|
| `GOOGLE_CALENDAR_ENABLED` | ❌ Default `true` | ⚠️ Will try to sync but fail |
| `GOOGLE_CLIENT_ID` | ❌ Optional | ✅ Google Calendar disabled |
| `GOOGLE_CLIENT_SECRET` | ❌ Optional | ✅ Google Calendar disabled |
| `GOOGLE_REFRESH_TOKEN` | ❌ Optional | ✅ Google Calendar disabled |
| `GOOGLE_CALENDAR_ID` | ❌ Default `primary` | ✅ Fine |

**To Use Google Calendar**: Need all 3 (CLIENT_ID + CLIENT_SECRET + REFRESH_TOKEN)
**To Disable**: Set `GOOGLE_CALENDAR_ENABLED=false`

---

### 7. WEBHOOK & OBSERVABILITY (All Optional)
✅ **Can Skip - Nice to Have**

| Variable | Required? | If Missing |
|----------|-----------|-----------|
| `GOOGLE_WEBHOOK_TOKEN` | ❌ Optional | ✅ Push notifications won't work |
| `GOOGLE_WEBHOOK_CHANNEL_ID` | ❌ Optional | ✅ Push notifications won't work |
| `GOOGLE_CALENDAR_TIME_MIN` | ❌ Optional | ✅ Syncs all events |
| `SENTRY_DSN` | ❌ Optional | ✅ Errors only in console logs |
| `LOG_REDACT_PATHS` | ❌ Optional | ✅ All data logged (less secure) |

---

## 🎯 THREE SETUP SCENARIOS

### SCENARIO 1: Minimal Setup (Just Testing)
**Minimum 2 variables needed:**

```env
DATABASE_URL=postgresql://...
ADMIN_API_KEY=<32+ char secure key>
```

**Result:**
- ✅ Server starts
- ✅ API is accessible
- ✅ Database works
- ❌ No data syncing (HubSpot, Google Calendar disabled by defaults when creds missing)

---

### SCENARIO 2: Assignment Submission (HubSpot + Google Calendar)
**Minimum 9 variables needed:**

```env
DATABASE_URL=postgresql://...
ADMIN_API_KEY=<32+ chars>
CREDENTIAL_ENCRYPTION_KEY=<32+ chars>

HUBSPOT_ACCESS_TOKEN=...
HUBSPOT_CLIENT_SECRET=...
HUBSPOT_PORTAL_ID=...

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
```

**Result:**
- ✅ Server starts
- ✅ API works
- ✅ HubSpot sync works
- ✅ Google Calendar sync works
- ✅ All data stored in PostgreSQL

---

### SCENARIO 3: Production (Full Setup)
**21+ variables recommended:**

All from SCENARIO 2 + optional ones:
- SENTRY_DSN (error tracking)
- GOOGLE_WEBHOOK_TOKEN (push notifications)
- LOG_REDACT_PATHS (security logging)
- etc.

---

## ❌ What Happens if Values Are Missing?

### If `DATABASE_URL` is Missing:
```
Error: Configuration validation failed
Error: DATABASE_URL - Expected a valid URL
Process exits with code 1 ❌
```

### If `ADMIN_API_KEY` is Missing:
```
Error: Configuration validation failed
Error: ADMIN_API_KEY - Must be at least 32 characters
Process exits with code 1 ❌
```

### If `HUBSPOT_ACCESS_TOKEN` is Missing (but HUBSPOT_ENABLED=true):
```
✅ Server starts fine
❌ HubSpot sync fails at runtime with auth error
```

### If `GOOGLE_REFRESH_TOKEN` is Missing (but GOOGLE_CALENDAR_ENABLED=true):
```
✅ Server starts fine
❌ Google Calendar sync fails at runtime with auth error
```

---

## ✅ For Your Render Deployment

### Minimum to Deploy (Project Will Run):
```
DATABASE_URL
ADMIN_API_KEY
CREDENTIAL_ENCRYPTION_KEY
NODE_ENV=production
```

### Recommended to Deploy (Full Sync):
```
# Required
DATABASE_URL
ADMIN_API_KEY
CREDENTIAL_ENCRYPTION_KEY
NODE_ENV=production

# HubSpot (recommended)
HUBSPOT_ACCESS_TOKEN
HUBSPOT_CLIENT_SECRET
HUBSPOT_PORTAL_ID

# Google Calendar (recommended)
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REFRESH_TOKEN

# Optional but nice
LOG_LEVEL=info
CORS_ALLOWED_ORIGINS
TRUST_PROXY=true
HEALTH_CHECK_DATABASE=true
```

---

## 🧪 Quick Test

### Verify Your Setup:
```bash
# Check if DATABASE_URL is set
echo $DATABASE_URL

# Check if ADMIN_API_KEY is 32+ chars
echo ${#ADMIN_API_KEY}  # Should be >= 32

# Try starting the app
npm run dev
```

### Expected Output if Successful:
```
Server listening on http://0.0.0.0:3000
Connected to database: sync_pipeline03
```

---

## 🚨 Common Mistakes

❌ **MISTAKE 1**: Forgetting DATABASE_URL
```
Result: Project CRASHES immediately
Fix: Add DATABASE_URL to .env
```

❌ **MISTAKE 2**: ADMIN_API_KEY < 32 characters
```
Result: Project CRASHES on startup
Fix: Make it 32+ chars (use `openssl rand -hex 16`)
```

❌ **MISTAKE 3**: Empty GOOGLE_REFRESH_TOKEN but GOOGLE_CALENDAR_ENABLED=true
```
Result: Project starts, but sync fails
Fix: Either add token or set GOOGLE_CALENDAR_ENABLED=false
```

✅ **CORRECT**: Provide required values, optional ones can be empty
```
Result: Project runs perfectly
```

---

## 📋 Summary Table

| Variable | Truly Required? | Why |
|----------|-----------------|-----|
| `DATABASE_URL` | ✅ YES | No data storage = no project |
| `ADMIN_API_KEY` | ✅ YES | Authentication required (32+ chars) |
| `CREDENTIAL_ENCRYPTION_KEY` | ✅ YES | Data encryption required |
| `HUBSPOT_ACCESS_TOKEN` | ❌ NO | Optional - can disable |
| `HUBSPOT_CLIENT_SECRET` | ❌ NO | Optional - can disable |
| `HUBSPOT_PORTAL_ID` | ❌ NO | Optional - can disable |
| `GOOGLE_CLIENT_ID` | ❌ NO | Optional - can disable |
| `GOOGLE_CLIENT_SECRET` | ❌ NO | Optional - can disable |
| `GOOGLE_REFRESH_TOKEN` | ❌ NO | Optional - can disable |
| Everything Else | ❌ NO | Sensible defaults provided |

---

## 🎯 Action Items for Render

1. **MUST SET** (3 values):
   - DATABASE_URL
   - ADMIN_API_KEY
   - CREDENTIAL_ENCRYPTION_KEY

2. **SHOULD SET** (6 values for full functionality):
   - HUBSPOT_ACCESS_TOKEN
   - HUBSPOT_CLIENT_SECRET
   - HUBSPOT_PORTAL_ID
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET
   - GOOGLE_REFRESH_TOKEN

3. **NICE TO SET** (optional):
   - NODE_ENV=production
   - LOG_LEVEL=info
   - Everything else has defaults

**That's it! 🚀**
