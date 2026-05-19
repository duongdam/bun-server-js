import { UnauthorizedError } from './error-handler.middleware';

export interface JwtPayload {
  sub: string;
  role: 'admin' | 'user' | 'readonly';
  iat?: number;
  exp?: number;
}

/**
 * Extracts and validates the Bearer token from the Authorization header.
 * Returns the raw token string for further JWT verification by the Elysia JWT plugin.
 */
export function extractBearerToken(authHeader: string | undefined): string {
  if (!authHeader) {
    throw new UnauthorizedError('Authorization header is missing');
  }
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new UnauthorizedError('Invalid Authorization header format. Expected: Bearer <token>');
  }
  return token;
}

/**
 * Elysia-compatible auth middleware factory.
 * Usage: app.use(authMiddleware) — injects { userId, role } into context.
 *
 * NOTE: The actual JWT verification is done by @elysiajs/jwt plugin.
 * This middleware is used as a guard on protected route groups.
 */
export async function requireAuth(
  jwt: { verify: (token: string) => Promise<JwtPayload | false> },
  authHeader: string | undefined,
): Promise<JwtPayload> {
  const token = extractBearerToken(authHeader);
  const payload = await jwt.verify(token);
  if (!payload) {
    throw new UnauthorizedError('Invalid or expired token');
  }
  return payload;
}

/**
 * Role-based access control guard.
 */
export function requireRole(payload: JwtPayload, ...roles: JwtPayload['role'][]): void {
  if (!roles.includes(payload.role)) {
    throw new UnauthorizedError(`Insufficient permissions. Required role: ${roles.join(' or ')}`);
  }
}
