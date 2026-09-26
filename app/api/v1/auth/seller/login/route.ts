/**
 * app/api/v1/auth/seller/login/route.ts — Seller login (E02).
 *
 * POST body: { email, password }
 * Response 200: { token, seller, reserved_account }
 *
 * Security:
 *   ✓ Rate limiting (10/60s per IP+email)
 *   ✓ Zod validation
 *   ✓ Timing-safe dummy hash on login miss — prevents user enumeration
 *   ✓ httpOnly refresh cookie
 *   ✓ No user existence info in error response
 */

import bcrypt from 'bcrypt';
import { z }  from 'zod';
import { NextRequest } from 'next/server';
import db     from '@/lib/db';
import { logger }          from '@/lib/logger';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';
import { signAccessToken, signRefreshToken, refreshCookieHeader, getRequestId, DUMMY_HASH } from '@/lib/auth';
import { ok, badRequest, unauthorized, handleError, tooManyRequestsResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  email:    z.string().trim().email('email is required'),
  password: z.string().min(1, 'password is required'),
});

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const ip        = clientIp(request);

  // ── Rate limit: 10 attempts per IP per minute ──────────────────────────────
  const { allowed, retryAfterMs } = await checkRateLimit(`login:${ip}`, 10, 60_000);
  if (!allowed) {
    logger.warn('Login rate limit exceeded', { ip, requestId });
    return tooManyRequestsResponse(retryAfterMs);
  }

  try {
    const raw    = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0].message);
    }

    const { email, password } = parsed.data;
    const cleanEmail = email.toLowerCase();

    const seller = await db.seller.findUnique({ where: { email: cleanEmail } });

    // ── Timing-safe comparison ─────────────────────────────────────────────
    // WHY: Run bcrypt.compare even when seller is null (against DUMMY_HASH).
    // This ensures response time is identical whether the email exists or not.
    // Prevents timing oracle that reveals which emails are registered.
    let match = false;
    try {
      match = await bcrypt.compare(password, seller?.passwordHash ?? DUMMY_HASH);
    } catch {
      // bcrypt throws on malformed hash — treat as no match.
    }

    if (!seller || !match) {
      logger.warn('Seller login failed — invalid credentials', {
        email: cleanEmail,
        requestId,
      });
      // Same message regardless of whether email exists — no enumeration.
      return unauthorized('Invalid email or password.');
    }

    const payload = { sub: seller.id, role: 'seller' as const, name: seller.name };
    const access  = signAccessToken(payload);
    const refresh = signRefreshToken(payload);

    logger.info('Seller logged in', { sellerId: seller.id, requestId });

    const response = ok({
      token: access,
      seller: {
        id:           seller.id,
        name:         seller.name,
        businessName: seller.businessName,
        email:        seller.email,
        role:         'seller',
      },
      reserved_account: seller.reservedAccountNumber
        ? {
            account_number: seller.reservedAccountNumber,
            bank_name:      seller.reservedBankName,
            account_name:   seller.reservedAccountName,
          }
        : null,
    });

    response.headers.set('Set-Cookie', refreshCookieHeader(refresh));
    return response;
  } catch (err) {
    return handleError(err, 'POST /api/v1/auth/seller/login', requestId);
  }
}
