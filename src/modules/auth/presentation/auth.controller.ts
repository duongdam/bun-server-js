import { toAuthUserDto } from '../application/dtos/auth-response.dto';
import { LoginSchema } from '../application/dtos/login.dto';
import { RegisterSchema } from '../application/dtos/register.dto';
import { GetCurrentUserUseCase } from '../application/use-cases/get-current-user.use-case';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { RegisterUseCase } from '../application/use-cases/register.use-case';

export class AuthController {
  private registerUseCase = new RegisterUseCase();
  private loginUseCase = new LoginUseCase();
  private getCurrentUserUseCase = new GetCurrentUserUseCase();

  async register(body: unknown) {
    const dto = RegisterSchema.parse(body);
    const user = await this.registerUseCase.execute(dto);
    return user;
  }

  async login(body: unknown) {
    const dto = LoginSchema.parse(body);
    const user = await this.loginUseCase.execute(dto);
    return user;
  }

  async me(userId: string) {
    const user = await this.getCurrentUserUseCase.execute(userId);
    return toAuthUserDto(user);
  }
}
