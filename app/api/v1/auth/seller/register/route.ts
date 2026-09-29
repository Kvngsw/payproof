import crypto  from 'crypto';
import bcrypt  from 'bcrypt';
import { z }   from 'zod';
import { NextRequest } from 'next/server';
import db      from '@/lib/db';
import { logger }           from '@/lib/logger';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';
import { getRequestId } from '@/lib/auth';
import { issueAndSendOtp } from '@/lib/otp';
import type { DeliveryMode } from '@/lib/email';
import { createReservedAccount, validateBankAccount } from '@/lib/monnify';
import { ok, badRequest, handleError, tooManyRequestsResponse, conflict } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const BCRYPT_ROUNDS = 12;

// Auth v2 (A4) + V5: single-step payload {name,email,password} — business
// details are optional here and collected post-signup via PATCH /auth/me (A7).
// Empty strings from older clients are treated as "not provided".
const BodySchema = z.object({
  name:         z.string().trim().min(2, 'name must be at least 2 characters'),
  email:        z.string().trim().email('email must be a valid email address'),
  password:     z.string().min(8, 'password must be at least 8 characters'),
  phone:        emptyToUndefined(
    z.string().trim().min(10, 'phone must be at least 10 digits').regex(/^\+?[\d\s-]+$/, 'invalid phone number'),
  ),
  businessName: emptyToUndefined(
    z.string().trim().min(2, 'businessName must be at least 2 characters'),
  ),
  bvn: emptyToUndefined(
    z.string().trim().regex(/^\d{11}$/, 'BVN must be exactly 11 digits'),
  ),
  settlement: z
    .object({
      bankCode:      z.string().min(1, 'settlement.bankCode is required'),
      accountNumber: z.string().min(10, 'settlement.accountNumber must be at least 10 digits'),
    })
    .optional(),
});

function emptyToUndefined<T extends z.ZodType>(schema: T) {
  return z.preprocess((v) => (v === '' || v === null ? undefined : v), schema.optional());
}

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

    const { name, email, password, phone, businessName, bvn, settlement } = parsed.data;
    const cleanEmail = email.toLowerCase();

    const duplicate = 'An account with this email already exists. Please log in.';
    if (await db.seller.findUnique({ where: { email: cleanEmail } })) {
      return conflict(duplicate);
    }
    if (await db.buyer.findUnique({ where: { email: cleanEmail } })) {
      return conflict(duplicate); // uniqueness: one account per email across Seller+Buyer
    }

    let validated: { accountName: string; accountNumber: string; bankCode: string } | null = null;
    if (settlement) {
      try {
        validated = await validateBankAccount(settlement.bankCode, settlement.accountNumber);
      } catch {
        return badRequest(
          'Could not validate settlement bank account. Please check your bank code and account number.',
        );
      }
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const bvnHash = bvn ? crypto.createHash('sha256').update(bvn).digest('hex') : null; // BVN never stored plaintext; hash is one-way

    let seller;
    try {
      seller = await db.seller.create({
        data: {
          name,
          email:           cleanEmail,
          passwordHash,
          phone:           phone ?? '',
          businessName:    businessName ?? name,
          bvnHash,
          settlementBank:   validated?.bankCode    ?? null,
          settlementNumber: validated?.accountNumber ?? null,
          settlementName:   validated?.accountName  ?? null,
        },
      });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2002') {
        return conflict(duplicate);
      }
      throw err;
    }

    logger.info('Seller registered', { sellerId: seller.id, email: cleanEmail, requestId });

    // Reserved account only when a BVN came with the register payload; the
    // single-step flow defers it to PATCH /auth/me (A7) otherwise.
    if (bvn) {
      try {
        const reservedAccount = await createReservedAccount({
          userId: seller.id,
          name:   seller.name,
          email:  seller.email,
          bvn,
        });

        await db.seller.update({
          where: { id: seller.id },
          data: {
            reservedAccountNumber: reservedAccount.accountNumber,
            reservedBankName:      reservedAccount.bankName,
            reservedAccountName:   reservedAccount.accountName,
          },
        });
      } catch (monnifyErr) {

        logger.error('Monnify reserved account failed — rolling back', {
          sellerId: seller.id,
          err: monnifyErr,
          requestId,
        });
        await db.seller.delete({ where: { id: seller.id } }).catch(() => {}); // rail failed: no seller without an account
        return badRequest(
          "We couldn't open your reserved account with Monnify. " +
          "Please double-check your BVN and try again.",
        );
      }
    }

    // Auth v2 (A4): no token at register — OTP verification at /auth/otp/verify
    // signs them in. Roll the seller back if email delivery fails so a retry
    // works once SMTP is configured.
    let delivery: DeliveryMode;
    try {
      ({ delivery } = await issueAndSendOtp(cleanEmail));
    } catch (otpErr) {
      logger.error('OTP send failed — rolling back seller', {
        sellerId: seller.id,
        err: otpErr,
        requestId,
      });
      await db.seller.delete({ where: { id: seller.id } }).catch(() => {});
      throw otpErr;
    }

    logger.info('Seller register OTP sent', { sellerId: seller.id, email: cleanEmail, requestId });

    return ok({ sent: true, delivery }, 202);
  } catch (err) {
    return handleError(err, 'POST /api/v1/auth/seller/register', requestId);
  }
}
