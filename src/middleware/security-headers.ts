import { FastifyReply } from 'fastify';

/**
 * Apply security headers to response
 * Protects against common web vulnerabilities:
 * - X-Content-Type-Options: Prevent MIME type sniffing
 * - X-Frame-Options: Prevent clickjacking
 * - X-XSS-Protection: Legacy XSS protection (browsers support varies)
 * - Strict-Transport-Security: Force HTTPS
 * - Content-Security-Policy: Restrict resource loading
 */
export function applySecurityHeaders(reply: FastifyReply): FastifyReply {
  return reply
    .header('X-Content-Type-Options', 'nosniff')
    .header('X-Frame-Options', 'DENY')
    .header('X-XSS-Protection', '1; mode=block')
    .header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    .header('Content-Security-Policy', "default-src 'self'")
    .header('Referrer-Policy', 'strict-origin-when-cross-origin')
    .header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
}

/**
 * Fastify plugin to apply security headers to all responses
 */
export async function registerSecurityHeadersPlugin(fastify: any): Promise<void> {
  fastify.addHook('onSend', async (request: any, reply: any) => {
    applySecurityHeaders(reply);
  });
}
