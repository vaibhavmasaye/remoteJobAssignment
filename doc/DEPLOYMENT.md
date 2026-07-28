# Deployment Guide

This guide covers deploying the Sync Pipeline API to Render.

## Prerequisites

- Render account (free tier available at https://render.com)
- GitHub repository with this code
- PostgreSQL database (can use Render's PostgreSQL service or external provider)
- API credentials for HubSpot, Stripe, and Google Calendar

## Quick Start: Deploy to Render

### 1. Prepare Your Repository

Push your code to GitHub:

```bash
git push origin main
```

### 2. Create Render Account and Connect GitHub

1. Go to https://render.com and sign up
2. Click "Connect GitHub" and authorize Render
3. Select your repository

### 3. Create Web Service

1. In Render dashboard, click "New +" → "Web Service"
2. Connect your repository
3. Fill in the configuration:
   - **Name**: `sync-pipeline-api`
   - **Environment**: Docker
   - **Dockerfile Path**: `./Dockerfile`
   - **Start Command**: (leave blank, using Dockerfile CMD)
   - **Region**: Choose closest to your location (Oregon recommended)
   - **Plan**: Free (for testing/demo)

### 4. Configure Environment Variables

Add the following environment variables in Render dashboard (Settings → Environment):

**Non-sensitive:**
```
NODE_ENV=production
PORT=3000
TRUST_PROXY=true
LOG_LEVEL=info
REQUEST_BODY_LIMIT_BYTES=1048576
HEALTH_CHECK_DATABASE=false
SYNC_RUN_CORRELATION_ID_LENGTH=16
```

**Sensitive (add as secrets):**
```
DATABASE_URL=postgresql://user:password@host:5432/sync_pipeline
ADMIN_AUTH_TOKEN=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
HUBSPOT_API_KEY=<your HubSpot API key>
STRIPE_API_KEY=<your Stripe API key>
GOOGLE_CALENDAR_OAUTH_CLIENT_ID=<your Google OAuth client ID>
GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET=<your Google OAuth client secret>
SENTRY_DSN=<optional, for error tracking>
```

### 5. Set Up Database

**Option A: Use Render PostgreSQL (Free)**

1. In Render dashboard, click "New +" → "PostgreSQL"
2. Fill in the configuration:
   - **Name**: `sync-pipeline-db`
   - **Database**: `sync_pipeline`
   - **User**: `postgres`
   - **Region**: Same as web service
   - **Plan**: Free
3. Copy the internal connection string and set it as `DATABASE_URL`

**Option B: Use External PostgreSQL**

- Provide full connection string as `DATABASE_URL`
- Supports: AWS RDS, DigitalOcean, Supabase, etc.

### 6. Run Database Migrations

After setting `DATABASE_URL`, connect to your Render service and run migrations:

```bash
# Via Render shell
npx prisma migrate deploy
```

Or set up a migration job:
```yaml
jobs:
  - type: cron
    name: db-migration
    runtimeSource: image
    image:
      url: <your-docker-image-url>
    schedule: "0 0 * * *"  # Daily at midnight
```

### 7. Deploy

Click "Deploy" in Render dashboard. Monitor logs in the "Logs" tab.

## Health Checks

Monitor your deployment using:

- **Liveness**: `https://your-service.onrender.com/health/live`
  - Returns 200 if service is running
  - Used by Render's health checks

- **Readiness**: `https://your-service.onrender.com/health/ready`
  - Returns 200 if service is ready to handle requests
  - Includes database connection check

- **Status**: `https://your-service.onrender.com/api/v1/status`
  - Returns service version, environment, uptime

## Testing the Deployment

### 1. Check Service Status

```bash
curl https://your-service.onrender.com/health/live
# {"status":"ok"}

curl https://your-service.onrender.com/health/ready
# {"status":"ready","timestamp":"2026-07-28T..."}
```

### 2. Trigger a Sync

```bash
curl -X POST https://your-service.onrender.com/api/v1/sync \
  -H "Authorization: Bearer YOUR_ADMIN_AUTH_TOKEN" \
  -H "Content-Type: application/json"
# {"status":"accepted","runId":"...","message":"Sync run initiated"}
```

### 3. Check Sync Status

```bash
curl https://your-service.onrender.com/api/v1/sync-runs \
  -H "Authorization: Bearer YOUR_ADMIN_AUTH_TOKEN"
# {"count":1,"runs":[...]}
```

## Important Notes

### Free Tier Limitations

- **Idle timeout**: Services spin down after 15 minutes of inactivity
  - Request within 15 minutes to wake service
  - Cold start takes 30-60 seconds
- **Database**: 512 MB storage limit for free PostgreSQL
- **Network**: Limited outbound bandwidth
- **Uptime**: ~99% but no SLA

### Production Considerations

For production deployments, consider upgrading to:
- **Pay-as-you-go plan**: $0.10/hour per service
- **Fixed plan**: $12/month and up
- **Professional database**: Full-featured PostgreSQL with backups

### Security Best Practices

1. **Use strong tokens**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Rotate credentials regularly**
3. **Use HTTPS only** (Render provides free SSL)
4. **Enable Render's IP whitelist** if available
5. **Monitor logs for suspicious activity**

### Monitoring & Logging

- **Real-time logs**: View in Render dashboard "Logs" tab
- **Structured logging**: All logs include context (requestId, source, error type)
- **Error tracking**: Set `SENTRY_DSN` for Sentry integration (optional)

## Troubleshooting

### Service Won't Start

1. Check logs in Render dashboard
2. Verify `DATABASE_URL` is set and valid
3. Ensure database migrations are applied
4. Check that all required environment variables are set

### High Error Rate

1. Check database connection
2. Verify API credentials (HubSpot, Stripe, Google Calendar)
3. Check rate limiting hasn't been triggered
4. Review sync run logs via `/api/v1/sync-runs/:runId`

### Database Connection Failed

1. Verify `DATABASE_URL` format
2. Check database credentials
3. Ensure database is accessible from Render's network
4. Test connection locally first

## Updating the Deployment

1. Make code changes locally
2. Commit and push to GitHub
3. Render will automatically detect and deploy (if auto-deploy enabled)
4. Monitor deployment progress in "Deploys" tab

## Rollback

If a deployment causes issues:

1. Go to "Deploys" tab in Render
2. Find the previous working deployment
3. Click "Rollback"
4. Render will redeploy the previous version

## Next Steps

- Set up monitoring/alerting
- Configure CI/CD pipeline in GitHub Actions
- Test sync flows with real data
- Monitor performance and optimize as needed
- Plan migration to production plan when ready
