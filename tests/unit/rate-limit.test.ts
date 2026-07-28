import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the logger to avoid config validation
vi.mock('../../src/observability/logger', () => ({
  getLogger: () => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { createRateLimiter, stopRateLimiter, getRateLimiter } from '../../src/middleware/rate-limit';
import { FastifyRequest } from 'fastify';

// Mock FastifyRequest for testing
function createMockRequest(ip: string): Partial<FastifyRequest> {
  return {
    ip,
    headers: {},
  };
}

function createMockRequestWithForwarded(
  ip: string,
  forwarded: string
): Partial<FastifyRequest> {
  return {
    ip,
    headers: {
      'x-forwarded-for': forwarded,
    },
  };
}

describe('Rate Limiter', () => {
  beforeEach(() => {
    stopRateLimiter();
  });

  afterEach(() => {
    stopRateLimiter();
  });

  describe('createRateLimiter', () => {
    it('should create a rate limiter with default settings', () => {
      const limiter = createRateLimiter();
      expect(limiter).toBeDefined();
    });

    it('should create a rate limiter with custom settings', () => {
      const limiter = createRateLimiter(30000, 50);
      expect(limiter).toBeDefined();
    });
  });

  describe('isAllowed', () => {
    it('should allow requests within limit', () => {
      const limiter = createRateLimiter(60000, 5);
      const request = createMockRequest('192.168.1.1') as FastifyRequest;

      for (let i = 0; i < 5; i++) {
        expect(limiter.isAllowed(request)).toBe(true);
      }
    });

    it('should reject requests exceeding limit', () => {
      const limiter = createRateLimiter(60000, 3);
      const request = createMockRequest('192.168.1.1') as FastifyRequest;

      // First 3 should be allowed
      expect(limiter.isAllowed(request)).toBe(true);
      expect(limiter.isAllowed(request)).toBe(true);
      expect(limiter.isAllowed(request)).toBe(true);

      // 4th should be rejected
      expect(limiter.isAllowed(request)).toBe(false);
    });

    it('should isolate limits per IP', () => {
      const limiter = createRateLimiter(60000, 2);
      const request1 = createMockRequest('192.168.1.1') as FastifyRequest;
      const request2 = createMockRequest('192.168.1.2') as FastifyRequest;

      // IP 1: 2 requests allowed
      expect(limiter.isAllowed(request1)).toBe(true);
      expect(limiter.isAllowed(request1)).toBe(true);
      expect(limiter.isAllowed(request1)).toBe(false);

      // IP 2: Should have its own limit
      expect(limiter.isAllowed(request2)).toBe(true);
      expect(limiter.isAllowed(request2)).toBe(true);
      expect(limiter.isAllowed(request2)).toBe(false);
    });

    it('should reset limit after window expires', async () => {
      const limiter = createRateLimiter(100, 2); // 100ms window, 2 requests
      const request = createMockRequest('192.168.1.1') as FastifyRequest;

      // Use up the limit
      expect(limiter.isAllowed(request)).toBe(true);
      expect(limiter.isAllowed(request)).toBe(true);
      expect(limiter.isAllowed(request)).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be allowed again
      expect(limiter.isAllowed(request)).toBe(true);
    });

    it('should parse X-Forwarded-For header', () => {
      const limiter = createRateLimiter(60000, 1);
      const request = createMockRequestWithForwarded('127.0.0.1', '10.0.0.1, 192.168.1.1') as FastifyRequest;

      // Should use the first IP from X-Forwarded-For
      expect(limiter.isAllowed(request)).toBe(true);
      expect(limiter.isAllowed(request)).toBe(false);
    });

    it('should handle multiple IPs in X-Forwarded-For header', () => {
      const limiter = createRateLimiter(60000, 1);
      const request1 = createMockRequestWithForwarded('127.0.0.1', '10.0.0.1, 192.168.1.1') as FastifyRequest;
      const request2 = createMockRequestWithForwarded('127.0.0.1', '10.0.0.2, 192.168.1.1') as FastifyRequest;

      // Different IPs should have separate limits
      expect(limiter.isAllowed(request1)).toBe(true);
      expect(limiter.isAllowed(request1)).toBe(false);

      expect(limiter.isAllowed(request2)).toBe(true);
      expect(limiter.isAllowed(request2)).toBe(false);
    });

    it('should trim whitespace in X-Forwarded-For', () => {
      const limiter = createRateLimiter(60000, 1);
      const request = createMockRequestWithForwarded('127.0.0.1', '  10.0.0.1  , 192.168.1.1') as FastifyRequest;

      expect(limiter.isAllowed(request)).toBe(true);
      expect(limiter.isAllowed(request)).toBe(false);
    });
  });

  describe('getRequestCount', () => {
    it('should return current request count for IP', () => {
      const limiter = createRateLimiter(60000, 10);
      const request = createMockRequest('192.168.1.1') as FastifyRequest;

      expect(limiter.getRequestCount(request)).toBe(0);

      limiter.isAllowed(request);
      expect(limiter.getRequestCount(request)).toBe(1);

      limiter.isAllowed(request);
      expect(limiter.getRequestCount(request)).toBe(2);
    });

    it('should exclude expired requests from count', async () => {
      const limiter = createRateLimiter(100, 10); // 100ms window
      const request = createMockRequest('192.168.1.1') as FastifyRequest;

      limiter.isAllowed(request);
      limiter.isAllowed(request);
      expect(limiter.getRequestCount(request)).toBe(2);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(limiter.getRequestCount(request)).toBe(0);
    });

    it('should isolate counts per IP', () => {
      const limiter = createRateLimiter(60000, 10);
      const request1 = createMockRequest('192.168.1.1') as FastifyRequest;
      const request2 = createMockRequest('192.168.1.2') as FastifyRequest;

      limiter.isAllowed(request1);
      limiter.isAllowed(request1);
      limiter.isAllowed(request2);

      expect(limiter.getRequestCount(request1)).toBe(2);
      expect(limiter.getRequestCount(request2)).toBe(1);
    });
  });

  describe('getRateLimiter', () => {
    it('should return singleton instance', () => {
      const limiter1 = getRateLimiter();
      const limiter2 = getRateLimiter();
      expect(limiter1).toBe(limiter2);
    });

    it('should create default instance if none exists', () => {
      stopRateLimiter();
      const limiter = getRateLimiter();
      expect(limiter).toBeDefined();
    });
  });

  describe('stopRateLimiter', () => {
    it('should stop cleanup interval', () => {
      const limiter = createRateLimiter();
      stopRateLimiter();

      // Calling stop multiple times should not throw
      expect(() => stopRateLimiter()).not.toThrow();
    });

    it('should allow recreating after stop', () => {
      createRateLimiter(60000, 5);
      stopRateLimiter();

      const newLimiter = createRateLimiter(60000, 10);
      const request = createMockRequest('192.168.1.1') as FastifyRequest;

      // Should use new limit
      for (let i = 0; i < 10; i++) {
        expect(newLimiter.isAllowed(request)).toBe(true);
      }
      expect(newLimiter.isAllowed(request)).toBe(false);
    });
  });

  describe('sliding window behavior', () => {
    it('should implement true sliding window', async () => {
      const windowMs = 200;
      const maxRequests = 3;
      const limiter = createRateLimiter(windowMs, maxRequests);
      const request = createMockRequest('192.168.1.1') as FastifyRequest;

      // T=0: Make 3 requests
      expect(limiter.isAllowed(request)).toBe(true);
      expect(limiter.isAllowed(request)).toBe(true);
      expect(limiter.isAllowed(request)).toBe(true);
      expect(limiter.isAllowed(request)).toBe(false);

      // T=100ms: Still in window, should reject
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(limiter.isAllowed(request)).toBe(false);

      // T=210ms: Outside window, should allow again
      await new Promise((resolve) => setTimeout(resolve, 110));
      expect(limiter.isAllowed(request)).toBe(true);
    });
  });

  describe('memory cleanup', () => {
    it('should cleanup expired entries', async () => {
      const limiter = createRateLimiter(100, 5);
      const request1 = createMockRequest('192.168.1.1') as FastifyRequest;
      const request2 = createMockRequest('192.168.1.2') as FastifyRequest;

      // Create entries for two IPs
      limiter.isAllowed(request1);
      limiter.isAllowed(request2);

      // Wait for entries to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Access one IP - should trigger cleanup on its entry
      const count1 = limiter.getRequestCount(request1);
      const count2 = limiter.getRequestCount(request2);

      expect(count1).toBe(0);
      expect(count2).toBe(0);
    });
  });
});
