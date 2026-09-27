import { z }  from 'zod';
import { NextRequest } from 'next/server';
import { logger }          from '@/lib/logger';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';
import { getRequestId }    from '@/lib/auth';
import { issueAndSendOtp } from '@/lib/otp';
import { handleError, tooManyRequestsResponse } from '@/lib/api-response';
import { NextResponse }    from 'next/server';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  email: z.string().trim().email('email must be a valid email address'),
});

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const ip        = clientIp(request);

  try {
    const raw    = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION', message: parsed.error.issues[0].message } },
        { status: 400 },
      );
    }

    const { email } = parsed.data;
    const cleanEmail = email.toLowerCase();

    const { allowed, retryAfterMs } = await checkRateLimit(
      `otp:req:${cleanEmail}`,
      5,
      15 * 60_000,
    );
    if (!allowed) {
      logger.warn('OTP request rate limit exceeded', { email: cleanEmail, ip, requestId });
      return tooManyRequestsResponse(retryAfterMs);
    }

    // Auth v2 (A6): just an OTP row keyed by email — role-agnostic resend for
    // both roles. No buyer auto-create here (that died with A3); the verify
    // step resolves whichever account owns the email.
    const { delivery } = await issueAndSendOtp(cleanEmail);

    logger.info('OTP requested', {
      email:    cleanEmail,
      delivery,
      requestId,
    });

    return NextResponse.json(
      {
        sent:     true,
        delivery,
      },
      { status: 202 },
    );
  } catch (err) {
    return handleError(err, 'POST /api/v1/auth/buyer/otp/request', requestId);
  }
}
