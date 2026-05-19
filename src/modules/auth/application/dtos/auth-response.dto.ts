import type { User } from '../../domain/entities/user.entity';
import { toJwtRole } from '../../infrastructure/prisma-user.repository';

export interface AuthUserDto {
  id: string;
  email: string;
  role: 'admin' | 'user' | 'readonly';
  displayName?: string | undefined;
}

export interface AuthResponseDto {
  accessToken: string;
  expiresIn: string;
  user: AuthUserDto;
}

export function toAuthUserDto(user: User): AuthUserDto {
  const dto: AuthUserDto = {
    id: user.id,
    email: user.email,
    role: toJwtRole(user.role),
  };
  if (user.displayName != null) {
    dto.displayName = user.displayName;
  }
  return dto;
}
