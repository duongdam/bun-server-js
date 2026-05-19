import {
  ForbiddenError,
  UnauthorizedError,
} from '../../../../shared/middleware/error-handler.middleware';
import type { User } from '../../domain/entities/user.entity';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { PasswordService } from '../../domain/services/password.service';
import { PrismaUserRepository } from '../../infrastructure/prisma-user.repository';
import type { LoginDto } from '../dtos/login.dto';

export class LoginUseCase {
  constructor(
    private readonly userRepository: IUserRepository = new PrismaUserRepository(),
    private readonly passwordService: PasswordService = new PasswordService(),
  ) {}

  async execute(dto: LoginDto): Promise<User> {
    const record = await this.userRepository.findWithPasswordByEmail(dto.email);
    if (!record) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const valid = await this.passwordService.verifyPassword(dto.password, record.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!record.user.isActive) {
      throw new ForbiddenError('Account is deactivated');
    }

    return this.userRepository.updateLastLogin(record.user.id);
  }
}
