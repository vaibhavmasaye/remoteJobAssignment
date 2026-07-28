/**
 * Middleware exports for Phase 8: Security Hardening
 *
 * Includes:
 * - Rate limiting (sliding window, in-memory)
 * - Request validation (body, query, params)
 * - Security headers (HSTS, CSP, X-Frame-Options, etc.)
 * - Error handling (classification, logging, status code mapping)
 */

export {
  createRateLimiter,
  getRateLimiter,
  stopRateLimiter,
  rateLimitHandler,
  getRateLimitStatus,
} from './rate-limit';

export {
  createBodyValidationHandler,
  createQueryValidationHandler,
  createParamValidationHandler,
  commonSchemas,
} from './request-validation';

export { applySecurityHeaders, registerSecurityHeadersPlugin } from './security-headers';

export { registerErrorHandler, errorCatcherMiddleware } from './error-handler';
