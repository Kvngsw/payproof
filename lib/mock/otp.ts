import { db, generateId } from "./store";

// Shared OTP issuance for the Auth v2 flows (login / register → /otp page).
// Mock delivery: plaintext code returned to the dev screen as `dev_code`.
export function issueOtp(email: string) {
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
