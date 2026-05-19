import type { JwtPayload } from './auth.middleware';

export interface AuthDeriveContext {
  request: Request;
  jwt: { verify: (token: string) => Promise<JwtPayload | false> };
  set: { status?: number | string };
}

const DEV_BYPASS_USER: JwtPayload = {
  sub: '00000000-0000-0000-0000-000000000001',
  role: 'admin',
  email: 'dev-bypass@local',
};

function isDevBypassEnabled(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.AUTH_DEV_BYPASS === 'true';
}

/**
 * Elysia `.derive()` handler: resolves JWT user or optional dev bypass user.
 */
export async function deriveAuthenticatedUser({
  request,
  jwt,
  set,
}: AuthDeriveContext): Promise<{ user: JwtPayload }> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    if (isDevBypassEnabled()) {
      return { user: DEV_BYPASS_USER };
    }
    set.status = 401;
    throw new Error('Unauthorized');
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    set.status = 401;
    throw new Error('Unauthorized');
  }

  const payload = await jwt.verify(token);
  if (!payload) {
    set.status = 401;
    throw new Error('Unauthorized');
  }

  return { user: payload };
}
