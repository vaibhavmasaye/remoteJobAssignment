import { getConfig } from './config/env';
import { getLogger } from './observability/logger';
import { createApp } from './app';

// Force flush
console.log('[STARTUP] ================================');
console.log('[STARTUP] Application starting...');
console.log('[STARTUP] ================================');
console.log('[STARTUP] Time:', new Date().toISOString());

// Check critical env vars FIRST
const criticalVars = [
  'DATABASE_URL',
  'ADMIN_API_KEY',
  'CREDENTIAL_ENCRYPTION_KEY',
];

console.log('[STARTUP] Checking 3 critical environment variables:');
const missingVars: string[] = [];

criticalVars.forEach(varName => {
  const isSet = !!process.env[varName];
  const status = isSet ? '✅ SET' : '❌ MISSING';
  console.log(`[STARTUP]   ${status}: ${varName}`);
  if (!isSet) {
    missingVars.push(varName);
  }
});

if (missingVars.length > 0) {
  console.error('[STARTUP] ');
  console.error('[STARTUP] ❌❌❌ ERROR: Missing ' + missingVars.length + ' critical environment variable(s)!');
  console.error('[STARTUP] ❌❌❌ Missing: ' + missingVars.join(', '));
  console.error('[STARTUP] ');
  console.error('[STARTUP] 👉 GO TO RENDER DASHBOARD');
  console.error('[STARTUP] 👉 Click your service → Environment');
  console.error('[STARTUP] 👉 Add these variables:');
  missingVars.forEach(v => console.error('[STARTUP]    - ' + v));
  console.error('[STARTUP] 👉 Click Save Changes');
  console.error('[STARTUP] 👉 Redeploy');
  console.error('[STARTUP] ');
  process.exit(1);
}

console.log('[STARTUP] ✅ All critical variables present');

async function start() {
  try {
    console.log('[STARTUP] ');
    console.log('[STARTUP] Loading configuration...');
    const config = getConfig();
    const logger = getLogger('server');
    
    console.log('[STARTUP] Creating Fastify application...');
    const app = await createApp();
    
    console.log('[STARTUP] Binding to port ' + config.PORT);
    await app.listen({ port: config.PORT, host: '0.0.0.0' });

    logger.info({ port: config.PORT }, '✅ Server listening');
    console.log('[STARTUP] ');
    console.log('[STARTUP] ✅✅✅ SERVER STARTED SUCCESSFULLY ✅✅✅');
    console.log('[STARTUP] ');
  } catch (error) {
    console.error('[STARTUP] ');
    console.error('[STARTUP] ❌ STARTUP FAILED');
    console.error('[STARTUP] Error:', error);
    console.error('[STARTUP] ');
    process.exit(1);
  }
}

start();
