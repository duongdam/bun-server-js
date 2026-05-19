import { ReindexDocumentUseCase } from '../src/modules/document/application/use-cases/reindex-document.use-case';
import { PrismaDocumentRepository } from '../src/modules/document/infrastructure/prisma-document.repository';
import { connectDatabase, disconnectDatabase } from '../src/shared/infrastructure/prisma/client';

const documentId = process.argv[2] ?? '8b3376a9-f83a-45e0-a483-495756fe49a3';
const userId = process.argv[3] ?? '00000000-0000-0000-0000-000000000001';

await connectDatabase();

const useCase = new ReindexDocumentUseCase(new PrismaDocumentRepository());
const result = await useCase.execute(userId, documentId, {});

console.log(JSON.stringify({ documentId, ...result }, null, 2));

await disconnectDatabase();
