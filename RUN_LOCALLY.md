# 🚀 How to Run Locally

## Prerequisites

You need to have these installed on your machine:

```bash
# Check if you have Node.js
node --version    # Should be v23 or higher

# Check if you have npm
npm --version     # Should be v10 or higher

# Check if you have PostgreSQL
psql --version    # Should be version 15 or higher
```

If any are missing, install them:
- **Node.js & npm**: https://nodejs.org/ (download LTS or v23)
- **PostgreSQL**: https://www.postgresql.org/download/

---

## Step 1: Clone Repository

```bash
git clone https://github.com/vaibhavmasaye/remoteJobAssignment.git
cd remoteJobAssignment
```

---

## Step 2: Start PostgreSQL

### macOS (using Homebrew)
```bash
# Start PostgreSQL service
brew services start postgresql@15

# Verify it's running
psql -U postgres -c "SELECT 1"
# Should output: 1
```

### Linux (Ubuntu/Debian)
```bash
# Start PostgreSQL
sudo systemctl start postgresql

# Verify
sudo -u postgres psql -c "SELECT 1"
```

### Windows
```bash
# PostgreSQL starts automatically after installation
# Verify by running:
psql -U postgres -c "SELECT 1"
```

---

## Step 3: Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# In psql prompt, run:
CREATE DATABASE sync_pipeline;
\q

# Verify
psql -l | grep sync_pipeline
# Should show: sync_pipeline | postgres
```

---

## Step 4: Install Dependencies

```bash
npm install
```

This installs all required packages including:
- Fastify (API server)
- Prisma (database ORM)
- Zod (validation)
- TypeScript
- Test framework

---

## Step 5: Setup Environment Variables

Your `.env` file is already configured. Verify it has:

```bash
cat .env | head -20
```

You should see:
```
NODE_ENV=development
PORT=3000
APP_BASE_URL=http://localhost:3000
DATABASE_URL=postgresql://...
```

**Note**: The `.env` file is already set up locally with your real credentials.

---

## Step 6: Run Database Migrations

```bash
# Generate Prisma client
npx prisma generate

# Run migrations to create tables
npx prisma migrate deploy

# Verify tables were created
psql -U postgres -d sync_pipeline -c "\dt"
# Should show all tables (SyncRun, Person, Payment, CalendarEvent, etc.)
```

---

## Step 7: Build the Project

```bash
npm run build

# Should complete with no errors
# Output: Successfully compiled
```

---

## Step 8: Run Tests

```bash
npm test

# Should show:
# ✓ tests/unit/error-classifier.test.ts (33 tests)
# ✓ tests/unit/rate-limit.test.ts (18 tests)
# Test Files  2 passed (2)
# Tests  51 passed (51)
```

---

## Step 9: Start Development Server

```bash
npm run dev

# Should output:
# Server listening on http://localhost:3000
# Database connected: sync_pipeline
```

The server is now running! Keep this terminal open.

---

## Step 10: Test Endpoints (in another terminal)

### Health Check
```bash
curl http://localhost:3000/health/live

# Response:
# {"status":"ok"}
```

### Readiness Check (database connected)
```bash
curl http://localhost:3000/health/ready

# Response:
# {"status":"ready","timestamp":"2026-07-28T..."}
```

### Trigger a Sync
```bash
curl -X POST http://localhost:3000/api/v1/sync \
  -H "Authorization: Bearer sync-pipeline-admin-key-secure-random-token-123456789abcdef" \
  -H "Content-Type: application/json"

# Response:
# {"status":"accepted","runId":"...","message":"Sync run initiated"}
```

### Check Sync Status
```bash
curl http://localhost:3000/api/v1/sync-runs \
  -H "Authorization: Bearer sync-pipeline-admin-key-secure-random-token-123456789abcdef"

# Response:
# {"runId":"...","status":"SUCCESS",...}
```

---

## Step 11: View Database (Optional)

### Option A: Prisma Studio (Recommended - Visual)
```bash
npm run prisma:studio

# Opens http://localhost:5555 in browser
# You can browse all tables and data visually
```

### Option B: psql (Command Line)
```bash
psql -U postgres -d sync_pipeline

# List all tables
\dt

# View data in a table
SELECT * FROM "Person" LIMIT 5;
SELECT * FROM "Payment" LIMIT 5;
SELECT * FROM "CalendarEvent" LIMIT 5;

# Exit
\q
```

---

## 🎯 Quick Reference Commands

```bash
# Start server
npm run dev

# Run tests
npm test

# Build
npm run build

# View database visually
npm run prisma:studio

# View database CLI
psql -U postgres -d sync_pipeline

# Start PostgreSQL (macOS)
brew services start postgresql@15

# Stop PostgreSQL (macOS)
brew services stop postgresql@15

# Check if PostgreSQL is running
psql -U postgres -c "SELECT 1"

# Stop the dev server
Ctrl+C (in the terminal)
```

---

## 🧪 Test the Full Workflow

1. **Terminal 1**: Start the server
   ```bash
   npm run dev
   ```

2. **Terminal 2**: Trigger a sync
   ```bash
   curl -X POST http://localhost:3000/api/v1/sync \
     -H "Authorization: Bearer sync-pipeline-admin-key-secure-random-token-123456789abcdef" \
     -H "Content-Type: application/json"
   ```

3. **Terminal 3**: View database changes
   ```bash
   npm run prisma:studio
   # Open http://localhost:5555
   # Click on Person, Payment, CalendarEvent tables to see synced data
   ```

---

## 🐛 Troubleshooting

### Error: "Port 3000 already in use"
```bash
# Find process using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>

# Or use different port
PORT=3001 npm run dev
```

### Error: "database sync_pipeline does not exist"
```bash
# Create database
psql -U postgres -c "CREATE DATABASE sync_pipeline;"

# Run migrations
npx prisma migrate deploy
```

### Error: "Cannot find module '@prisma/client'"
```bash
# Generate Prisma client
npx prisma generate

# Install dependencies
npm install
```

### Error: "Connect ECONNREFUSED 127.0.0.1:5432"
```bash
# PostgreSQL not running
# Start it:
brew services start postgresql@15  # macOS

# Verify:
psql -U postgres -c "SELECT 1"
```

### Error: "401 Unauthorized"
```bash
# Make sure to include the Authorization header with correct token:
curl -H "Authorization: Bearer sync-pipeline-admin-key-secure-random-token-123456789abcdef" \
  http://localhost:3000/api/v1/sync-runs
```

---

## 📊 What Gets Synced Locally?

When you run a sync locally, it fetches data from:

1. **HubSpot** → Stored in `Person` table
2. **Stripe** → Stored in `Payment` table  
3. **Google Calendar** → Stored in `CalendarEvent` table

All data is saved to your local PostgreSQL database (`sync_pipeline`).

---

## 🎯 Next: Deploy to Render

Once you've tested locally and everything works:

1. See `FINAL_DEPLOYMENT_GUIDE.md` for production deployment
2. Add 14 environment variables to Render
3. Click Redeploy

---

## ✨ Summary

**Local running in 5 steps:**

1. `brew services start postgresql@15` (start database)
2. `npm install` (install dependencies)
3. `npx prisma migrate deploy` (setup database)
4. `npm run build` (compile TypeScript)
5. `npm run dev` (start server)

**Test with:**
```bash
curl http://localhost:3000/health/live
curl -X POST http://localhost:3000/api/v1/sync \
  -H "Authorization: Bearer sync-pipeline-admin-key-secure-random-token-123456789abcdef"
```

**View data with:**
```bash
npm run prisma:studio
# Opens http://localhost:5555
```

**That's it!** 🚀
