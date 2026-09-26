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
