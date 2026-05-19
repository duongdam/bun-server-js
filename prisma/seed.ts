import { DocumentStatus, UserRole } from '@prisma/client';
import { prisma } from '../src/shared/infrastructure/prisma/client';
import { logger } from '../src/shared/infrastructure/logger/pino.logger';

async function hashPassword(plain: string): Promise<string> {
  return Bun.password.hash(plain, {
    algorithm: 'argon2id',
    memoryCost: 19_456,
    timeCost: 2,
  });
}

async function main() {
  logger.info('🌱 Seeding database...');

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@gmail.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ryan@123';
  const passwordHash = await hashPassword(adminPassword);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: { passwordHash },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      email: adminEmail.toLowerCase(),
      passwordHash,
      role: UserRole.ADMIN,
      displayName: 'Seed Admin',
      isActive: true,
    },
  });

  logger.info({ admin }, '✅ Admin user');

  const doc = await prisma.document.upsert({
    where: {
      userId_contentHash: {
        userId: admin.id,
        contentHash: 'seed-hash-abc123',
      },
    },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      userId: admin.id,
      filename: 'sample-guide.txt',
      mimeType: 'text/plain',
      fileSize: BigInt(1024),
      status: DocumentStatus.INDEXED,
      wordCount: 150,
      language: 'en',
      tags: ['sample', 'seed'],
      metadata: { source: 'seed' },
      contentHash: 'seed-hash-abc123',
      chunkingStrategy: 'recursive',
      chunkSize: 512,
      chunkOverlap: 50,
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: 1536,
      embeddingProvider: 'openai',
      indexedAt: new Date(),
    },
  });

  logger.info({ doc }, '✅ Sample document');
  logger.info('✅ Seed complete');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
