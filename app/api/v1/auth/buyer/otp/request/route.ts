/**
 * app/api/v1/auth/buyer/otp/request/route.ts — Buyer OTP request (E03).
 *
 * POST body: { email }
 * Response 202: { sent: true, delivery: 'email' | 'dev_screen', dev_code? }
 *
 * Security:
 *   ✓ Rate limiting: 5 OTP requests per email per 15 minutes
 *   ✓ Zod validation
 *   ✓ OTP stored as bcrypt hash — never plaintext in DB
 *   ✓ dev_code only returned when OTP_MODE=dev
 *   ✓ No user enumeration (same response whether email exists or not)
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { z }  from 'zod';
import { NextRequest } from 'next/server';
import db     from '@/lib/db';
import { logger }          from '@/lib/logger';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';
import { getRequestId }    from '@/lib/auth';
import { sendOtp }         from '@/lib/email';
import { handleError, tooManyRequestsResponse } from '@/lib/api-response';
import { NextResponse }    from 'next/server';

export const dynamic = 'force-dynamic';

const OTP_EXPIRY_MINUTES = 10;
const OTP_BCRYPT_ROUNDS  = 10; // Lower rounds — OTPs expire fast, UX matters

const BodySchema = z.object({
  email: z.string().trim().email('email must be a valid email address'),
});

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const ip        = clientIp(request);

  try {
    const raw    = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION', message: parsed.error.issues[0].message } },
        { status: 400 },
      );
    }

    const { email } = parsed.data;
    const cleanEmail = email.toLowerCase();

    // ── Rate limit per email: 5 OTPs per 15 minutes ────────────────────────
    const { allowed, retryAfterMs } = await checkRateLimit(
      `otp:req:${cleanEmail}`,
      5,
      15 * 60_000,
    );
    if (!allowed) {
      logger.warn('OTP request rate limit exceeded', { email: cleanEmail, ip, requestId });
      return tooManyRequestsResponse(retryAfterMs);
    }

    // ── Generate 6-digit code ──────────────────────────────────────────────
    // crypto.randomInt is cryptographically secure (not Math.random).
    const code     = String(crypto.randomInt(100_000, 999_999));
    const codeHash = await bcrypt.hash(code, OTP_BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000);

    // ── Upsert buyer (create if first OTP) ────────────────────────────────
    await db.buyer.upsert({
      where:  { email: cleanEmail },
      update: {},
      create: { email: cleanEmail },
    });

    // ── Store OTP (invalidates any previous unused code for this email) ────
    // We don't delete old codes — expired ones are ignored at verify time.
    await db.otpCode.create({
      data: { email: cleanEmail, codeHash, expiresAt },
    });

    // ── Send OTP ───────────────────────────────────────────────────────────
    const delivery = await sendOtp(cleanEmail, code);

    logger.info('OTP requested', {
      email:    cleanEmail,
      delivery: delivery.delivery,
      requestId,
    });

    return NextResponse.json(
      {
        sent:     true,
        delivery: delivery.delivery,
        // dev_code only present in dev mode — never in production
        ...(delivery.devCode !== undefined && { dev_code: delivery.devCode }),
      },
      { status: 202 },
    );
  } catch (err) {
    return handleError(err, 'POST /api/v1/auth/buyer/otp/request', requestId);
  }
}
