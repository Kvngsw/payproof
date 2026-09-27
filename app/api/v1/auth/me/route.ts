import crypto from 'crypto';
import { z }  from 'zod';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { logger } from '@/lib/logger';
import { authenticate, getRequestId } from '@/lib/auth';
import { createReservedAccount, validateBankAccount } from '@/lib/monnify';
import { ok, unauthorized, badRequest, handleError } from '@/lib/api-response';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    const claims = authenticate(request);
    if (!claims) {
      return unauthorized();
    }

    if (claims.role === 'seller') {
      const seller = await db.seller.findUnique({
        where: { id: String(claims.sub) },
        select: {
          id: true,
          name: true,
          businessName: true,
          email: true,
          phone: true,
          settlementBank: true,
          settlementNumber: true,
          reservedAccountNumber: true,
          reservedBankName: true,
          reservedAccountName: true,
        },
      });

      if (!seller) {

        logger.warn('me: seller not found for valid token', { sub: claims.sub, requestId });
        return unauthorized('Session expired. Please log in again.');
      }

      return ok({
        role: 'seller',
        profile: {
          id: seller.id,
          name: seller.name,
          businessName: seller.businessName,
          email: seller.email,
          phone: seller.phone,
          settlement: seller.settlementNumber && seller.settlementBank
            ? { bankCode: seller.settlementBank, accountNumber: seller.settlementNumber }
            : null,
          reserved_account: seller.reservedAccountNumber
            ? {
                account_number: seller.reservedAccountNumber,
                bank_name: seller.reservedBankName,
                account_name: seller.reservedAccountName,
              }
            : null,
        },
      });
    }

    const buyer = await db.buyer.findUnique({
      where: { id: String(claims.sub) },
      select: { id: true, email: true },
    });

    if (!buyer) {
      logger.warn('me: buyer not found for valid token', { sub: claims.sub, requestId });
      return unauthorized('Session expired. Please log in again.');
    }

    return ok({ role: 'buyer', profile: buyer });
  } catch (err) {
    return handleError(err, 'GET /api/v1/auth/me', requestId);
  }
}

// Auth v2 (A7): seller profile edits (name/phone/business/bvn/settlement).
// Mirrors the mock contract — presence-based fields, snake_case in/out,
// regenerates reserved_account_name when the public name changes.
const PatchSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').optional(),
  phone: z.string().optional(),
  business_name: z.string().optional(),
  bvn: z.string().optional(),
  settlement: z
    .union([
      z.object({
        bankCode: z.string().optional(),
        accountNumber: z.string().optional(),
      }),
      z.null(),
    ])
    .optional(),
});

