import { getConfig } from './config/env';
import { getLogger } from './observability/logger';
import { createApp } from './app';
import { initializeDatabase } from './db';

process.on('uncaughtException', (error) => {
  process.stderr.write(`[STARTUP] UNCAUGHT EXCEPTION: ${error.stack || error.message}\n`);
});

process.on('unhandledRejection', (reason) => {
  process.stderr.write(`[STARTUP] UNHANDLED REJECTION: ${String(reason)}\n`);
});

// Ensure logs are flushed immediately
process.stdout.write('[STARTUP] ================================\n');
process.stdout.write('[STARTUP] Application starting...\n');
process.stdout.write('[STARTUP] ================================\n');
process.stdout.write(`[STARTUP] Time: ${new Date().toISOString()}\n`);

// Check critical env vars FIRST
const criticalVars = [
  'DATABASE_URL',
  'DIRECT_URL',
  'ADMIN_API_KEY',
  'CREDENTIAL_ENCRYPTION_KEY',
];

process.stdout.write(`[STARTUP] Checking ${criticalVars.length} critical environment variables:\n`);
const missingVars: string[] = [];

criticalVars.forEach(varName => {
  const isSet = !!process.env[varName];
  const status = isSet ? '✅ SET' : '❌ MISSING';
  process.stdout.write(`[STARTUP]   ${status}: ${varName}\n`);
  if (!isSet) {
    missingVars.push(varName);
  }
});

if (missingVars.length > 0) {
  process.stderr.write('[STARTUP] \n');
  process.stderr.write(`[STARTUP] ❌❌❌ ERROR: Missing ${missingVars.length} critical environment variable(s)!\n`);
  process.stderr.write(`[STARTUP] ❌❌❌ Missing: ${missingVars.join(', ')}\n`);
  process.stderr.write('[STARTUP] \n');
  process.stderr.write('[STARTUP] 👉 GO TO RENDER DASHBOARD\n');
  process.stderr.write('[STARTUP] 👉 Click your service → Environment\n');
  process.stderr.write('[STARTUP] 👉 Add these variables:\n');
  missingVars.forEach(v => process.stderr.write(`[STARTUP]    - ${v}\n`));
  process.stderr.write('[STARTUP] 👉 Click Save Changes\n');
  process.stderr.write('[STARTUP] 👉 Redeploy\n');
  process.stderr.write('[STARTUP] \n');
  process.exit(1);
}

process.stdout.write('[STARTUP] ✅ All critical variables present\n');

async function start() {
  try {
    process.stdout.write('[STARTUP] \n');
    process.stdout.write('[STARTUP] Loading configuration...\n');
    const config = getConfig();
    const logger = getLogger('server');

    process.stdout.write('[STARTUP] \n');
    process.stdout.write('[STARTUP] Creating Fastify application...\n');
    const app = await createApp();
    
    process.stdout.write('[STARTUP] Binding to port ' + config.PORT + '\n');
    await app.listen({ port: config.PORT, host: '0.0.0.0' });

    logger.info({ port: config.PORT }, '✅ Server listening');
    process.stdout.write('[STARTUP] \n');
    process.stdout.write('[STARTUP] ✅✅✅ SERVER STARTED SUCCESSFULLY ✅✅✅\n');
    process.stdout.write('[STARTUP] \n');

    // Database availability must not prevent Render from binding the web port.
    // Readiness continues to report 503 when the database is unavailable.
    void initializeDatabase()
      .then(() => {
        process.stdout.write('[STARTUP] ✅ Database initialized\n');
      })
      .catch((dbError: any) => {
        process.stderr.write('[STARTUP] ❌ Database initialization failed\n');
        process.stderr.write(`[STARTUP] Error: ${dbError?.message || String(dbError)}\n`);
      });
  } catch (error: any) {
    process.stderr.write('[STARTUP] \n');
    process.stderr.write('[STARTUP] ❌ STARTUP FAILED\n');
    process.stderr.write(`[STARTUP] Error type: ${error?.constructor?.name}\n`);
    process.stderr.write(`[STARTUP] Error message: ${error?.message}\n`);
    process.stderr.write(`[STARTUP] Error code: ${error?.code}\n`);
    if (error?.stack) {
      process.stderr.write(`[STARTUP] Stack trace: ${error.stack}\n`);
    }
    process.stderr.write('[STARTUP] \n');
    // Give time for stderr to flush
    setTimeout(() => {
      process.exit(1);
    }, 100);
  }
}

start();
