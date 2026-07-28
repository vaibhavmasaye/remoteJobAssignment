# 🚨 REQUIRED: Add Environment Variables to Render

**Your app is exiting with status 128 because environment variables are NOT SET on Render!**

## ✅ HOW TO FIX (5 minutes)

### Step 1: Go to Render Dashboard
- Go to: https://dashboard.render.com
- Click your service: **sync-pipeline-api**
- Click **Environment** tab

### Step 2: Copy These from Your Local `.env` File

Open your local `.env` file and COPY the VALUES for these 14 variables:

```
DATABASE_URL=             (get from your .env)
DIRECT_URL=              (get from your .env)
ADMIN_API_KEY=           (get from your .env)
CREDENTIAL_ENCRYPTION_KEY= (get from your .env)
HUBSPOT_ACCESS_TOKEN=    (get from your .env)
HUBSPOT_PORTAL_ID=       (get from your .env)
HUBSPOT_CLIENT_SECRET=   (get from your .env)
STRIPE_SECRET_KEY=       (get from your .env)
GOOGLE_CLIENT_ID=        (get from your .env)
GOOGLE_CLIENT_SECRET=    (get from your .env)
GOOGLE_REFRESH_TOKEN=    (get from your .env)
```

### Step 3: Add to Render

In Render dashboard Environment settings, add:

```
NODE_ENV = production
PORT = 3000
APP_BASE_URL = https://YOUR_RENDER_URL.onrender.com
LOG_LEVEL = info
ADMIN_IP_ALLOWLIST = *
HEALTH_CHECK_DATABASE = true
TRUST_PROXY = true
```

Then add the 11 variables from your local `.env` file

### Step 4: Redeploy

Click **⋯** → **Manual Deploy** or **Redeploy**

---

## 🔍 What to Look For in Logs

After redeploy, check **Logs** tab. You should see:

```
[STARTUP] ================================
[STARTUP] Application starting...
[STARTUP] ================================
[STARTUP] Checking critical environment variables:
[STARTUP] ✅ SET: DATABASE_URL
[STARTUP] ✅ SET: ADMIN_API_KEY
[STARTUP] ✅ SET: CREDENTIAL_ENCRYPTION_KEY
[STARTUP] Loading config...
[STARTUP] Creating app...
[STARTUP] ✅✅✅ SERVER STARTED ✅✅✅
```

---

## ❌ If You See This:

```
[STARTUP] ❌ MISSING: DATABASE_URL
[STARTUP] ❌❌❌ CRITICAL: Environment variables missing!
```

Then you didn't add all the variables. Go back to Step 2-3 and add them.

---

## 📋 YOUR LOCAL `.env` VALUES

Read your `.env` file at:
`/Users/vaibhavmasaye/Desktop/New assignment /remoteJobAssignment/.env`

Copy these exact values to Render:
- `DATABASE_URL=` → Copy the full value
- `ADMIN_API_KEY=` → Copy the full value  
- `CREDENTIAL_ENCRYPTION_KEY=` → Copy the full value
- etc.

---

**Once you add these and redeploy, the app should start successfully!**