export async function PATCH(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    const claims = authenticate(request);
    if (!claims || claims.role !== 'seller') {
      return unauthorized('Seller token required.');
    }

    const seller = await db.seller.findUnique({
      where: { id: String(claims.sub) },
    });
    if (!seller) {
      logger.warn('PATCH me: seller not found for valid token', { sub: claims.sub, requestId });
      return unauthorized('Session expired. Please log in again.');
    }

    const raw = await request.json().catch(() => ({}));
    const parsed = PatchSchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0].message);
    }

    const body = parsed.data;
    const has = (v: unknown) => v !== undefined;
    if (!has(body.name) && !has(body.phone) && !has(body.business_name) && !has(body.bvn) && !has(body.settlement)) {
      return badRequest('No fields to update.');
    }

    if (has(body.bvn) && body.bvn?.trim() && !/^\d{11}$/.test(body.bvn.trim())) {
      return badRequest('BVN must be 11 digits');
    }

    let settlementPatch: { bankCode: string; accountNumber: string } | null | undefined;
    if (has(body.settlement)) {
      if (body.settlement === null) {
        settlementPatch = null;
      } else {
        const bankCode = (body.settlement.bankCode ?? '').trim();
        const accountNumber = (body.settlement.accountNumber ?? '').trim();
        if (bankCode || accountNumber) {
          if (!/^\d{10}$/.test(accountNumber)) {
            return badRequest('Settlement account number must be 10 digits');
          }
          if (!bankCode) {
            return badRequest('Bank code is required');
          }
          settlementPatch = { bankCode, accountNumber };
        } else {
          settlementPatch = null;
        }
      }
    }

    // Bank resolution before any write: a bad account must not half-save.
    let validatedName: string | null = null;
    if (settlementPatch) {
      try {
        const resolved = await validateBankAccount(settlementPatch.bankCode, settlementPatch.accountNumber);
        validatedName = resolved.accountName;
      } catch {
        return badRequest(
          'Could not validate settlement bank account. Please check your bank code and account number.',
        );
      }
    }

    const bvn = body.bvn?.trim() ?? '';
    const hasAccount = Boolean(seller.reservedAccountNumber);

    let reserved: {
      accountNumber: string;
      bankName: string;
      accountName: string;
    } | null = null;
    if (bvn && !hasAccount) {
      // First time a BVN lands on this seller → open the reserved account.
      const displayName =
        (has(body.business_name) ? body.business_name!.trim() : seller.businessName) ||
        (has(body.name) ? body.name!.trim() : seller.name) ||
        seller.name;
      try {
        reserved = await createReservedAccount({
          userId: seller.id,
          name:   displayName,
          email:  seller.email,
          bvn,
        });
      } catch (monnifyErr) {
        logger.error('Monnify reserved account failed (PATCH me)', {
          sellerId: seller.id,
          err: monnifyErr,
          requestId,
        });
        return badRequest(
          "We couldn't open your reserved account with Monnify. " +
          "Please double-check your BVN and try again.",
        );
      }
    }

    const data: Prisma.SellerUpdateInput = {};
    if (has(body.name)) data.name = body.name!.trim();
    if (has(body.phone)) data.phone = body.phone!.trim();
    if (has(body.business_name)) data.businessName = body.business_name!.trim();
    if (has(body.bvn)) data.bvnHash = bvn ? crypto.createHash('sha256').update(bvn).digest('hex') : null;
    if (has(body.settlement)) {
      data.settlementBank   = settlementPatch?.bankCode    ?? null;
      data.settlementNumber = settlementPatch?.accountNumber ?? null;
      data.settlementName   = validatedName;
    }
    if (reserved) {
      data.reservedAccountNumber = reserved.accountNumber;
      data.reservedBankName      = reserved.bankName;
      data.reservedAccountName   = reserved.accountName;
    }

    // Keep the reserved account name in step with the public business name
    // (same regeneration the mock performs — fresh name from business_name,
    // falling back to name).
    if ((has(body.name) || has(body.business_name)) && (reserved || hasAccount)) {
      const displayName =
        (has(body.business_name) ? body.business_name!.trim() : seller.businessName) ||
        (has(body.name) ? body.name!.trim() : seller.name) ||
        'SELLER';
      data.reservedAccountName = `PayProof — ${displayName}`; // matches createReservedAccount's format
    }

    if (Object.keys(data).length === 0) {
      return badRequest('No fields to update.');
    }

    const updated = await db.seller.update({
      where: { id: seller.id },
      data,
    });

    logger.info('Seller profile updated (PATCH me)', {
      sellerId: seller.id,
      fields: Object.keys(data),
      requestId,
    });

    const profile: Record<string, unknown> = {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      business_name: updated.businessName,
      settlement: updated.settlementNumber && updated.settlementBank
        ? { bankCode: updated.settlementBank, accountNumber: updated.settlementNumber }
        : null,
      reserved_account_number: updated.reservedAccountNumber,
      reserved_bank: updated.reservedBankName,
      reserved_account_name: updated.reservedAccountName,
      created_at: updated.createdAt,
    };

    return ok({
      role: 'seller',
      profile,
      reserved_account: {
        account_number: updated.reservedAccountNumber,
        bank_name: updated.reservedBankName,
        account_name: updated.reservedAccountName,
      },
    });
  } catch (err) {
    return handleError(err, 'PATCH /api/v1/auth/me', requestId);
  }
}
