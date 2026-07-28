import { getConfig } from './config/env';
import { getLogger } from './observability/logger';
import { createApp } from './app';

// Log immediately to console
console.log('[STARTUP] ================================');
console.log('[STARTUP] Application starting...');
console.log('[STARTUP] ================================');

// Check critical env vars FIRST
const criticalVars = [
  'DATABASE_URL',
  'ADMIN_API_KEY',
  'CREDENTIAL_ENCRYPTION_KEY',
];

console.log('[STARTUP] Checking critical environment variables:');
let allVarsPresent = true;
criticalVars.forEach(varName => {
  const isSet = !!process.env[varName];
  const status = isSet ? '✅ SET' : '❌ MISSING';
  console.log(`[STARTUP] ${status}: ${varName}`);
  if (!isSet) allVarsPresent = false;
});

if (!allVarsPresent) {
  console.error('[STARTUP] ❌❌❌ CRITICAL: Environment variables missing!');
  process.exit(1);
}

async function start() {
  try {
    console.log('[STARTUP] Loading config...');
    const config = getConfig();
    const logger = getLogger('server');
    
    console.log('[STARTUP] Creating app...');
    const app = await createApp();
    
    console.log('[STARTUP] Listening on 0.0.0.0:' + config.PORT);
    await app.listen({ port: config.PORT, host: '0.0.0.0' });

    logger.info({ port: config.PORT }, '✅ Server listening');
    console.log('[STARTUP] ✅✅✅ SERVER STARTED ✅✅✅');
  } catch (error) {
    console.error('[STARTUP] ❌ START FAILED:', error);
    process.exit(1);
  }
}

start();
