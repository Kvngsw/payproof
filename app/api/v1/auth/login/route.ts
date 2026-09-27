import bcrypt from 'bcrypt';
import { z }  from 'zod';
import { NextRequest } from 'next/server';
import db     from '@/lib/db';
import { logger }          from '@/lib/logger';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';
import { getRequestId, DUMMY_HASH } from '@/lib/auth';
import { issueAndSendOtp } from '@/lib/otp';
import { ok, badRequest, unauthorized, handleError, tooManyRequestsResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  email:    z.string().trim().email('email is required'),
  password: z.string().min(1, 'password is required'),
});

// Auth v2 (A1): one password form for both roles. Checks Seller.passwordHash
// (wins) or Buyer.passwordHash, then emails an OTP — the token only comes from
// POST /auth/otp/verify (A2). Never reveals which account exists.
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
    const buyer  = seller
      ? null
      : await db.buyer.findUnique({ where: { email: cleanEmail } });

    let role: 'seller' | 'buyer' | null = null;

    if (seller) {
      let match = false;
      try {
        match = await bcrypt.compare(password, seller.passwordHash ?? DUMMY_HASH); // same cost on miss: identical timing whether the email exists
      } catch {
        // fall through to failed login
      }
      if (match) role = 'seller';
    } else if (buyer?.passwordHash) {
      let match = false;
      try {
        match = await bcrypt.compare(password, buyer.passwordHash);
      } catch {
        // fall through to failed login
      }
      if (match) role = 'buyer';
    } else if (buyer) {
      // legacy OTP-only buyer: burn a compare so timing matches
      await bcrypt.compare(password, DUMMY_HASH).catch(() => {});
    } else {
      await bcrypt.compare(password, DUMMY_HASH).catch(() => {});
    }

    if (!role) {
      logger.warn('Login failed — invalid credentials', { email: cleanEmail, requestId });
      return unauthorized('Invalid email or password.');
    }

    const { delivery } = await issueAndSendOtp(cleanEmail);

    logger.info('Auth v2 login OTP sent', { email: cleanEmail, role, requestId });

    return ok({ sent: true, role, delivery }, 202);
  } catch (err) {
    return handleError(err, 'POST /api/v1/auth/login', requestId);
  }
}
