import crypto from 'crypto';
import { getLogger } from '../observability/logger';

const logger = getLogger('webhook-verification');

/**
 * Verify HubSpot webhook signature
 * https://developers.hubspot.com/docs/api/webhooks/validating-requests
 */
export function verifyHubSpotSignature(
  requestBody: string,
  signature: string,
  clientSecret: string
): boolean {
  const hash = crypto
    .createHmac('sha256', clientSecret)
    .update(Buffer.from(requestBody))
    .digest('hex');

  const isValid = crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  if (!isValid) {
    logger.warn({ signature, computed: hash }, 'HubSpot signature mismatch');
  }
  return isValid;
}

/**
 * Verify Stripe webhook signature
 * https://docs.stripe.com/webhooks/signature
 */
export function verifyStripeSignature(
  requestBody: string,
  timestamp: string,
  signature: string,
  webhookSecret: string
): boolean {
  // Signed content is timestamp.body
  const signedContent = `${timestamp}.${requestBody}`;

  const hash = crypto
    .createHmac('sha256', webhookSecret)
    .update(Buffer.from(signedContent))
    .digest('hex');

  // Stripe signature format: t=timestamp,v1=hash,v0=legacy
  const computedSignature = `v1=${hash}`;

  // Extract v1 signature from header
  const signatures = signature.split(',').map((s) => s.trim());
  const v1Signature = signatures.find((s) => s.startsWith('v1='))?.substring(3);

  if (!v1Signature) {
    logger.warn('No v1 signature found in Stripe header');
    return false;
  }

  const isValid = crypto.timingSafeEqual(Buffer.from(v1Signature), Buffer.from(hash));
  if (!isValid) {
    logger.warn({ provided: v1Signature, computed: hash }, 'Stripe signature mismatch');
  }
  return isValid;
}

/**
 * Verify Google Calendar notification signature
 */
export function verifyGoogleCalendarChannel(
  channelToken: string,
  resourceId: string,
  calendarId: string,
  expectedChannelId: string,
  expectedChannelToken: string
): boolean {
  // Basic validation - in production, validate via Google API
  const isValid = channelToken === expectedChannelToken && resourceId !== undefined;

  if (!isValid) {
    logger.warn(
      { channelToken, resourceId, expectedChannelToken },
      'Google Calendar channel validation failed'
    );
  }
  return isValid;
}
