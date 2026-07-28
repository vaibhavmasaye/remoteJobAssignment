import { describe, it, expect } from 'vitest';
import { ErrorClassifier } from '../../src/sync/error-classifier';
import { ErrorType } from '../../src/sync/types';

describe('ErrorClassifier', () => {
  describe('classifyHttpError', () => {
    it('should classify 400 as PERMANENT', () => {
      const result = ErrorClassifier.classifyHttpError(400);
      expect(result.type).toBe(ErrorType.PERMANENT);
      expect(result.code).toBe('BAD_REQUEST');
      expect(result.retryable).toBe(false);
      expect(result.httpStatus).toBe(400);
    });

    it('should classify 401 as AUTH_FAILURE', () => {
      const result = ErrorClassifier.classifyHttpError(401);
      expect(result.type).toBe(ErrorType.AUTH_FAILURE);
      expect(result.code).toBe('AUTH_FAILED');
      expect(result.retryable).toBe(false);
      expect(result.httpStatus).toBe(401);
    });

    it('should classify 403 as AUTH_FAILURE', () => {
      const result = ErrorClassifier.classifyHttpError(403);
      expect(result.type).toBe(ErrorType.AUTH_FAILURE);
      expect(result.code).toBe('AUTH_FAILED');
      expect(result.retryable).toBe(false);
      expect(result.httpStatus).toBe(403);
    });

    it('should classify 404 as PERMANENT', () => {
      const result = ErrorClassifier.classifyHttpError(404);
      expect(result.type).toBe(ErrorType.PERMANENT);
      expect(result.code).toBe('NOT_FOUND');
      expect(result.retryable).toBe(false);
      expect(result.httpStatus).toBe(404);
    });

    it('should classify 408 as RETRYABLE', () => {
      const result = ErrorClassifier.classifyHttpError(408);
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.code).toBe('TIMEOUT');
      expect(result.retryable).toBe(true);
      expect(result.httpStatus).toBe(408);
    });

    it('should classify 425 as RETRYABLE', () => {
      const result = ErrorClassifier.classifyHttpError(425);
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.code).toBe('TIMEOUT');
      expect(result.retryable).toBe(true);
      expect(result.httpStatus).toBe(425);
    });

    it('should classify 429 as RATE_LIMITED', () => {
      const result = ErrorClassifier.classifyHttpError(429);
      expect(result.type).toBe(ErrorType.RATE_LIMITED);
      expect(result.code).toBe('RATE_LIMIT');
      expect(result.retryable).toBe(true);
      expect(result.httpStatus).toBe(429);
    });

    it('should classify 500 as RETRYABLE', () => {
      const result = ErrorClassifier.classifyHttpError(500);
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.code).toBe('SERVER_ERROR');
      expect(result.retryable).toBe(true);
      expect(result.httpStatus).toBe(500);
    });

    it('should classify 502 as RETRYABLE', () => {
      const result = ErrorClassifier.classifyHttpError(502);
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.code).toBe('SERVER_ERROR');
      expect(result.retryable).toBe(true);
      expect(result.httpStatus).toBe(502);
    });

    it('should classify 503 as RETRYABLE', () => {
      const result = ErrorClassifier.classifyHttpError(503);
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.code).toBe('SERVER_ERROR');
      expect(result.retryable).toBe(true);
      expect(result.httpStatus).toBe(503);
    });

    it('should classify 504 as RETRYABLE', () => {
      const result = ErrorClassifier.classifyHttpError(504);
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.code).toBe('SERVER_ERROR');
      expect(result.retryable).toBe(true);
      expect(result.httpStatus).toBe(504);
    });

    it('should classify 410 as STALE_CURSOR', () => {
      const result = ErrorClassifier.classifyHttpError(410);
      expect(result.type).toBe(ErrorType.STALE_CURSOR);
      expect(result.code).toBe('GONE');
      expect(result.retryable).toBe(true);
      expect(result.httpStatus).toBe(410);
    });

    it('should classify unknown status as RETRYABLE', () => {
      const result = ErrorClassifier.classifyHttpError(418); // I'm a teapot
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.code).toBe('HTTP_418');
      expect(result.retryable).toBe(true);
      expect(result.httpStatus).toBe(418);
    });
  });

  describe('classifyNetworkError', () => {
    it('should classify timeout error as RETRYABLE', () => {
      const result = ErrorClassifier.classifyNetworkError(
        new Error('Request timeout after 5000ms')
      );
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.code).toBe('TIMEOUT');
      expect(result.retryable).toBe(true);
    });

    it('should classify ECONNREFUSED as RETRYABLE', () => {
      const result = ErrorClassifier.classifyNetworkError(
        new Error('ECONNREFUSED: Connection refused')
      );
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.code).toBe('CONNECTION_ERROR');
      expect(result.retryable).toBe(true);
    });

    it('should classify ENOTFOUND as RETRYABLE', () => {
      const result = ErrorClassifier.classifyNetworkError(
        new Error('ENOTFOUND: Host not found')
      );
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.code).toBe('CONNECTION_ERROR');
      expect(result.retryable).toBe(true);
    });

    it('should classify ECONNRESET as RETRYABLE', () => {
      const result = ErrorClassifier.classifyNetworkError(
        new Error('ECONNRESET: Connection reset by peer')
      );
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.code).toBe('CONNECTION_RESET');
      expect(result.retryable).toBe(true);
    });

    it('should classify unknown network error as RETRYABLE', () => {
      const result = ErrorClassifier.classifyNetworkError(
        new Error('Unknown network error')
      );
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.code).toBe('NETWORK_ERROR');
      expect(result.retryable).toBe(true);
    });

    it('should handle empty error gracefully', () => {
      const result = ErrorClassifier.classifyNetworkError({});
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.code).toBe('NETWORK_ERROR');
      expect(result.retryable).toBe(true);
    });
  });

  describe('classifyParsingError', () => {
    it('should classify as PERMANENT', () => {
      const result = ErrorClassifier.classifyParsingError();
      expect(result.type).toBe(ErrorType.PERMANENT);
      expect(result.code).toBe('PARSE_ERROR');
      expect(result.retryable).toBe(false);
    });

    it('should provide appropriate message', () => {
      const result = ErrorClassifier.classifyParsingError();
      expect(result.message).toContain('parse');
    });
  });

  describe('classifyValidationError', () => {
    it('should classify as VALIDATION_ERROR', () => {
      const result = ErrorClassifier.classifyValidationError('email is required');
      expect(result.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(result.code).toBe('VALIDATION_ERROR');
      expect(result.retryable).toBe(false);
    });

    it('should include details in message', () => {
      const details = 'email must be a valid email';
      const result = ErrorClassifier.classifyValidationError(details);
      expect(result.message).toContain(details);
    });
  });

  describe('classifyError', () => {
    it('should delegate to classifyHttpError for HTTP errors', () => {
      const error = {
        response: {
          status: 429,
          data: {},
        },
      };
      const result = ErrorClassifier.classifyError(error);
      expect(result.type).toBe(ErrorType.RATE_LIMITED);
      expect(result.code).toBe('RATE_LIMIT');
    });

    it('should delegate to classifyNetworkError for network errors', () => {
      const error = {
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      };
      const result = ErrorClassifier.classifyError(error);
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.code).toBe('NETWORK_ERROR');
    });

    it('should classify unknown errors as RETRYABLE', () => {
      const error = new Error('Some unknown error');
      const result = ErrorClassifier.classifyError(error);
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.retryable).toBe(true);
    });

    it('should handle null/undefined gracefully', () => {
      const result = ErrorClassifier.classifyError(undefined);
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('error properties', () => {
    it('should always provide userFacing message', () => {
      const errors = [
        ErrorClassifier.classifyHttpError(500),
        ErrorClassifier.classifyNetworkError(new Error('timeout')),
        ErrorClassifier.classifyParsingError(),
        ErrorClassifier.classifyValidationError('test'),
      ];

      errors.forEach((classified) => {
        expect(classified.userFacing).toBeDefined();
        expect(classified.userFacing.length).toBeGreaterThan(0);
      });
    });

    it('should always provide code', () => {
      const errors = [
        ErrorClassifier.classifyHttpError(500),
        ErrorClassifier.classifyNetworkError(new Error('timeout')),
        ErrorClassifier.classifyParsingError(),
      ];

      errors.forEach((classified) => {
        expect(classified.code).toBeDefined();
        expect(classified.code.length).toBeGreaterThan(0);
      });
    });

    it('should always provide message', () => {
      const errors = [
        ErrorClassifier.classifyHttpError(500),
        ErrorClassifier.classifyNetworkError(new Error('timeout')),
        ErrorClassifier.classifyParsingError(),
      ];

      errors.forEach((classified) => {
        expect(classified.message).toBeDefined();
        expect(classified.message.length).toBeGreaterThan(0);
      });
    });
  });

  describe('retry logic', () => {
    it('should mark transient errors as retryable', () => {
      const transientErrors = [
        ErrorClassifier.classifyHttpError(408),
        ErrorClassifier.classifyHttpError(429),
        ErrorClassifier.classifyHttpError(500),
        ErrorClassifier.classifyHttpError(503),
        ErrorClassifier.classifyNetworkError(new Error('timeout')),
      ];

      transientErrors.forEach((classified) => {
        expect(classified.retryable).toBe(true);
      });
    });

    it('should mark permanent errors as non-retryable', () => {
      const permanentErrors = [
        ErrorClassifier.classifyHttpError(400),
        ErrorClassifier.classifyHttpError(401),
        ErrorClassifier.classifyHttpError(403),
        ErrorClassifier.classifyHttpError(404),
        ErrorClassifier.classifyParsingError(),
        ErrorClassifier.classifyValidationError('test'),
      ];

      permanentErrors.forEach((classified) => {
        expect(classified.retryable).toBe(false);
      });
    });

    it('should mark 410 Gone as retryable for stale cursor recovery', () => {
      const result = ErrorClassifier.classifyHttpError(410);
      expect(result.retryable).toBe(true);
      expect(result.type).toBe(ErrorType.STALE_CURSOR);
    });
  });
});
