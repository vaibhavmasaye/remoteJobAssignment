# 🚀 Render Environment Setup - Copy & Paste Ready

## ✅ REQUIRED Variables (For Assignment)

**Copy these 16 variables to Render Dashboard** (get actual values from your `.env` file):

```
NODE_ENV=production
PORT=3000
APP_BASE_URL=https://sync-pipeline.onrender.com
LOG_LEVEL=info
ENABLE_DEMO_FAILURE_INJECTION=false

DATABASE_URL=YOUR_RENDER_DATABASE_URL_FROM_ENV
DIRECT_URL=YOUR_RENDER_DATABASE_URL_FROM_ENV
DB_SSL=true

ADMIN_API_KEY=YOUR_ADMIN_API_KEY_FROM_ENV
CREDENTIAL_ENCRYPTION_KEY=YOUR_CREDENTIAL_ENCRYPTION_KEY_FROM_ENV
ADMIN_IP_ALLOWLIST=*

HUBSPOT_ACCESS_TOKEN=YOUR_HUBSPOT_ACCESS_TOKEN_FROM_ENV
HUBSPOT_CLIENT_SECRET=YOUR_HUBSPOT_CLIENT_SECRET_FROM_ENV
HUBSPOT_PORTAL_ID=YOUR_HUBSPOT_PORTAL_ID_FROM_ENV

GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_FROM_ENV
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET_FROM_ENV
GOOGLE_REFRESH_TOKEN=YOUR_GOOGLE_REFRESH_TOKEN_FROM_ENV
GOOGLE_CALENDAR_ID=primary

CORS_ALLOWED_ORIGINS=https://sync-pipeline.onrender.com
TRUST_PROXY=true
HEALTH_CHECK_DATABASE=true
```

> **💡 Important**: Copy the actual values from your local `.env` file for all `YOUR_*` placeholders above. Never commit `.env` to Git.

---

## ❌ DO NOT ADD These (Optional - Leave Empty)

These are NOT required for the assignment:

| Variable | Why Not Needed |
|----------|----------------|
| `STRIPE_SECRET_KEY` | Not part of assignment (HubSpot + Google Calendar only) |
| `STRIPE_WEBHOOK_SECRET` | Not part of assignment |
| `GOOGLE_WEBHOOK_TOKEN` | Webhook push notifications - optional |
| `GOOGLE_WEBHOOK_CHANNEL_ID` | Webhook push notifications - optional |
| `GOOGLE_CALENDAR_TIME_MIN` | Optional event filtering |
| `SENTRY_DSN` | Optional error tracking |
| `HUBSPOT_WEBHOOK_ENABLED` | Set to false in code |
| `STRIPE_ENABLED` | Will be skipped without API keys |

---

## 📋 Quick Setup Steps

1. **Go to**: https://dashboard.render.com
2. **Click**: Your service → **Environment**
3. **Add each variable** from the REQUIRED list above
4. **Click**: Save Changes
5. **Click**: Redeploy
6. **Wait** for deployment (about 1-2 minutes)
7. **Check** logs for: `Server listening on http://0.0.0.0:10000`
8. **Test**: 
   ```bash
   curl https://sync-pipeline.onrender.com/health/live
   ```

---

## ✨ That's it!

You now have:
- ✅ HubSpot integration enabled
- ✅ Google Calendar integration enabled  
- ✅ PostgreSQL database connected
- ✅ API authentication working
- ✅ Rate limiting & security enabled

**All ready for production!** 🎉

---

## 🧪 Test Your Deployment

Once deployed, try these:

```bash
# Test health check
curl https://sync-pipeline.onrender.com/health/live

# Test readiness (checks database)
curl https://sync-pipeline.onrender.com/health/ready

# Trigger a sync (replace with your actual key if different)
curl -X POST https://sync-pipeline.onrender.com/api/v1/sync \
  -H "Authorization: Bearer sync-pipeline-admin-key-secure-random-token-123456789abcdef" \
  -H "Content-Type: application/json"
```

---

## 📊 What Gets Synced?

With these variables configured:

| Source | What Syncs |
|--------|-----------|
| **HubSpot** | Contacts (email, name, phone, company) |
| **Google Calendar** | Calendar events (title, time, attendees) |
| **Stripe** | ❌ Disabled (no key provided) |
| **Database** | All synced data stored in PostgreSQL |

---

## 🆘 If Something Goes Wrong

**Check the logs** in Render:
1. Go to Render Dashboard
2. Click your service
3. Click **Logs** tab
4. Look for error messages

**Common issues:**
- `DATABASE_URL` missing → Add it to Environment
- `Cannot find module` → Wait for redeploy to finish
- `Port already in use` → Render assigns port automatically, don't worry
- `Connection refused` → Database might be down, check Render PostgreSQL service

---

## 🎯 Assignment Complete

You've now deployed:
- ✅ Multi-source sync pipeline
- ✅ HubSpot, Google Calendar, PostgreSQL integration  
- ✅ REST API with authentication
- ✅ Rate limiting & security
- ✅ Health checks & monitoring
- ✅ Production-ready Docker deployment

**Enjoy your synced data!** 🚀
