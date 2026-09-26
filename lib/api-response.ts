import { logger } from './logger';
import { AppError, type ErrorCode } from './errors';

interface ErrorBody {
  error: {
    code:     ErrorCode | 'INTERNAL_ERROR';
    message:  string;
    details?: Record<string, unknown>;
  };
  requestId?: string;
}

export function ok<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

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

export function handleError(err: unknown, context: string, requestId?: string): Response {
  if (err instanceof AppError) return appError(err, requestId);
  return serverError(err, context, requestId);
}
