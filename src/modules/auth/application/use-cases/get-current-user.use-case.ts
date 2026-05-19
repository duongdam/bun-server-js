import { NotFoundError } from '../../../../shared/middleware/error-handler.middleware';
import type { User } from '../../domain/entities/user.entity';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { PrismaUserRepository } from '../../infrastructure/prisma-user.repository';

export class GetCurrentUserUseCase {
  constructor(private readonly userRepository: IUserRepository = new PrismaUserRepository()) {}

  async execute(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }
    return user;
  }
}
