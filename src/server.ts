import { getConfig } from './config/env';
import { getLogger } from './observability/logger';
import { createApp } from './app';
import { initializeDatabase } from './db';

// Ensure logs are flushed immediately
process.stdout.write('[STARTUP] ================================\n');
process.stdout.write('[STARTUP] Application starting...\n');
process.stdout.write('[STARTUP] ================================\n');
process.stdout.write(`[STARTUP] Time: ${new Date().toISOString()}\n`);

// Check critical env vars FIRST
const criticalVars = [
  'DATABASE_URL',
  'ADMIN_API_KEY',
  'CREDENTIAL_ENCRYPTION_KEY',
];

process.stdout.write('[STARTUP] Checking 3 critical environment variables:\n');
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
    process.stdout.write('[STARTUP] Testing database connection...\n');
    try {
      const { checkConnection } = await import('./db');
      const isConnected = await checkConnection();
      if (!isConnected) {
        throw new Error('Database connection check returned false');
      }
      process.stdout.write('[STARTUP] ✅ Database connection successful\n');
    } catch (connError: any) {
      process.stderr.write('[STARTUP] ❌ Database connection failed\n');
      process.stderr.write(`[STARTUP] Error: ${connError?.message}\n`);
      throw connError;
    }

    process.stdout.write('[STARTUP] \n');
    process.stdout.write('[STARTUP] Initializing database schema...\n');
    try {
      await initializeDatabase();
      process.stdout.write('[STARTUP] ✅ Database initialized\n');
    } catch (dbError: any) {
      process.stderr.write('[STARTUP] ❌ Database initialization failed\n');
      process.stderr.write(`[STARTUP] Error message: ${dbError?.message}\n`);
      process.stderr.write(`[STARTUP] Error code: ${dbError?.code}\n`);
      throw dbError;
    }
    
    process.stdout.write('[STARTUP] \n');
    process.stdout.write('[STARTUP] Creating Fastify application...\n');
    const app = await createApp();
    
    process.stdout.write('[STARTUP] Binding to port ' + config.PORT + '\n');
    await app.listen({ port: config.PORT, host: '0.0.0.0' });

    logger.info({ port: config.PORT }, '✅ Server listening');
    process.stdout.write('[STARTUP] \n');
    process.stdout.write('[STARTUP] ✅✅✅ SERVER STARTED SUCCESSFULLY ✅✅✅\n');
    process.stdout.write('[STARTUP] \n');
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

// Set a global timeout in case something hangs
setTimeout(() => {
  process.stderr.write('[STARTUP] ❌ TIMEOUT: Application did not start within 30 seconds\n');
  process.exit(1);
}, 30000);

start();
