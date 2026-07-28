# Local Setup Guide - PostgreSQL & Development Environment

## Step 1: Install PostgreSQL Locally

### macOS (using Homebrew)
```bash
# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL service
brew services start postgresql@15

# Verify installation
psql --version
# Output: psql (PostgreSQL) 15.x
```

### Linux (Ubuntu/Debian)
```bash
# Install PostgreSQL
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql

# Verify
sudo -u postgres psql --version
```

### Windows
1. Download installer from https://www.postgresql.org/download/windows/
2. Run installer (postgresql-15.x-windows-x86_64.exe)
3. Choose default settings, remember the password
4. PostgreSQL starts automatically

---

## Step 2: Create Database & User

### Connect to PostgreSQL
```bash
# macOS/Linux
psql postgres

# Windows (from PostgreSQL command line)
psql -U postgres
```

### Create Database and User
```sql
-- Create database
CREATE DATABASE sync_pipeline;

-- Create user
CREATE USER sync_user WITH PASSWORD 'sync_password';

-- Grant privileges
ALTER ROLE sync_user SET client_encoding TO 'utf8';
ALTER ROLE sync_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE sync_user SET default_transaction_deferrable TO on;
ALTER ROLE sync_user SET default_transaction_read_only TO off;
GRANT ALL PRIVILEGES ON DATABASE sync_pipeline TO sync_user;

-- Connect to database
\c sync_pipeline

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO sync_user;

-- Verify
\du
\l
```

### Exit PostgreSQL
```
\q
```

---

## Step 3: Update Environment Variables

Your `.env` file is already configured. Verify:

```bash
cat .env | grep DATABASE_URL
# Output: DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sync_pipeline?sslmode=disable
```

If using custom user/password, update `.env`:
```bash
DATABASE_URL=postgresql://sync_user:sync_password@localhost:5432/sync_pipeline?sslmode=disable
DIRECT_URL=postgresql://sync_user:sync_password@localhost:5432/sync_pipeline?sslmode=disable
```

---

## Step 4: Run Database Migrations

```bash
# Navigate to project directory
cd /Users/vaibhavmasaye/Desktop/New\ assignment\ /remoteJobAssignment

# Run Prisma migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Verify tables were created
npx prisma db push
```

### Expected Output
```
Datasource "db": PostgreSQL database "sync_pipeline" on "localhost:5432"

Applying migration: `20240101000000_init_schema`

Migration complete!
```

---

## Step 5: Verify Database Setup

### Option A: Using Prisma Studio (Visual)
```bash
npm run prisma:studio
# Opens http://localhost:5555 in browser
# You can see and edit all tables visually
```

### Option B: Using psql (Command Line)
```bash
psql postgresql://postgres:postgres@localhost:5432/sync_pipeline

# View tables
\dt

# View table structure
\d "SyncRun"

# Count records
SELECT COUNT(*) FROM "SyncRun";

# Exit
\q
```

---

## Step 6: Start Development Server

```bash
# Install dependencies (if not done)
npm install

# Start dev server
npm run dev

# Expected output:
# Server running at http://localhost:3000
# Connected to database: sync_pipeline
```

### Test Health Endpoints
```bash
# In another terminal:

# Liveness check
curl http://localhost:3000/health/live
# Response: {"status":"ok"}

# Readiness check (database connection)
curl http://localhost:3000/health/ready
# Response: {"status":"ready","timestamp":"2026-07-28T..."}
```

---

## Step 7: Verify All Integrations

### 1. Test HubSpot Connection
```bash
# Check if access token is valid
curl https://api.hubapi.com/crm/v3/objects/contacts \
  -H "Authorization: Bearer YOUR_HUBSPOT_API_TOKEN" \
  -H "Content-Type: application/json"
```

### 2. Test Google Calendar Connection
```bash
# The token should work for reading calendar events
# Full test requires running sync endpoint
```

### 3. Trigger First Sync
```bash
curl -X POST http://localhost:3000/api/v1/sync \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json"

# Response:
# {"status":"accepted","runId":"...","message":"Sync run initiated"}
```

---

## Step 8: Monitor Sync Progress

```bash
# Get sync run ID from previous response, then:

curl http://localhost:3000/api/v1/sync-runs/:runId \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY"

# Check all runs
curl http://localhost:3000/api/v1/sync-runs \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY"
```

---

## Troubleshooting

### PostgreSQL Connection Refused
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution**:
1. Verify PostgreSQL is running: `brew services list` (macOS)
2. Start PostgreSQL: `brew services start postgresql@15`
3. Check port: `lsof -i :5432`

### Database Does Not Exist
```
Error: database "sync_pipeline" does not exist
```

**Solution**:
1. Connect to postgres: `psql postgres`
2. Create database: `CREATE DATABASE sync_pipeline;`
3. Re-run migrations: `npx prisma migrate deploy`

### Permission Denied
```
Error: role "sync_user" does not exist
```

**Solution**:
1. Use default postgres user in .env: `postgres:postgres@localhost`
2. Or create user first (see Step 2)

### Prisma Client Not Generated
```
Error: Can't find module '@prisma/client'
```

**Solution**:
```bash
npx prisma generate
npm install
```

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

---

## Useful Commands

### PostgreSQL Management
```bash
# Connect to specific database
psql postgresql://postgres:postgres@localhost:5432/sync_pipeline

# List all databases
psql -l

# Backup database
pg_dump sync_pipeline > backup.sql

# Restore from backup
psql sync_pipeline < backup.sql

# Drop database
dropdb sync_pipeline
```

### Prisma Commands
```bash
# Run pending migrations
npx prisma migrate deploy

# Create new migration
npx prisma migrate dev --name add_new_table

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Generate Prisma client
npx prisma generate

# Open Prisma Studio
npm run prisma:studio

# Validate schema
npx prisma validate
```

### Project Commands
```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run tests with watch mode
npm run test:watch

# Lint code
npm run lint

# Format code
npm run format
```

---

## Next Steps

1. ✅ PostgreSQL installed and running
2. ✅ Database created (sync_pipeline)
3. ✅ Environment variables configured
4. ✅ API running on localhost:3000
5. ✅ Migrations applied

### Try These:
- View database in Prisma Studio: `npm run prisma:studio`
- Run first sync: `curl -X POST http://localhost:3000/api/v1/sync ...`
- Check results: `npm run prisma:studio` → inspect SyncRun table
- Monitor logs: Watch server output for sync progress

---

## Quick Reference

| Task | Command |
|------|---------|
| Start PostgreSQL | `brew services start postgresql@15` |
| Create database | `psql postgres` then `CREATE DATABASE sync_pipeline;` |
| Start dev server | `npm run dev` |
| View database | `npm run prisma:studio` |
| Run migrations | `npx prisma migrate deploy` |
| Run tests | `npm test` |
| Check health | `curl http://localhost:3000/health/ready` |
| Trigger sync | `curl -X POST http://localhost:3000/api/v1/sync ...` |

---

## Support

If you encounter issues:
1. Check PostgreSQL is running: `brew services list`
2. Verify database exists: `psql -l`
3. Check .env file is correct: `cat .env | head -20`
4. View server logs: Watch npm run dev output
5. Check database: `npm run prisma:studio`

For detailed documentation:
- PostgreSQL: https://www.postgresql.org/docs/
- Prisma: https://www.prisma.io/docs/
- Project: See README.md and doc/API.md
