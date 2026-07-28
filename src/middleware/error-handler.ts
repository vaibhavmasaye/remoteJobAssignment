import { FastifyError, FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getLogger } from '../observability/logger';
import { ErrorClassifier } from '../sync/error-classifier';
import { ErrorType } from '../sync/types';

const logger = getLogger('error-handler');

/**
 * Custom error response structure
 */
interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  requestId?: string;
  timestamp: string;
  details?: Record<string, any>;
}

/**
 * Map internal error types to HTTP status codes
 */
function getHttpStatusCode(error: any): number {
  // Fastify validation errors
  if (error.statusCode) {
    return error.statusCode;
  }

  // Zod validation errors
  if (error instanceof Error && error.message.includes('Validation')) {
    return 400;
  }

  // Classify using ErrorClassifier
  const classified = ErrorClassifier.classifyError(error);
  if (classified.httpStatus) {
    return classified.httpStatus;
  }

  // Default to 500
  return 500;
}

/**
 * Build error response object
 */
function buildErrorResponse(error: any, requestId?: string): ErrorResponse {
  const timestamp = new Date().toISOString();
  const classified = ErrorClassifier.classifyError(error);

  return {
    error: classified.code,
    message: classified.userFacing || classified.message,
    code: classified.type,
    requestId,
    timestamp,
    details: classified.retryable ? { retryable: true } : undefined,
  };
}

/**
 * Log error with appropriate severity
 */
function logError(error: any, request: FastifyRequest, statusCode: number): void {
  const requestId = request.id;
  const metadata = {
    requestId,
    method: request.method,
    url: request.url,
    statusCode,
    ip: request.ip,
  };

  if (statusCode >= 500) {
    logger.error(
      { ...metadata, error, stack: error instanceof Error ? error.stack : undefined },
      'Unhandled error'
    );
  } else if (statusCode >= 400) {
    logger.warn(
      { ...metadata, error: error instanceof Error ? error.message : String(error) },
      'Client error'
    );
  }
}

/**
 * Global error handler for Fastify
 */
export async function registerErrorHandler(fastify: FastifyInstance): Promise<void> {
  fastify.setErrorHandler(async (error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) => {
    const statusCode = getHttpStatusCode(error);
    const errorResponse = buildErrorResponse(error, request.id);

    logError(error, request, statusCode);

    reply.code(statusCode).send(errorResponse);
  });

  // Handle 404 errors
  fastify.setNotFoundHandler((_request: FastifyRequest, reply: FastifyReply) => {
    reply.code(404).send({
      error: 'NotFound',
      message: 'The requested resource was not found',
      timestamp: new Date().toISOString(),
    });
  });
}

/**
 * Middleware to catch synchronous errors and format them
 */
export async function errorCatcherMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    // This handler does nothing; it's a safety net for middleware chains
  } catch (error) {
    const statusCode = getHttpStatusCode(error);
    const errorResponse = buildErrorResponse(error, request.id);

    logError(error, request, statusCode);

    reply.code(statusCode).send(errorResponse);
  }
}
