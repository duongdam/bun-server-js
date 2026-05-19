/*
  Warnings:

  - The primary key for the `ai_processing_jobs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `document_chunks` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `contentTsv` on the `document_chunks` table. All the data in the column will be lost.
  - The primary key for the `documents` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `search_history` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the `embeddings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ai_processing_jobs" DROP CONSTRAINT "ai_processing_jobs_documentId_fkey";

-- DropForeignKey
ALTER TABLE "document_chunks" DROP CONSTRAINT "document_chunks_documentId_fkey";

-- DropForeignKey
ALTER TABLE "embeddings" DROP CONSTRAINT "embeddings_chunkId_fkey";

-- DropForeignKey
ALTER TABLE "embeddings" DROP CONSTRAINT "embeddings_documentId_fkey";

-- DropIndex
DROP INDEX "document_chunks_contentTsv_idx";

-- DropIndex
DROP INDEX "document_chunks_content_trgm_idx";

-- AlterTable
ALTER TABLE "ai_processing_jobs" DROP CONSTRAINT "ai_processing_jobs_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "documentId" SET DATA TYPE TEXT,
ALTER COLUMN "startedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "completedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "ai_processing_jobs_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "document_chunks" DROP CONSTRAINT "document_chunks_pkey",
DROP COLUMN "contentTsv",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "documentId" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "documents" DROP CONSTRAINT "documents_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "indexedAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "search_history" DROP CONSTRAINT "search_history_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "search_history_pkey" PRIMARY KEY ("id");

-- DropTable
DROP TABLE "embeddings";

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_processing_jobs" ADD CONSTRAINT "ai_processing_jobs_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
