/**
 * lib/email.ts — Resend email wrapper.
 *
 * WHY: Buyer OTP delivery via email. If email fails during demo,
 * OTP_MODE=dev returns the code in the API response with a visible banner.
 * No silent failures — the caller knows which delivery mode was used.
 */

import { logger } from './logger';
import { env } from './env';

export type DeliveryMode = 'email' | 'dev_screen';

export interface OtpDeliveryResult {
  delivery: DeliveryMode;
  devCode?: string;  // only present when OTP_MODE=dev
}

/**
 * Send an OTP code to the buyer's email, or return it in the response
 * if OTP_MODE=dev. The caller includes delivery mode in the API response
 * so the frontend can show the appropriate banner.
 */
export async function sendOtp(
  email:   string,
  code:    string,
): Promise<OtpDeliveryResult> {
  // Validated at boot by lib/env.ts (OTP_MODE enum, NODE_ENV enum).
  const mode = env.OTP_MODE;

  if (mode === 'dev') {
    logger.info('OTP dev mode — code returned in response', {
      email,
      // Log code in dev only — never in production
      ...(env.NODE_ENV !== 'production' && { code }),
    });
    return { delivery: 'dev_screen', devCode: code };
  }

  // Production — send via Resend (key required at boot, no null check needed).
  const apiKey = env.RESEND_API_KEY;

  const fromEmail = env.OTP_FROM_EMAIL;

  // Display-name format for the From header; env holds the bare address
  // so Zod email validation stays strict.
  const from = `PayProof <${fromEmail}>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to:      email,
      subject: 'Your PayProof login code',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Your PayProof code</h2>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px;">${code}</p>
          <p>This code expires in 10 minutes. Do not share it.</p>
          <p style="color: #888; font-size: 12px;">If you didn't request this, ignore this email.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    logger.error('Resend email failed', { email, status: response.status, body: body.slice(0, 200) });
    throw new Error(`Resend failed: ${response.status}`);
  }

  logger.info('OTP email sent', { email });
  return { delivery: 'email' };
}
