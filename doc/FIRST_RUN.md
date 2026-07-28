# First Run Guide - Get Started in 5 Minutes

## 🎯 Goal
Run the Sync Pipeline locally with your credentials (HubSpot, Google Calendar, PostgreSQL).

---

## ✅ Prerequisites

Before starting, verify you have:
- ✅ Node.js 23+ installed (`node --version`)
- ✅ PostgreSQL installed (or install via `brew install postgresql@15`)
- ✅ Your credentials (set in `.env`):
  - HubSpot API token (from your app dashboard)
  - Google Calendar OAuth credentials
  - Admin key (already configured)

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Start PostgreSQL (1 min)

**macOS:**
```bash
brew services start postgresql@15
# Verify: pg_isready -h localhost
```

**Linux:**
```bash
sudo systemctl start postgresql
# Verify: sudo -u postgres pg_isready
```

**Windows:**
- PostgreSQL should auto-start after installation
- Verify: Open "Services" app, look for "postgresql-15"

**Verify PostgreSQL is running:**
```bash
psql -U postgres -c "SELECT 1"
# Should output: 1
```

### Step 2: Create Database (1 min)

```bash
# Create database named 'sync_pipeline'
psql -U postgres << EOF
CREATE DATABASE sync_pipeline;
\q
EOF

# Verify
psql -l | grep sync_pipeline
# Should show: sync_pipeline | postgres
```

### Step 3: Install & Migrate (1 min)

```bash
cd /Users/vaibhavmasaye/Desktop/New\ assignment\ /remoteJobAssignment

# Install dependencies
npm install

# Run migrations
npx prisma migrate deploy

# Generate client
npx prisma generate
```

### Step 4: Start Development Server (1 min)

```bash
npm run dev

# Expected output:
# Server listening on http://localhost:3000
# Database connected: sync_pipeline
```

### Step 5: Test It Works (1 min)

In a new terminal:

```bash
# Test health check
curl http://localhost:3000/health/ready

# Should respond:
# {"status":"ready","timestamp":"2026-07-28T..."}
```

---

## 🎪 Try Your First Sync

Once server is running:

```bash
# Trigger sync of all sources
curl -X POST http://localhost:3000/api/v1/sync \
  -H "Authorization: Bearer sync-pipeline-admin-key-secure-random-token-123456789abcdef" \
  -H "Content-Type: application/json"

# Response:
# {"status":"accepted","runId":"550e8400-...","message":"Sync run initiated"}
```

Get the `runId` and check results:

```bash
# Replace with your runId
curl http://localhost:3000/api/v1/sync-runs/550e8400-... \
  -H "Authorization: Bearer sync-pipeline-admin-key-secure-random-token-123456789abcdef"

# Response shows sync status, source results, record counts
```

---

## 📊 View Database Results

### Option 1: Prisma Studio (Easiest)

```bash
npm run prisma:studio

# Opens http://localhost:5555 in browser
# Click on tables to explore data
```

### Option 2: Command Line

```bash
psql postgresql://postgres:postgres@localhost:5432/sync_pipeline

# View all tables
\dt

# Count records synced
SELECT table_name, COUNT(*) as record_count 
FROM information_schema.tables 
WHERE table_schema = 'public'
GROUP BY table_name;

# Exit
\q
```

---

## 🔍 Verify Each Integration

### HubSpot
```bash
# Check if token works
curl https://api.hubapi.com/crm/v3/objects/contacts/search \
  -H "Authorization: Bearer YOUR_HUBSPOT_API_TOKEN" \
  -H "Content-Type: application/json"

# Should return contacts or {"objects":[]}
```

### Google Calendar
```bash
# Token is already verified in .env
# First sync will test it automatically
# Check for errors in server logs
```

### Database
```bash
# Already tested via health check
# Verified via Prisma Studio
```

---

## 📚 Common Tasks

### View Sync Logs
```bash
# Logs print to console in development
# Look for:
#   - "Sync requested"
#   - "Source sync started"
#   - "Records written"
#   - "Sync completed"
```

### Stop the Server
```bash
# Press Ctrl+C in the terminal
```

### Check What's Running
```bash
# Verify server
curl http://localhost:3000/api/v1/status

# Verify database
pg_isready -h localhost

# See running processes
lsof -i :3000  # Node server
lsof -i :5432  # PostgreSQL
```

### Stop PostgreSQL
```bash
brew services stop postgresql@15  # macOS
# or
sudo systemctl stop postgresql    # Linux
```

---

## ⚠️ Troubleshooting

### Error: "connect ECONNREFUSED"
```
Solution: PostgreSQL not running
brew services start postgresql@15
```

### Error: "database sync_pipeline does not exist"
```
Solution: Create database first
psql -U postgres -c "CREATE DATABASE sync_pipeline;"
```

### Error: "Unknown auth strategy"
```
Solution: .env file not loaded properly
- Make sure .env is in project root
- Restart: npm run dev
```

### Error: "Port 3000 already in use"
```
Solution: Kill existing process
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

### Server starts but can't connect to DB
```
Solution: Check DATABASE_URL in .env
Should be: postgresql://postgres:postgres@localhost:5432/sync_pipeline

Verify connection:
psql postgresql://postgres:postgres@localhost:5432/sync_pipeline
```

---

## 🎯 Next Steps

1. ✅ Server is running on localhost:3000
2. ✅ Database is connected
3. ✅ Credentials are configured

### Try These:
- **Trigger sync**: POST /api/v1/sync
- **Check status**: GET /api/v1/sync-runs
- **View database**: npm run prisma:studio
- **Run tests**: npm test
- **Check logs**: Watch server output

### Learn More:
- **API**: Read doc/API.md
- **Architecture**: Read doc/ARCHITECTURE.md
- **Full Setup**: Read doc/LOCAL_SETUP.md

---

## 💡 Tips

1. **Keep a terminal open** for server logs
2. **Use Prisma Studio** to explore database visually
3. **Check logs** when sync fails
4. **Test endpoints** with provided curl examples
5. **Read documentation** for detailed info

---

## 📞 Support

If you get stuck:
1. Check LOCAL_SETUP.md (detailed guide)
2. Check API.md (endpoint reference)
3. Check ARCHITECTURE.md (system design)
4. Review server logs (npm run dev output)
5. Check database (npm run prisma:studio)

**Most issues are due to:**
- PostgreSQL not running → `brew services start postgresql@15`
- Database not created → `psql -U postgres -c "CREATE DATABASE sync_pipeline;"`
- .env not configured → Verify credentials are set
- Port already in use → Kill process: `lsof -ti:3000 | xargs kill -9`

---

**You're all set! Happy syncing! 🎉**
