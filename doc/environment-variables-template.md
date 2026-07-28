# Copy this file to `.env` for local development.
# Never commit `.env` or real credentials.
# In Render, add these values through Environment settings.

# -----------------------------------------------------------------------------
# Application
# -----------------------------------------------------------------------------
NODE_ENV=development
PORT=3000
APP_BASE_URL=http://localhost:3000
LOG_LEVEL=info

# Enable only for a controlled demo environment. Keep false in normal use.
ENABLE_DEMO_FAILURE_INJECTION=false

# -----------------------------------------------------------------------------
# PostgreSQL / Prisma
# -----------------------------------------------------------------------------
# Local example:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sync_pipeline?schema=public
#
# Render production:
# Use the Render PostgreSQL INTERNAL connection URL in the Web Service.
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require

# Optional direct connection used by Prisma migrations when pooling is introduced.
# For a simple Render setup this can initially match DATABASE_URL.
DIRECT_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
DB_SSL=true
DB_CONNECTION_LIMIT=5
DB_CONNECT_TIMEOUT_SECONDS=10

# -----------------------------------------------------------------------------
# Administrative API Security
# -----------------------------------------------------------------------------
# Generate at least 32 random bytes, for example:
# openssl rand -base64 48
ADMIN_API_KEY=replace-with-a-long-random-secret

# 32-byte key represented in the exact encoding expected by the implementation.
# Example generation for 32-byte hex: openssl rand -hex 32
CREDENTIAL_ENCRYPTION_KEY=replace-with-implementation-compatible-key

# Optional comma-separated proxy IP/CIDR allowlist. Leave empty if unused.
ADMIN_IP_ALLOWLIST=

# -----------------------------------------------------------------------------
# Sync Behaviour
# -----------------------------------------------------------------------------
SYNC_PAGE_SIZE=50
SYNC_MAX_RETRIES=3
SYNC_REQUEST_TIMEOUT_MS=10000
SYNC_RETRY_BASE_DELAY_MS=500
SYNC_RETRY_MAX_DELAY_MS=10000
SYNC_OVERLAP_SECONDS=300
SYNC_MAX_PAGES=1000
SYNC_LOCK_TIMEOUT_MS=1000
DEAD_LETTER_MAX_RETRIES=5

# -----------------------------------------------------------------------------
# HubSpot CRM
# -----------------------------------------------------------------------------
HUBSPOT_ENABLED=true
HUBSPOT_ACCESS_TOKEN=replace-with-hubspot-private-app-token
HUBSPOT_PORTAL_ID=replace-with-hubspot-portal-id

# Needed only when HubSpot webhooks are implemented.
HUBSPOT_CLIENT_SECRET=replace-with-hubspot-app-client-secret
HUBSPOT_WEBHOOK_ENABLED=false

# Comma-separated properties requested from HubSpot.
HUBSPOT_CONTACT_PROPERTIES=email,firstname,lastname,phone,company,hs_lastmodifieddate,createdate
HUBSPOT_PAGE_SIZE=50

# -----------------------------------------------------------------------------
# Stripe Test Mode
# -----------------------------------------------------------------------------
STRIPE_ENABLED=true
STRIPE_SECRET_KEY=sk_test_replace_me
STRIPE_WEBHOOK_SECRET=whsec_replace_me
STRIPE_WEBHOOK_ENABLED=true
STRIPE_API_VERSION=
STRIPE_PAGE_SIZE=50

# Number of recent hours/days to reconcile, depending on implementation.
STRIPE_RECONCILIATION_LOOKBACK_HOURS=24

# -----------------------------------------------------------------------------
# Google Calendar OAuth and Sync
# -----------------------------------------------------------------------------
GOOGLE_CALENDAR_ENABLED=true
GOOGLE_CLIENT_ID=replace-with-google-oauth-client-id
GOOGLE_CLIENT_SECRET=replace-with-google-oauth-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
GOOGLE_REFRESH_TOKEN=replace-with-google-refresh-token
GOOGLE_CALENDAR_ID=primary
GOOGLE_CALENDAR_PAGE_SIZE=100

# Used to validate Google notification channels if push notifications are enabled.
GOOGLE_WEBHOOK_ENABLED=false
GOOGLE_WEBHOOK_TOKEN=replace-with-a-long-random-channel-token
GOOGLE_WEBHOOK_CHANNEL_ID=replace-with-a-unique-channel-id

# Full-sync time boundary. Leave blank to use implementation default.
GOOGLE_CALENDAR_TIME_MIN=

# -----------------------------------------------------------------------------
# HTTP, CORS, Rate Limiting, and Request Limits
# -----------------------------------------------------------------------------
# Comma-separated allowed browser origins. curl/Postman do not require CORS.
CORS_ALLOWED_ORIGINS=http://localhost:3000
REQUEST_BODY_LIMIT_BYTES=1048576
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
TRUST_PROXY=true

# -----------------------------------------------------------------------------
# Observability
# -----------------------------------------------------------------------------
LOG_REDACT_PATHS=req.headers.authorization,req.headers.cookie,res.headers.set-cookie,config.DATABASE_URL
HEALTH_CHECK_DATABASE=true

# Optional external error tracking. Leave blank if not used.
SENTRY_DSN=

# -----------------------------------------------------------------------------
# Render Deployment Notes (comments only)
# -----------------------------------------------------------------------------
# Render build command example:
#   npm ci && npx prisma generate && npm run build
#
# Render start command example:
#   npx prisma migrate deploy && npm run start
#
# Production values to update after deployment:
# APP_BASE_URL=https://YOUR-SERVICE.onrender.com
# GOOGLE_REDIRECT_URI=https://YOUR-SERVICE.onrender.com/auth/google/callback
# HubSpot webhook: https://YOUR-SERVICE.onrender.com/webhooks/hubspot
# Stripe webhook:  https://YOUR-SERVICE.onrender.com/webhooks/stripe
# Google webhook:  https://YOUR-SERVICE.onrender.com/webhooks/google-calendar
