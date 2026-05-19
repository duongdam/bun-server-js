import type { UserRole } from '@prisma/client';
import type { User } from '../entities/user.entity';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  role: UserRole;
  displayName?: string | undefined;
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findWithPasswordByEmail(email: string): Promise<{ user: User; passwordHash: string } | null>;
  create(input: CreateUserInput): Promise<User>;
  updateLastLogin(id: string): Promise<User>;
}
