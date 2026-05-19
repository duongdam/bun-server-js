import { randomUUID } from 'crypto';
import type { Context } from 'elysia';
import { logger } from '../infrastructure/logger/pino.logger';

// ─── Domain Error Hierarchy ────────────────────────────────

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super(`${resource} with id '${id}' not found`, 'NOT_FOUND', 404);
  }
}

export class ValidationError extends DomainError {
  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class ConflictError extends DomainError {
  constructor(
    message: string,
    public readonly meta?: Record<string, unknown>,
  ) {
    super(message, 'CONFLICT', 409);
  }
}

export class UnsupportedFileTypeError extends DomainError {
  constructor(extension: string) {
    super(
      `File type '${extension}' is not supported. Supported types: pdf, docx, txt, md, csv, json, html`,
      'UNSUPPORTED_FILE_TYPE',
      400,
    );
  }
}

export class FileTooLargeError extends DomainError {
  constructor(maxBytes: number) {
    super(
      `File exceeds maximum allowed size of ${Math.round(maxBytes / 1024 / 1024)}MB`,
      'FILE_TOO_LARGE',
      413,
    );
  }
}

// ─── Global Error Handler ──────────────────────────────────

interface ErrorResponse {
  error: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export function errorHandler({ code, error, set }: Context & { code: string; error: Error }) {
  const requestId = randomUUID();

  // Domain errors — known, structured
  if (error instanceof DomainError) {
    set.status = error.statusCode as number;
    const response: ErrorResponse = {
      error: error.code,
      message: error.message,
      requestId,
    };
    if (error instanceof ValidationError && error.details) {
      response.details = error.details;
    }
    if (error instanceof ConflictError && error.meta) {
      response.details = error.meta;
    }
    logger.warn({ code: error.code, message: error.message, requestId }, 'Domain error');
    return response;
  }

  // Elysia built-in codes
  if (code === 'VALIDATION') {
    set.status = 422;
    return { error: 'VALIDATION_ERROR', message: 'Request validation failed', requestId };
  }

  if (code === 'NOT_FOUND') {
    set.status = 404;
    return { error: 'NOT_FOUND', message: 'Route not found', requestId };
  }

  if (code === 'PARSE') {
    set.status = 400;
    return { error: 'PARSE_ERROR', message: 'Failed to parse request body', requestId };
  }

  // Unknown errors — log and return generic 500
  logger.error({ error, code, requestId }, 'Unhandled error');
  set.status = 500;
  return {
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    requestId,
  };
}
