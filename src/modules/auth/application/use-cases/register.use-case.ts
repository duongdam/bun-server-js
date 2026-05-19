import { ConflictError } from '../../../../shared/middleware/error-handler.middleware';
import type { User } from '../../domain/entities/user.entity';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { PasswordService } from '../../domain/services/password.service';
import { PrismaUserRepository } from '../../infrastructure/prisma-user.repository';
import type { RegisterDto } from '../dtos/register.dto';

export class RegisterUseCase {
  constructor(
    private readonly userRepository: IUserRepository = new PrismaUserRepository(),
    private readonly passwordService: PasswordService = new PasswordService(),
  ) {}

  async execute(dto: RegisterDto): Promise<User> {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictError('Email already registered', { email: dto.email });
    }

    const passwordHash = await this.passwordService.hashPassword(dto.password);

    return this.userRepository.create({
      email: dto.email,
      passwordHash,
      role: 'USER',
      displayName: dto.displayName,
    });
  }
}
