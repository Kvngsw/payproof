/**
 * app/api/v1/auth/me/route.ts — Current session profile (E05).
 *
 * GET with `Authorization: Bearer <access>`.
 * Response: `{ role, profile }` — role-scoped, never leaks secrets:
 *   - seller: id, name, businessName, email, phone, reserved_account (no
 *     passwordHash, no bvnHash, no settlement details)
 *   - buyer: id, email
 */

import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { logger } from '@/lib/logger';
import { authenticate, getRequestId } from '@/lib/auth';
import { ok, unauthorized, handleError } from '@/lib/api-response';

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
          reservedAccountNumber: true,
          reservedBankName: true,
          reservedAccountName: true,
        },
      });

      if (!seller) {
        // Token valid but seller deleted — force re-login.
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
