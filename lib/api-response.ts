/**
 * lib/api-response.ts — Consistent response shape.
 *
 * WHY: Your frontend shouldn't need 10 different error-handling patterns.
 * WHY: 200 OK on a failed operation is a lie that breaks clients.
 *
 * Every response from every endpoint has one of two shapes:
 *   Success: { data: T }
 *   Error:   { error: { code: ErrorCode, message: string, details?: {} } }
 *
 * The requestId is always included in error responses so support can
 * trace a specific request across all 50 log lines it produced.
 *
 * Ported and upgraded from PayProof 1.0 lib/apiResponse.js:
 *   + Error shape now matches spec §7.1 exactly
 *   + Added all 2.0 error codes
 *   + AppError instances are automatically serialised
 */

import { logger } from './logger';
import { AppError, type ErrorCode } from './errors';

// ── Spec-exact error shape (§7.1) ─────────────────────────────────────────────

interface ErrorBody {
  error: {
    code:     ErrorCode | 'INTERNAL_ERROR';
    message:  string;
    details?: Record<string, unknown>;
  };
  requestId?: string;
}

// ── Success ───────────────────────────────────────────────────────────────────

export function ok<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

// ── App-level typed errors ────────────────────────────────────────────────────

/**
 * Serialize any AppError subclass into the correct HTTP response.
 * This is the primary handler for domain errors in route handlers.
 */
export function appError(err: AppError, requestId?: string): Response {
  const body: ErrorBody = {
    error: {
      code:    err.code,
      message: err.message,
      ...(err.details && { details: err.details }),
    },
    ...(requestId && { requestId }),
  };
  return Response.json(body, { status: err.httpStatus });
}

// ── Explicit status helpers (for simple cases without a class) ────────────────

export function badRequest(
  message: string,
  code: ErrorCode = 'VALIDATION',
  details?: Record<string, unknown>,
): Response {
  const body: ErrorBody = { error: { code, message, ...(details && { details }) } };
  return Response.json(body, { status: 400 });
}

export function unauthorized(message = 'Authentication required.'): Response {
  return Response.json(
    { error: { code: 'UNAUTHENTICATED' as ErrorCode, message } },
    { status: 401 },
  );
}

export function forbidden(message = 'You do not have permission to do that.'): Response {
  return Response.json(
    { error: { code: 'FORBIDDEN' as ErrorCode, message } },
    { status: 403 },
  );
}

export function notFound(resource: string): Response {
  return Response.json(
    { error: { code: 'NOT_FOUND' as ErrorCode, message: `${resource} not found.` } },
    { status: 404 },
  );
}

export function conflict(message: string, code: ErrorCode = 'DUPLICATE'): Response {
  return Response.json(
    { error: { code, message } },
    { status: 409 },
  );
}

export function tooManyRequestsResponse(retryAfterMs: number): Response {
  return Response.json(
    { error: { code: 'RATE_LIMITED' as ErrorCode, message: 'Too many requests. Please try again later.' } },
    {
      status: 429,
      headers: {
        'Retry-After':      String(Math.ceil(retryAfterMs / 1000)),
        'X-RateLimit-Reset': String(Date.now() + retryAfterMs),
      },
    },
  );
}

export function railError(message: string, requestId?: string): Response {
  const body: ErrorBody = {
    error: { code: 'RAIL_ERROR', message },
    ...(requestId && { requestId }),
  };
  return Response.json(body, { status: 502 });
}

// ── Server error (unhandled) ──────────────────────────────────────────────────

/**
 * For genuinely unexpected errors. Logs full details server-side,
 * returns a safe generic message to the client.
 * NEVER put stack traces or internal error messages in the response body.
 */
export function serverError(err: unknown, context: string, requestId?: string): Response {
  logger.error('Unhandled server error', {
    context,
    requestId,
    err: err instanceof Error ? err : new Error(String(err)),
  });

  return Response.json(
    {
      error:     { code: 'INTERNAL_ERROR' as const, message: 'Something went wrong. Please try again.' },
      ...(requestId && { requestId }),
    },
    { status: 500 },
  );
}

// ── Route-level error dispatcher ──────────────────────────────────────────────

/**
 * Universal catch handler for route try/catch blocks.
 * Checks for AppError first (typed, expected), falls back to serverError.
 */
export function handleError(err: unknown, context: string, requestId?: string): Response {
  if (err instanceof AppError) return appError(err, requestId);
  return serverError(err, context, requestId);
}
