// Auth v2: state passed from /signin or /signup to /otp (sessionStorage so a
// refresh on /otp keeps the context; cleared once the token is issued).
export type PendingAuth = {
  email: string;
  purpose: "login" | "register";
  next?: string;
  dev_code?: string;
};

const KEY = "pp_pending_auth";

export function setPendingAuth(pending: PendingAuth) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(pending));
  } catch {
    /* private mode — /otp falls back to ?email= */
  }
}

export function readPendingAuth(): PendingAuth | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.email !== "string") return null;
    return parsed as PendingAuth;
  } catch {
    return null;
  }
}

export function clearPendingAuth() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function safeNext(next?: string): string {
  return next && next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/dashboard";
}
