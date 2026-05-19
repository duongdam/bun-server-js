import type { UserRole } from '@prisma/client';
import { BaseEntity } from '../../../../shared/domain/base.entity';

export interface UserProps {
  email: string;
  role: UserRole;
  displayName?: string | undefined;
  isActive: boolean;
  lastLoginAt?: Date | undefined;
}

export class User extends BaseEntity {
  public readonly email: string;
  public readonly role: UserRole;
  public readonly displayName?: string | undefined;
  public isActive: boolean;
  public lastLoginAt?: Date | undefined;

  constructor(id: string | undefined, props: UserProps, createdAt?: Date, updatedAt?: Date) {
    super(id, createdAt, updatedAt);
    this.email = props.email;
    this.role = props.role;
    this.displayName = props.displayName;
    this.isActive = props.isActive;
    this.lastLoginAt = props.lastLoginAt;
  }

  static create(props: Omit<UserProps, 'isActive' | 'lastLoginAt'>): User {
    return new User(undefined, {
      ...props,
      isActive: true,
    });
  }

  recordLogin(): void {
    this.lastLoginAt = new Date();
    this.touch();
  }
}
