import crypto   from 'crypto';
import jwt      from 'jsonwebtoken';
import { logger } from './logger';

export interface JwtPayload {
  sub:  string | number;
  role: 'seller' | 'buyer';
  name?: string;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      '[PayProof] JWT_SECRET is not set or is too short (min 32 chars).',
    );
  }
  return secret;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(
    { sub: payload.sub, role: payload.role, ...(payload.name && { name: payload.name }) },
    getSecret(),
    { expiresIn: '15m' }, // short-lived: a stolen token dies fast
  );
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(
    { sub: payload.sub, role: payload.role },
    getSecret(),
    { expiresIn: '7d' }, // lives in httpOnly cookie only; XSS cannot touch it
  );
}

export function verifyToken(token: string | null | undefined): JwtPayload | null {
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, getSecret());

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

export function extractToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

export function authenticate(request: Request): JwtPayload | null {
  return verifyToken(extractToken(request));
}

export function getRequestId(request: Request): string {
  return request.headers.get('x-request-id') ?? crypto.randomUUID();
}

const COOKIE_NAME = 'pp_refresh';

export function refreshCookieHeader(token: string): string {
  const maxAge = 7 * 24 * 60 * 60;
  const isProduction = process.env.NODE_ENV === 'production';
  return [
    `${COOKIE_NAME}=${token}`,
    `Max-Age=${maxAge}`,
    'Path=/api/v1/auth/refresh',
    'HttpOnly', // JavaScript in the browser cannot read the session
    'SameSite=Strict',
    ...(isProduction ? ['Secure'] : []),
  ].join('; ');
}

export function clearRefreshCookieHeader(): string {
  return `${COOKIE_NAME}=; Max-Age=0; Path=/api/v1/auth/refresh; HttpOnly; SameSite=Strict`;
}

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

export const DUMMY_HASH =
  '$2b$12$VaDaUcesH2bp5a5McTmhKOMpxMwQbIzZePWv04NWcktbu3nLLzCNq'; // constant, not secret; identical timing kills the email oracle
