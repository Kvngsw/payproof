import bcrypt from 'bcrypt';
import { z }  from 'zod';
import { NextRequest } from 'next/server';
import db     from '@/lib/db';
import { logger }           from '@/lib/logger';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';
import { getRequestId } from '@/lib/auth';
import { issueAndSendOtp } from '@/lib/otp';
import { ok, badRequest, handleError, tooManyRequestsResponse, conflict } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const BCRYPT_ROUNDS = 12;

const BodySchema = z.object({
  name:     z.string().trim().min(2, 'name must be at least 2 characters'),
  email:    z.string().trim().email('email must be a valid email address'),
  password: z.string().min(8, 'password must be at least 8 characters'),
});

// Auth v2 (A3): buyers register with a password (OTP auto-create is dead).
// One account per email across Seller+Buyer — 409 on either.
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const ip        = clientIp(request);

  const { allowed, retryAfterMs } = await checkRateLimit(`reg:${ip}`, 5, 15 * 60_000);
  if (!allowed) {
    logger.warn('Register rate limit exceeded', { ip, requestId });
    return tooManyRequestsResponse(retryAfterMs);
  }

  try {
    const raw    = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);

    if (!parsed.success) {
      const details = Object.fromEntries(
        parsed.error.issues.map((i) => [i.path.join('.'), i.message]),
      );
      return badRequest(parsed.error.issues[0].message, 'VALIDATION', details);
    }

    const { name, email, password } = parsed.data;
    const cleanEmail = email.toLowerCase();

    const duplicate = 'An account with this email already exists. Please log in.';
    if (await db.buyer.findUnique({ where: { email: cleanEmail } })) {
      return conflict(duplicate);
    }
    if (await db.seller.findUnique({ where: { email: cleanEmail } })) {
      return conflict(duplicate); // uniqueness: one account per email across Seller+Buyer
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    let buyer;
    try {
      buyer = await db.buyer.create({
        data: { name, email: cleanEmail, passwordHash },
      });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2002') {
        return conflict(duplicate);
      }
      throw err;
    }

    logger.info('Buyer registered', { buyerId: buyer.id, email: cleanEmail, requestId });

    // Auth v2 (A3): no token at register — OTP verification at
    // /auth/otp/verify signs them in. Roll back if email delivery fails so a
    // retry works once SMTP is configured.
    let delivery: 'email';
    try {
      ({ delivery } = await issueAndSendOtp(cleanEmail));
    } catch (otpErr) {
      logger.error('OTP send failed — rolling back buyer', {
        buyerId: buyer.id,
        err: otpErr,
        requestId,
      });
      await db.buyer.delete({ where: { id: buyer.id } }).catch(() => {});
      throw otpErr;
    }

    logger.info('Buyer register OTP sent', { buyerId: buyer.id, email: cleanEmail, requestId });

    return ok({ sent: true, delivery }, 202);
  } catch (err) {
    return handleError(err, 'POST /api/v1/auth/buyer/register', requestId);
  }
}
