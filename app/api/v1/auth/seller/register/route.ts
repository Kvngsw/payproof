import crypto  from 'crypto';
import bcrypt  from 'bcrypt';
import { z }   from 'zod';
import { NextRequest } from 'next/server';
import db      from '@/lib/db';
import { logger }           from '@/lib/logger';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';
import { signAccessToken, signRefreshToken, refreshCookieHeader, getRequestId } from '@/lib/auth';
import { createReservedAccount, validateBankAccount } from '@/lib/monnify';
import { ok, badRequest, handleError, tooManyRequestsResponse, conflict } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const BCRYPT_ROUNDS = 12;

const BodySchema = z.object({
  name:         z.string().trim().min(2, 'name must be at least 2 characters'),
  email:        z.string().trim().email('email must be a valid email address'),
  password:     z.string().min(8, 'password must be at least 8 characters'),
  phone:        z.string().trim().min(10, 'phone must be at least 10 digits').regex(/^\+?[\d\s-]+$/, 'invalid phone number'),
  businessName: z.string().trim().min(2, 'businessName is required'),
  bvn:          z.string().regex(/^\d{11}$/, 'BVN must be exactly 11 digits'),
  settlement: z.object({
    bankCode:      z.string().min(1, 'settlement.bankCode is required'),
    accountNumber: z.string().min(10, 'settlement.accountNumber must be at least 10 digits'),
  }),
});

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

    const existing = await db.seller.findUnique({ where: { email: cleanEmail } });
    if (existing) return conflict('An account with this email already exists. Please log in.');

    let validated: { accountName: string; accountNumber: string; bankCode: string };
    try {
      validated = await validateBankAccount(settlement.bankCode, settlement.accountNumber);
    } catch {
      return badRequest(
        'Could not validate settlement bank account. Please check your bank code and account number.',
      );
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const bvnHash = crypto.createHash('sha256').update(bvn).digest('hex'); // BVN never stored plaintext; hash is one-way

    let seller;
    try {
      seller = await db.seller.create({
        data: {
          name,
          email:           cleanEmail,
          passwordHash,
          phone,
          businessName,
          bvnHash,
          settlementBank:   settlement.bankCode,
          settlementNumber: settlement.accountNumber,
          settlementName:   validated.accountName,
        },
      });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2002') {
        return conflict('An account with this email already exists. Please log in.');
      }
      throw err;
    }

    logger.info('Seller registered', { sellerId: seller.id, email: cleanEmail, requestId });

    let reservedAccount: { accountNumber: string; bankName: string; accountName: string } | null = null;
    try {
      reservedAccount = await createReservedAccount({
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

    const payload  = { sub: seller.id, role: 'seller' as const, name: seller.name };
    const access   = signAccessToken(payload);
    const refresh  = signRefreshToken(payload);

    logger.info('Seller login token issued', { sellerId: seller.id, requestId });

    const response = ok(
      {
        token: access,
        seller: {
          id:           seller.id,
          name:         seller.name,
          businessName: seller.businessName,
          email:        seller.email,
          role:         'seller',
        },
        reserved_account: reservedAccount
          ? {
              account_number: reservedAccount.accountNumber,
              bank_name:      reservedAccount.bankName,
              account_name:   reservedAccount.accountName,
            }
          : null,
      },
      201,
    );

    response.headers.set('Set-Cookie', refreshCookieHeader(refresh));

    return response;
  } catch (err) {
    return handleError(err, 'POST /api/v1/auth/seller/register', requestId);
  }
}
