import { FastifyRequest, FastifyReply } from 'fastify';
import { getLogger } from '../observability/logger';

const logger = getLogger('rate-limit');

/**
 * Sliding window rate limiter using in-memory store.
 * Each IP tracks requests within a time window.
 */
class SlidingWindowRateLimiter {
  private store = new Map<string, number[]>(); // IP -> timestamps of requests
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.startCleanupInterval();
  }

  /**
   * Get client IP from request, respecting X-Forwarded-For and similar headers
   */
  private getClientIp(request: FastifyRequest): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return request.ip || 'unknown';
  }

  /**
   * Check if request should be allowed and record it
   */
  isAllowed(request: FastifyRequest): boolean {
    const ip = this.getClientIp(request);
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get or initialize request timestamps for this IP
    let timestamps = this.store.get(ip) || [];

    // Remove timestamps outside the current window
    timestamps = timestamps.filter((ts) => ts > windowStart);

    // Check if limit exceeded
    if (timestamps.length >= this.maxRequests) {
      logger.warn({ ip, requestCount: timestamps.length }, 'Rate limit exceeded');
      return false;
    }

    // Record this request
    timestamps.push(now);
    this.store.set(ip, timestamps);
    return true;
  }

  /**
   * Get current request count for an IP
   */
  getRequestCount(request: FastifyRequest): number {
    const ip = this.getClientIp(request);
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const timestamps = this.store.get(ip) || [];
    return timestamps.filter((ts) => ts > windowStart).length;
  }

  /**
   * Periodically clean up expired entries to prevent memory leaks
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const windowStart = now - this.windowMs;

      for (const [ip, timestamps] of this.store.entries()) {
        const filtered = timestamps.filter((ts) => ts > windowStart);
        if (filtered.length === 0) {
          this.store.delete(ip);
        } else {
          this.store.set(ip, filtered);
        }
      }
    }, 5 * 60 * 1000); // Cleanup every 5 minutes
  }

  /**
   * Stop the cleanup interval (for graceful shutdown)
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Global instance
let rateLimiter: SlidingWindowRateLimiter | null = null;

export function createRateLimiter(windowMs?: number, maxRequests?: number): SlidingWindowRateLimiter {
  rateLimiter = new SlidingWindowRateLimiter(windowMs, maxRequests);
  return rateLimiter;
}

export function getRateLimiter(): SlidingWindowRateLimiter {
  if (!rateLimiter) {
    rateLimiter = new SlidingWindowRateLimiter();
  }
  return rateLimiter;
}

export function stopRateLimiter(): void {
  if (rateLimiter) {
    rateLimiter.stop();
    rateLimiter = null;
  }
}

/**
 * Fastify preHandler for rate limiting
 */
export async function rateLimitHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const limiter = getRateLimiter();

  if (!limiter.isAllowed(request)) {
    const ip = request.ip || 'unknown';
    logger.warn({ ip }, 'Request rejected by rate limiter');
    return reply.code(429).send({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please retry after some time.',
      retryAfter: Math.ceil(60), // Suggest retry after 60 seconds
    });
  }
}

/**
 * Get rate limit status for an IP (for monitoring/debugging)
 */
export function getRateLimitStatus(request: FastifyRequest): {
  requestsInWindow: number;
  limit: number;
} {
  const limiter = getRateLimiter();
  return {
    requestsInWindow: limiter.getRequestCount(request),
    limit: 100, // Default limit
  };
}
