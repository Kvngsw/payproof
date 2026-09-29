import crypto from 'crypto';
import bcrypt from 'bcrypt';
import db from '@/lib/db';
import { sendOtp, type OtpDeliveryResult } from '@/lib/email';

const OTP_EXPIRY_MINUTES = 10;
const OTP_BCRYPT_ROUNDS = 10; // lower cost: codes die in 10min, UX beats theoretical strength

// Auth v2 (A1/A3/A4/A6): create an OTP row for the email and send the code.
// Callers own rate limiting; a thrown error (e.g. SMTP unconfigured) must be
// handled by the route — A3/A4 roll back the just-created account first so the
// user can retry once email delivery works.
export async function issueAndSendOtp(
  email: string,
): Promise<OtpDeliveryResult> {
  const code = String(crypto.randomInt(100_000, 999_999)); // crypto-secure: Math.random is predictable
  const codeHash = await bcrypt.hash(code, OTP_BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000);

  await db.otpCode.create({
    data: { email, codeHash, expiresAt },
  });

  return sendOtp(email, code);
}
