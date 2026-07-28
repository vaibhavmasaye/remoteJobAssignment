import { FastifyRequest, FastifyReply } from 'fastify';
import { getConfig } from '../config/env';
import { getLogger } from '../observability/logger';
import crypto from 'crypto';

const config = getConfig();
const logger = getLogger('admin-auth');

/**
 * Extract bearer token from Authorization header
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Verify API key with constant-time comparison
 */
export function verifyApiKey(providedKey: string, expectedKey: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(providedKey), Buffer.from(expectedKey));
  } catch {
    return false;
  }
}

/**
 * Fastify decorator for admin auth
 */
export async function adminAuthGuard(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  const token = extractBearerToken(authHeader);

  if (!token) {
    logger.warn({ ip: request.ip }, 'Missing authorization token');
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
    });
  }

  if (!verifyApiKey(token, config.ADMIN_API_KEY)) {
    logger.warn({ ip: request.ip }, 'Invalid API key');
    return reply.code(403).send({
      error: 'Forbidden',
      message: 'Invalid API key',
    });
  }

  // Check IP allowlist if configured
  if (config.ADMIN_IP_ALLOWLIST) {
    const allowedIPs = config.ADMIN_IP_ALLOWLIST.split(',').map((ip) => ip.trim());
    const clientIP = request.ip;

    // Allow all IPs if allowlist contains "*"
    const allowAll = allowedIPs.includes('*');

    if (!allowAll && !allowedIPs.includes(clientIP)) {
      logger.warn({ ip: clientIP, allowedIPs }, 'IP not in allowlist');
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'IP address not allowed',
      });
    }
  }

  // Attach user context to request
  (request as any).user = { authenticated: true };
}

/**
 * Check if demo mode is enabled
 */
export function isDemoMode(): boolean {
  return config.ENABLE_DEMO_FAILURE_INJECTION === true;
}

/**
 * Require demo mode for endpoint
 */
export async function demoModeGuard(request: FastifyRequest, reply: FastifyReply) {
  if (!isDemoMode()) {
    logger.warn('Demo endpoint accessed but demo mode disabled');
    return reply.code(403).send({
      error: 'Forbidden',
      message: 'Demo mode is disabled',
    });
  }
}
