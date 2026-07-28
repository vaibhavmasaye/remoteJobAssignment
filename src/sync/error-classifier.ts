import { ClassifiedError, ErrorType } from './types';

export class ErrorClassifier {
  /**
   * Classify HTTP errors
   */
  static classifyHttpError(statusCode: number, body?: any): ClassifiedError {
    switch (statusCode) {
      case 400:
        return {
          type: ErrorType.PERMANENT,
          code: 'BAD_REQUEST',
          message: 'Invalid request',
          httpStatus: 400,
          retryable: false,
          userFacing: 'Bad request - check configuration',
        };

      case 401:
      case 403:
        return {
          type: ErrorType.AUTH_FAILURE,
          code: 'AUTH_FAILED',
          message: 'Authentication or authorization failed',
          httpStatus: statusCode,
          retryable: false,
          userFacing: 'Authentication required - credentials may be revoked',
        };

      case 404:
        return {
          type: ErrorType.PERMANENT,
          code: 'NOT_FOUND',
          message: 'Resource not found',
          httpStatus: 404,
          retryable: false,
          userFacing: 'Resource not found',
        };

      case 408:
      case 425:
        return {
          type: ErrorType.RETRYABLE,
          code: 'TIMEOUT',
          message: 'Request timeout',
          httpStatus: statusCode,
          retryable: true,
          userFacing: 'Timeout - will retry',
        };

      case 429:
        return {
          type: ErrorType.RATE_LIMITED,
          code: 'RATE_LIMIT',
          message: 'Rate limited',
          httpStatus: 429,
          retryable: true,
          userFacing: 'Rate limited - will retry with backoff',
        };

      case 500:
      case 502:
      case 503:
      case 504:
        return {
          type: ErrorType.RETRYABLE,
          code: 'SERVER_ERROR',
          message: `Server error: ${statusCode}`,
          httpStatus: statusCode,
          retryable: true,
          userFacing: 'Service temporarily unavailable - will retry',
        };

      case 410:
        return {
          type: ErrorType.STALE_CURSOR,
          code: 'GONE',
          message: 'Resource gone - cursor/token is stale',
          httpStatus: 410,
          retryable: true,
          userFacing: 'Sync token expired - will perform full resync',
        };

      default:
        return {
          type: ErrorType.RETRYABLE,
          code: `HTTP_${statusCode}`,
          message: `HTTP error: ${statusCode}`,
          httpStatus: statusCode,
          retryable: true,
          userFacing: 'Unexpected error - will retry',
        };
    }
  }

  /**
   * Classify network/timeout errors
   */
  static classifyNetworkError(error: any): ClassifiedError {
    const message = error?.message || '';

    if (message.includes('timeout') || message.includes('TIMEOUT')) {
      return {
        type: ErrorType.RETRYABLE,
        code: 'TIMEOUT',
        message: 'Request timeout',
        retryable: true,
        userFacing: 'Request timeout - will retry',
      };
    }

    if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
      return {
        type: ErrorType.RETRYABLE,
        code: 'CONNECTION_ERROR',
        message: 'Connection failed',
        retryable: true,
        userFacing: 'Connection error - will retry',
      };
    }

    if (message.includes('ECONNRESET')) {
      return {
        type: ErrorType.RETRYABLE,
        code: 'CONNECTION_RESET',
        message: 'Connection reset',
        retryable: true,
        userFacing: 'Connection reset - will retry',
      };
    }

    return {
      type: ErrorType.RETRYABLE,
      code: 'NETWORK_ERROR',
      message: message || 'Network error',
      retryable: true,
      userFacing: 'Network error - will retry',
    };
  }

  /**
   * Classify JSON parsing errors
   */
  static classifyParsingError(): ClassifiedError {
    return {
      type: ErrorType.PERMANENT,
      code: 'PARSE_ERROR',
      message: 'Failed to parse response',
      retryable: false,
      userFacing: 'Malformed response from source',
    };
  }

  /**
   * Classify validation errors
   */
  static classifyValidationError(details: string): ClassifiedError {
    return {
      type: ErrorType.VALIDATION_ERROR,
      code: 'VALIDATION_ERROR',
      message: `Validation failed: ${details}`,
      retryable: false,
      userFacing: 'Data validation failed',
    };
  }

  /**
   * Classify generic error
   */
  static classifyError(error: any): ClassifiedError {
    if (error?.response?.status) {
      return this.classifyHttpError(error.response.status, error.response.data);
    }

    if (error?.code) {
      return this.classifyNetworkError(error);
    }

    return {
      type: ErrorType.RETRYABLE,
      code: 'UNKNOWN_ERROR',
      message: error?.message || 'Unknown error',
      retryable: true,
      userFacing: 'Unexpected error - will retry',
    };
  }
}
