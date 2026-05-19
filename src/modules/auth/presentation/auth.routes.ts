import { jwt } from '@elysiajs/jwt';
import { Elysia, t } from 'elysia';
import { parseServerEnv } from '../../../shared/config/env';
import {
  type AuthDeriveContext,
  deriveAuthenticatedUser,
} from '../../../shared/middleware/derive-auth-user';
import { type AuthResponseDto, toAuthUserDto } from '../application/dtos/auth-response.dto';
import type { User } from '../domain/entities/user.entity';
import { toJwtRole } from '../infrastructure/prisma-user.repository';
import { AuthController } from './auth.controller';

const controller = new AuthController();

const envResult = parseServerEnv();
if (!envResult.success) {
  throw new Error('Invalid environment configuration for auth routes');
}
const authEnv = envResult.data;

type JwtSigner = {
  sign: (payload: Record<string, string>) => Promise<string>;
};

async function buildAuthResponse(
  user: User,
  jwt: JwtSigner,
  expiresIn: string,
): Promise<AuthResponseDto> {
  const accessToken = await jwt.sign({
    sub: user.id,
    role: toJwtRole(user.role),
    email: user.email,
  });

  return {
    accessToken,
    expiresIn,
    user: toAuthUserDto(user),
  };
}

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(
    jwt({
      name: 'jwt',
      secret: authEnv.JWT_SECRET,
      exp: authEnv.JWT_EXPIRES_IN,
    }),
  )
  .post(
    '/register',
    async ({ body, jwt, set }) => {
      const user = await controller.register(body);
      set.status = 201;
      return buildAuthResponse(user, jwt, authEnv.JWT_EXPIRES_IN);
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 8 }),
        displayName: t.Optional(t.String()),
      }),
      detail: {
        tags: ['auth'],
        summary: 'Register a new user account',
      },
    },
  )
  .post(
    '/login',
    async ({ body, jwt }) => {
      const user = await controller.login(body);
      return buildAuthResponse(user, jwt, authEnv.JWT_EXPIRES_IN);
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 8 }),
      }),
      detail: {
        tags: ['auth'],
        summary: 'Sign in with email and password',
      },
    },
  )
  .derive((context) => deriveAuthenticatedUser(context as unknown as AuthDeriveContext))
  .get('/me', async ({ user }) => controller.me(user.sub), {
    detail: {
      tags: ['auth'],
      summary: 'Get current authenticated user profile',
    },
  });
