/**
 * lib/errors.ts — Typed error hierarchy.
 *
 * WHY: `throw new Error('something broke')` tells you nothing at 2am.
 * Every business-rule violation gets its own class so:
 *   1. Route handlers can catch by type, not by string matching
 *   2. HTTP status codes are co-located with the error definition
 *   3. API error codes are spec-exact (§7.1)
 *
 * Usage in a route:
 *   try { ... }
 *   catch (err) {
 *     if (err instanceof InvalidTransitionError) return appError(err);
 *     return serverError(err, ctx, requestId);
 *   }
 */

export type ErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'OUT_OF_STOCK'
  | 'DUPLICATE'
  | 'PAYOUT_FROZEN'
  | 'BAD_SIGNATURE'
  | 'RATE_LIMITED'
  | 'RAIL_ERROR'
  | 'RAIL_TIMEOUT'
  | 'OTP_EXPIRED'
  | 'OTP_MAX_ATTEMPTS'
  | 'INTERNAL_ERROR';

/** Base class for all PayProof domain errors. */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly httpStatus: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    // Ensure instanceof checks work after transpilation.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ── Auth errors ───────────────────────────────────────────────────────────────

export class UnauthenticatedError extends AppError {
  constructor(message = 'Authentication required.') {
    super('UNAUTHENTICATED', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to do that.') {
    super('FORBIDDEN', message, 403);
  }
}

export class BadSignatureError extends AppError {
  constructor(message = 'Invalid webhook signature.') {
    super('BAD_SIGNATURE', message, 401);
  }
}

// ── Validation / not-found ────────────────────────────────────────────────────

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION', message, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found.`, 404);
  }
}

export class DuplicateError extends AppError {
  constructor(message: string) {
    super('DUPLICATE', message, 409);
  }
}

// ── Order / state machine ─────────────────────────────────────────────────────

export class InvalidTransitionError extends AppError {
  constructor(from: string, to: string) {
    super(
      'INVALID_TRANSITION',
      `Cannot transition order from "${from}" to "${to}".`,
      409,
      { from, to },
    );
  }
}

export class OutOfStockError extends AppError {
  constructor(productId: string) {
    super('OUT_OF_STOCK', `Product ${productId} is out of stock.`, 409, { productId });
  }
}

// ── Payout ────────────────────────────────────────────────────────────────────

export class PayoutFrozenError extends AppError {
  constructor(orderId: string) {
    super(
      'PAYOUT_FROZEN',
      `Payout for order ${orderId} is frozen due to a dispute.`,
      409,
      { orderId },
    );
  }
}

// ── OTP ───────────────────────────────────────────────────────────────────────

export class OtpExpiredError extends AppError {
  constructor() {
    super('OTP_EXPIRED', 'OTP has expired. Request a new one.', 400);
  }
}

export class OtpMaxAttemptsError extends AppError {
  constructor() {
    super('OTP_MAX_ATTEMPTS', 'Too many OTP attempts. Request a new code.', 429);
  }
}

// ── Rail / external ───────────────────────────────────────────────────────────

export class RailError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('RAIL_ERROR', message, 502, details);
  }
}

export class RailTimeoutError extends AppError {
  constructor(message = 'Payment provider did not respond in time.') {
    super('RAIL_TIMEOUT', message, 502);
  }
}
