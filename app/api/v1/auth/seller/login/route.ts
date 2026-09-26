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

    let match = false;
    try {
      match = await bcrypt.compare(password, seller?.passwordHash ?? DUMMY_HASH); // same cost on miss: identical timing whether the email exists
    } catch {

    }

    if (!seller || !match) {
      logger.warn('Seller login failed — invalid credentials', {
        email: cleanEmail,
        requestId,
      });

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
