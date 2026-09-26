/**
 * lib/auth.ts — JWT authentication with access + refresh token split.
 *
 * WHY (httpOnly cookie): JavaScript running in the browser shouldn't be
 * able to steal your session. The refresh token lives in an httpOnly
 * cookie — XSS cannot read it. The short-lived access token lives in
 * memory on the client.
 *
 * WHY (token split):
 *   - Access token: 15 minutes. Short-lived. Stateless. Used on every
 *     protected request. If stolen, expires fast.
 *   - Refresh token: 7 days. httpOnly cookie. Only used on /api/v1/auth/refresh.
 *     Rotated on every use — old token is invalidated.
 *
 * WHY (dummy hash on login miss): Response time tells attackers which emails
 * exist in your system. We run bcrypt.compare even when no user is found,
 * against a pre-computed dummy hash, so the timing is identical.
 *
 * Ported and upgraded from PayProof 1.0 lib/authHelpers.js:
 *   + Split single 7d token → access (15m) + refresh (7d, httpOnly cookie)
 *   + Request ID extracted from header or generated as UUID
 *   + JWT payload typed
 */

import crypto   from 'crypto';
import jwt      from 'jsonwebtoken';
import { logger } from './logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub:  string | number;   // user id
  role: 'seller' | 'buyer';
  name?: string;
}

// ── Token generation ──────────────────────────────────────────────────────────

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      '[PayProof] JWT_SECRET is not set or is too short (min 32 chars).',
    );
  }
  return secret;
}

/** Short-lived access token — lives in JS memory on the client. */
export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(
    { sub: payload.sub, role: payload.role, ...(payload.name && { name: payload.name }) },
    getSecret(),
    { expiresIn: '15m' },
  );
}

/** Long-lived refresh token — sent as httpOnly cookie only. */
export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(
    { sub: payload.sub, role: payload.role },
    getSecret(),
    { expiresIn: '7d' },
  );
}

// ── Token verification ────────────────────────────────────────────────────────

export function verifyToken(token: string | null | undefined): JwtPayload | null {
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, getSecret());
    // Ensure we have the minimum fields we expect.
    if (
      typeof decoded === 'object' &&
      decoded !== null &&
      'sub'  in decoded &&
      'role' in decoded
    ) {
      return decoded as JwtPayload;
    }
    return null;
  } catch (err) {
    logger.debug('JWT verification failed', {
      reason: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ── Request helpers ───────────────────────────────────────────────────────────

/** Extract Bearer token from Authorization header. */
export function extractToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

/** Authenticate request from Bearer token. Returns null if missing/invalid. */
export function authenticate(request: Request): JwtPayload | null {
  return verifyToken(extractToken(request));
}

/**
 * Returns the request ID from the X-Request-ID header if present,
 * or generates a new UUID. Always propagate this through all log calls.
 */
export function getRequestId(request: Request): string {
  return request.headers.get('x-request-id') ?? crypto.randomUUID();
}

// ── httpOnly cookie helpers ───────────────────────────────────────────────────

const COOKIE_NAME = 'pp_refresh';

/** Build a Set-Cookie header value for the refresh token. */
export function refreshCookieHeader(token: string): string {
  const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
  const isProduction = process.env.NODE_ENV === 'production';
  return [
    `${COOKIE_NAME}=${token}`,
    `Max-Age=${maxAge}`,
    'Path=/api/v1/auth/refresh',
    'HttpOnly',
    'SameSite=Strict',
    ...(isProduction ? ['Secure'] : []),
  ].join('; ');
}

/** Build a Set-Cookie header that immediately expires the refresh cookie. */
export function clearRefreshCookieHeader(): string {
  return `${COOKIE_NAME}=; Max-Age=0; Path=/api/v1/auth/refresh; HttpOnly; SameSite=Strict`;
}

/** Extract and verify the refresh token from the request's cookie. */
export function extractRefreshToken(request: Request): JwtPayload | null {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const token = match.slice(COOKIE_NAME.length + 1);
  return verifyToken(token);
}

// ── Timing-safe dummy hash ────────────────────────────────────────────────────

/**
 * Pre-computed bcrypt hash (rounds=12) of a throwaway string.
 *
 * WHY (timing-safe comparison): Attackers measure your response time to
 * reverse-engineer secrets. On a login miss, we still call bcrypt.compare
 * against this dummy hash at the same cost as a real hash. The wall-clock
 * time is identical whether the email exists or not — timing oracle prevented.
 *
 * This exact hash never changes — it's not a secret, just a constant.
 * Rotate it if you ever change BCRYPT_ROUNDS.
 */
export const DUMMY_HASH =
  '$2b$12$VaDaUcesH2bp5a5McTmhKOMpxMwQbIzZePWv04NWcktbu3nLLzCNq';
