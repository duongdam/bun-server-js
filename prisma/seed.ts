import { PrismaClient, DocumentStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create test user (for local development only)
  const testUserId = '00000000-0000-0000-0000-000000000001';

  // Create a sample document record
  const doc = await prisma.document.upsert({
    where: {
      userId_contentHash: {
        userId: testUserId,
        contentHash: 'seed-hash-abc123',
      },
    },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      userId: testUserId,
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

  console.log(`✅ Created document: ${doc.id} (${doc.filename})`);
  console.log('✅ Seed complete');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
