import { FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodError } from 'zod';
import { getLogger } from '../observability/logger';

const logger = getLogger('request-validation');

/**
 * Validate request body against a Zod schema
 */
export function createBodyValidationHandler(schema: z.ZodSchema) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      schema.parse(request.body);
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn({ errors: error.issues }, 'Request body validation failed');
        return reply.code(400).send({
          error: 'Validation error',
          details: error.issues.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
            code: e.code,
          })),
        });
      }
      throw error;
    }
  };
}

/**
 * Validate request query parameters against a Zod schema
 */
export function createQueryValidationHandler(schema: z.ZodSchema) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      schema.parse(request.query);
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn({ errors: error.issues }, 'Query parameter validation failed');
        return reply.code(400).send({
          error: 'Validation error',
          details: error.issues.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
            code: e.code,
          })),
        });
      }
      throw error;
    }
  };
}

/**
 * Validate request parameters (path variables) against a Zod schema
 */
export function createParamValidationHandler(schema: z.ZodSchema) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      schema.parse(request.params);
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn({ errors: error.issues }, 'Path parameter validation failed');
        return reply.code(400).send({
          error: 'Validation error',
          details: error.issues.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
            code: e.code,
          })),
        });
      }
      throw error;
    }
  };
}

/**
 * Common schemas for API validation
 */
export const commonSchemas = {
  idempotencyKey: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  runId: z.string().uuid(),
  externalId: z.string().min(1).max(500),
  source: z.string().min(1).max(100),
  type: z.string().min(1).max(100),
};
