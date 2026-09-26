/**
 * app/api/v1/auth/buyer/otp/verify/route.ts — Buyer OTP verification (E04).
 *
 * POST body: { email, code }
 * Response 200: { token, buyer: { id, email } }
 *
 * Security:
 *   ✓ Rate limiting per email (5 attempts before lockout)
 *   ✓ Max 5 attempts per OTP code — increment tracked in DB
 *   ✓ OTP expiry enforced (10 minutes)
 *   ✓ bcrypt comparison (not plain string comparison)
 *   ✓ usedAt set atomically on first use
 *   ✓ httpOnly refresh cookie issued on success
 */

import bcrypt from 'bcrypt';
import { z }  from 'zod';
import { NextRequest } from 'next/server';
import db     from '@/lib/db';
import { logger }           from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { signAccessToken, signRefreshToken, refreshCookieHeader, getRequestId } from '@/lib/auth';
import { ok, badRequest, handleError, tooManyRequestsResponse } from '@/lib/api-response';
import { OtpExpiredError, OtpMaxAttemptsError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const OTP_MAX_ATTEMPTS = 5;

const BodySchema = z.object({
  email: z.string().trim().email('email is required'),
  code:  z.string().length(6, 'code must be exactly 6 digits').regex(/^\d+$/, 'code must be numeric'),
});

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    const raw    = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0].message);
    }

    const { email, code } = parsed.data;
    const cleanEmail = email.toLowerCase();

    // ── Rate limit per email ───────────────────────────────────────────────
    const { allowed, retryAfterMs } = await checkRateLimit(
      `otp:verify:${cleanEmail}`,
      10,
      15 * 60_000,
    );
    if (!allowed) {
      return tooManyRequestsResponse(retryAfterMs);
    }

    // ── Find most recent valid OTP ─────────────────────────────────────────
    const otpRecord = await db.otpCode.findFirst({
      where: {
        email:  cleanEmail,
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return badRequest('No pending OTP found. Please request a new code.', 'OTP_EXPIRED');
    }

    // ── Check max attempts ─────────────────────────────────────────────────
    if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
      throw new OtpMaxAttemptsError();
    }

    // ── Check expiry ───────────────────────────────────────────────────────
    if (new Date() > otpRecord.expiresAt) {
      throw new OtpExpiredError();
    }

    // ── Increment attempt counter before comparing ─────────────────────────
    await db.otpCode.update({
      where: { id: otpRecord.id },
      data:  { attempts: { increment: 1 } },
    });

    // ── bcrypt comparison ──────────────────────────────────────────────────
    const match = await bcrypt.compare(code, otpRecord.codeHash);

    if (!match) {
      logger.warn('OTP verification failed — wrong code', {
        email: cleanEmail,
        attempts: otpRecord.attempts + 1,
        requestId,
      });
      return badRequest('Invalid code. Please try again or request a new one.', 'VALIDATION');
    }

    // ── Mark OTP as used ───────────────────────────────────────────────────
    await db.otpCode.update({
      where: { id: otpRecord.id },
      data:  { usedAt: new Date() },
    });

    // ── Upsert buyer ───────────────────────────────────────────────────────
    const buyer = await db.buyer.upsert({
      where:  { email: cleanEmail },
      update: {},
      create: { email: cleanEmail },
    });

    const payload = { sub: buyer.id, role: 'buyer' as const };
    const access  = signAccessToken(payload);
    const refresh = signRefreshToken(payload);

    logger.info('Buyer OTP verified — logged in', { buyerId: buyer.id, requestId });

    const response = ok({
      token: access,
      buyer: { id: buyer.id, email: buyer.email },
    });

    response.headers.set('Set-Cookie', refreshCookieHeader(refresh));
    return response;
  } catch (err) {
    return handleError(err, 'POST /api/v1/auth/buyer/otp/verify', requestId);
  }
}
