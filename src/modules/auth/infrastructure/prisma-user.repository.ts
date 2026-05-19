import type { User as PrismaUser, UserRole } from '@prisma/client';
import { prisma } from '../../../shared/infrastructure/prisma/client';
import { User, type UserProps } from '../domain/entities/user.entity';
import type {
  CreateUserInput,
  IUserRepository,
} from '../domain/repositories/user.repository.interface';

export class PrismaUserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    const data = await prisma.user.findUnique({ where: { id } });
    if (!data) return null;
    return this.mapToDomain(data);
  }

  async findByEmail(email: string): Promise<User | null> {
    const data = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!data) return null;
    return this.mapToDomain(data);
  }

  async findWithPasswordByEmail(
    email: string,
  ): Promise<{ user: User; passwordHash: string } | null> {
    const data = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!data) return null;
    return { user: this.mapToDomain(data), passwordHash: data.passwordHash };
  }

  async create(input: CreateUserInput): Promise<User> {
    const saved = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        role: input.role,
        displayName: input.displayName ?? null,
      },
    });
    return this.mapToDomain(saved);
  }

  async updateLastLogin(id: string): Promise<User> {
    const saved = await prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
    return this.mapToDomain(saved);
  }

  private mapToDomain(data: PrismaUser): User {
    const props: UserProps = {
      email: data.email,
      role: data.role,
      isActive: data.isActive,
    };
    if (data.displayName != null) props.displayName = data.displayName;
    if (data.lastLoginAt != null) props.lastLoginAt = data.lastLoginAt;

    return new User(data.id, props, data.createdAt, data.updatedAt);
  }
}

export function toJwtRole(role: UserRole): 'admin' | 'user' | 'readonly' {
  switch (role) {
    case 'ADMIN':
      return 'admin';
    case 'READONLY':
      return 'readonly';
    default:
      return 'user';
  }
}

export function fromJwtRole(role: string): UserRole {
  switch (role) {
    case 'admin':
      return 'ADMIN';
    case 'readonly':
      return 'READONLY';
    default:
      return 'USER';
  }
}
