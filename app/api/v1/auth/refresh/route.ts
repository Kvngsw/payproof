/**
 * app/api/v1/auth/refresh/route.ts — Rotate refresh token (E05 companion).
 *
 * POST, no body. Reads `pp_refresh` httpOnly cookie, verifies it, and issues
 * a fresh access (15m) + refresh (7d) pair. The new refresh cookie overwrites
 * the old one — rotation invalidates the previous token implicitly since only
 * the newest cookie value is stored client-side.
 *
 * Security:
 *   ✓ Refresh token never touches JS (httpOnly cookie, Path-scoped)
 *   ✓ Same generic 401 whether cookie missing, expired, or forged
 *   ✓ Rate limited per IP (30/min — refresh is cheap but abusable)
 */

import { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';
import {
  signAccessToken,
  signRefreshToken,
  refreshCookieHeader,
  clearRefreshCookieHeader,
  extractRefreshToken,
  getRequestId,
} from '@/lib/auth';
import { ok, unauthorized, handleError, tooManyRequestsResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const ip = clientIp(request);

  const { allowed, retryAfterMs } = await checkRateLimit(`refresh:${ip}`, 30, 60_000);
  if (!allowed) {
    return tooManyRequestsResponse(retryAfterMs);
  }

  try {
    const claims = extractRefreshToken(request);

    if (!claims) {
      // Missing, expired, or forged — same response, no oracle.
      const res = unauthorized('Session expired. Please log in again.');
      res.headers.set('Set-Cookie', clearRefreshCookieHeader());
      return res;
    }

    const payload = { sub: claims.sub, role: claims.role as 'seller' | 'buyer' };
    const access = signAccessToken(payload);
    const refresh = signRefreshToken(payload);

    logger.debug('Refresh token rotated', { sub: claims.sub, requestId });

    const response = ok({ token: access });
    response.headers.set('Set-Cookie', refreshCookieHeader(refresh));
    return response;
  } catch (err) {
    return handleError(err, 'POST /api/v1/auth/refresh', requestId);
  }
}
