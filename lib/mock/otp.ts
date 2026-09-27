import { db, generateId } from "./store";
import { isReadOnly } from "./read-only";

// Static code accepted by both OTP verify routes when read-only (Vercel):
// nothing can be stored, so the dev screen shows this fixed code instead.
export const READ_ONLY_OTP_CODE = "123456";

// Shared OTP issuance for the Auth v2 flows (login / register → /otp page).
// Mock delivery: plaintext code returned to the dev screen as `dev_code`.
export function issueOtp(email: string) {
  if (isReadOnly()) return READ_ONLY_OTP_CODE;
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  db.otps.insert({
    id: generateId(),
    email,
    code,
    expires_at: Date.now() + 600000, // 10 mins
    attempts: 0,
    used_at: null,
  });
  return code;
}
