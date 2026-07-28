import { z } from 'zod';
import 'dotenv/config';

const envBoolean = z.preprocess((value) => {
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return value;
}, z.boolean());

const EnvSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_BASE_URL: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  ENABLE_DEMO_FAILURE_INJECTION: envBoolean.default(false),

  // Database
  DATABASE_URL: z.string().url('Must be a valid PostgreSQL connection string'),
  DIRECT_URL: z.string().url('Must be a valid PostgreSQL connection string'),
  DB_SSL: envBoolean.default(true),
  DB_CONNECTION_LIMIT: z.coerce.number().default(5),
  DB_CONNECT_TIMEOUT_SECONDS: z.coerce.number().default(10),

  // Security
  ADMIN_API_KEY: z.string().min(32, 'Must be at least 32 characters'),
  CREDENTIAL_ENCRYPTION_KEY: z.string().min(32, 'Must be at least 32 characters'),
  ADMIN_IP_ALLOWLIST: z.string().optional(),

  // Sync configuration
  SYNC_PAGE_SIZE: z.coerce.number().min(1).default(50),
  SYNC_MAX_RETRIES: z.coerce.number().min(0).default(3),
  SYNC_REQUEST_TIMEOUT_MS: z.coerce.number().min(1000).default(10000),
  SYNC_RETRY_BASE_DELAY_MS: z.coerce.number().default(500),
  SYNC_RETRY_MAX_DELAY_MS: z.coerce.number().default(10000),
  SYNC_OVERLAP_SECONDS: z.coerce.number().default(300),
  SYNC_MAX_PAGES: z.coerce.number().default(1000),
  SYNC_LOCK_TIMEOUT_MS: z.coerce.number().default(1000),
  DEAD_LETTER_MAX_RETRIES: z.coerce.number().default(5),

  // HubSpot
  HUBSPOT_ENABLED: envBoolean.default(true),
  HUBSPOT_ACCESS_TOKEN: z.string().optional(),
  HUBSPOT_PORTAL_ID: z.string().optional(),
  HUBSPOT_CLIENT_SECRET: z.string().optional(),
  HUBSPOT_WEBHOOK_ENABLED: envBoolean.default(false),
  HUBSPOT_CONTACT_PROPERTIES: z.string().default(
    'email,firstname,lastname,phone,company,hs_lastmodifieddate,createdate'
  ),
  HUBSPOT_PAGE_SIZE: z.coerce.number().default(50),

  // Stripe
  STRIPE_ENABLED: envBoolean.default(true),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_WEBHOOK_ENABLED: envBoolean.default(true),
  STRIPE_API_VERSION: z.string().optional(),
  STRIPE_PAGE_SIZE: z.coerce.number().default(50),
  STRIPE_RECONCILIATION_LOOKBACK_HOURS: z.coerce.number().default(24),

  // Google Calendar
  GOOGLE_CALENDAR_ENABLED: envBoolean.default(true),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_CALENDAR_ID: z.string().default('primary'),
  GOOGLE_CALENDAR_PAGE_SIZE: z.coerce.number().default(100),
  GOOGLE_WEBHOOK_ENABLED: envBoolean.default(false),
  GOOGLE_WEBHOOK_TOKEN: z.string().optional(),
  GOOGLE_WEBHOOK_CHANNEL_ID: z.string().optional(),
  GOOGLE_CALENDAR_TIME_MIN: z.string().optional(),

  // HTTP and middleware
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  REQUEST_BODY_LIMIT_BYTES: z.coerce.number().default(1048576),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  TRUST_PROXY: envBoolean.default(true),

  // Observability
  LOG_REDACT_PATHS: z.string().optional(),
  HEALTH_CHECK_DATABASE: envBoolean.default(true),
  SENTRY_DSN: z.string().url().optional(),
});

type EnvConfig = z.infer<typeof EnvSchema>;

let config: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (!config) {
    console.log('[CONFIG] Parsing environment variables...');
    const result = EnvSchema.safeParse(process.env);
    
    if (!result.success) {
      const formatted = result.error.format();
      
      // Log all environment variable issues for debugging
      console.error('=== CONFIGURATION VALIDATION FAILED ===');
      console.error('Issues found:');
      Object.entries(formatted).forEach(([key, value]: [string, any]) => {
        if (value && value._errors) {
          console.error(`❌ ${key}: ${value._errors.join(', ')}`);
        }
      });
      console.error('=== END ERRORS ===\n');
      
      // Also log what env vars ARE set (redacted for sensitive ones)
      console.error('Currently set environment variables:');
      const sensitiveKeys = ['PASSWORD', 'TOKEN', 'KEY', 'SECRET', 'URL'];
      Object.entries(process.env).forEach(([key, value]) => {
        if (key.startsWith('DATABASE_') || key.startsWith('ADMIN_') || key.startsWith('HUBSPOT_') || key.startsWith('STRIPE_') || key.startsWith('GOOGLE_')) {
          const isSensitive = sensitiveKeys.some(s => key.includes(s));
          const displayValue = isSensitive ? '***' : (value ? value.substring(0, 20) + (value.length > 20 ? '...' : '') : 'EMPTY');
          console.error(`  ${key}=${displayValue}`);
        }
      });
      console.error('=== END ENV VARS ===\n');
      
      throw new Error(`Configuration validation failed. See errors above.`);
    }
    config = result.data;
    console.log('[CONFIG] ✅ Configuration loaded successfully');
  }
  return config;
}

export default getConfig();
