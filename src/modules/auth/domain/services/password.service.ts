export class PasswordService {
  async hashPassword(plain: string): Promise<string> {
    return Bun.password.hash(plain, {
      algorithm: 'argon2id',
      memoryCost: 19_456,
      timeCost: 2,
    });
  }

  async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return Bun.password.verify(plain, hash);
  }
}
