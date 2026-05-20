import { Prisma } from '@prisma/client';
import { prisma } from '../../../shared/infrastructure/prisma/client';
import type {
  ISearchRepository,
  SearchResultItem,
} from '../domain/repositories/search.repository.interface';
import type { SearchFilter } from '../domain/value-objects/search-filter.vo';

interface SemanticSearchRow {
  chunkId: string;
  documentId: string;
  filename: string;
  content: string;
  pageNumber: number | null;
  chunkIndex: number;
  tokenCount: number;
  similarityScore: number | string;
}

interface KeywordSearchRow {
  chunkId: string;
  documentId: string;
  filename: string;
  content: string;
  pageNumber: number | null;
  chunkIndex: number;
  tokenCount: number;
  rankScore: number | string;
}

interface HybridSearchRow extends SemanticSearchRow {
  rankScore: number | string | null;
}

function toSearchResult(
  row: SemanticSearchRow | KeywordSearchRow | HybridSearchRow,
  scores: Pick<SearchResultItem, 'similarityScore' | 'rankScore'>,
): SearchResultItem {
  const item: SearchResultItem = {
    chunkId: row.chunkId,
    documentId: row.documentId,
    filename: row.filename,
    content: row.content,
    chunkIndex: row.chunkIndex,
    tokenCount: row.tokenCount,
    ...scores,
  };

  if (row.pageNumber != null) {
    item.pageNumber = row.pageNumber;
  }

  return item;
}

function documentIdFilter(filter: SearchFilter): Prisma.Sql | null {
  if (filter.operator === 'eq') {
    return Prisma.sql`c."documentId" = ${filter.value}`;
  }
  if (filter.operator === 'in' && Array.isArray(filter.value)) {
    const ids = filter.value as unknown[];
    if (ids.length === 0) {
      return Prisma.sql`FALSE`;
    }
    // Single-element `Prisma.join()` can break placeholder SQL (PG 42601).
    if (ids.length === 1) {
      return Prisma.sql`c."documentId" = ${ids[0]}`;
    }
    return Prisma.sql`c."documentId" IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}`))})`;
  }
  return null;
}

function userIdFilter(filter: SearchFilter): Prisma.Sql | null {
  if (filter.operator === 'eq') {
    return Prisma.sql`d."userId" = ${filter.value}`;
  }
  return null;
}

function filterToCondition(filter: SearchFilter): Prisma.Sql | null {
  switch (filter.field) {
    case 'documentId':
      return documentIdFilter(filter);
    case 'userId':
      return userIdFilter(filter);
    default:
      return null;
  }
}

export class PgVectorSearchRepository implements ISearchRepository {
  private buildFilterClauses(filters?: SearchFilter[]): Prisma.Sql {
    if (!filters?.length) return Prisma.empty;

    const conditions = filters
      .map((filter) => filterToCondition(filter))
      .filter((condition): condition is Prisma.Sql => condition !== null);

    if (conditions.length === 0) return Prisma.empty;
    return Prisma.sql`AND ${Prisma.join(conditions, ' AND ')}`;
  }

  async semanticSearch(
    queryVector: number[],
    topK: number,
    threshold: number,
    filters?: SearchFilter[],
  ): Promise<SearchResultItem[]> {
    const vectorString = `[${queryVector.join(',')}]`;
    const filterSql = this.buildFilterClauses(filters);

    // One `::vector` cast (single placeholder). Repeating `${vectorString}::vector` can confuse Prisma/PG (42601).
    const result = await prisma.$queryRaw<SemanticSearchRow[]>`
      WITH q AS (SELECT ${vectorString}::vector AS v)
      SELECT 
        c.id as "chunkId",
        c."documentId"::text,
        d.filename,
        c.content,
        c."pageNumber",
        c."chunkIndex",
        c."tokenCount",
        1 - (e.vector <=> q.v) as "similarityScore"
      FROM document_chunks c
      JOIN embeddings e ON e."chunkId" = c.id
      JOIN documents d ON d.id = c."documentId"
      CROSS JOIN q
      WHERE 1 - (e.vector <=> q.v) >= ${threshold}
        ${filterSql}
      ORDER BY e.vector <=> q.v ASC
      LIMIT ${topK}
    `;

    return result.map((r) => toSearchResult(r, { similarityScore: Number(r.similarityScore) }));
  }

  async keywordSearch(
    queryText: string,
    topK: number,
    filters?: SearchFilter[],
  ): Promise<SearchResultItem[]> {
    const filterSql = this.buildFilterClauses(filters);

    const result = await prisma.$queryRaw<KeywordSearchRow[]>`
      SELECT 
        c.id as "chunkId",
        c."documentId"::text,
        d.filename,
        c.content,
        c."pageNumber",
        c."chunkIndex",
        c."tokenCount",
        ts_rank(c."contentTsv", plainto_tsquery('english', ${queryText})) as "rankScore"
      FROM document_chunks c
      JOIN documents d ON d.id = c."documentId"
      WHERE c."contentTsv" @@ plainto_tsquery('english', ${queryText})
        ${filterSql}
      ORDER BY "rankScore" DESC
      LIMIT ${topK}
    `;

    return result.map((r) => toSearchResult(r, { rankScore: Number(r.rankScore) }));
  }

  async hybridSearch(
    queryText: string,
    queryVector: number[],
    topK: number,
    threshold: number,
    filters?: SearchFilter[],
  ): Promise<SearchResultItem[]> {
    // Basic implementation of Reciprocal Rank Fusion (RRF)
    const vectorString = `[${queryVector.join(',')}]`;
    const filterSql = this.buildFilterClauses(filters);

    const result = await prisma.$queryRaw<HybridSearchRow[]>`
      WITH q AS (SELECT ${vectorString}::vector AS v),
      eligible AS (
        SELECT c.id AS chunk_id
        FROM document_chunks c
        JOIN documents d ON d.id = c."documentId"
        WHERE 1 = 1
        ${filterSql}
      ),
      semantic_results AS (
        SELECT 
          c.id as chunk_id,
          ROW_NUMBER() OVER (ORDER BY e.vector <=> q.v ASC) as rank,
          1 - (e.vector <=> q.v) as similarity_score
        FROM document_chunks c
        JOIN embeddings e ON e."chunkId" = c.id
        JOIN documents d ON d.id = c."documentId"
        INNER JOIN eligible el ON el.chunk_id = c.id
        CROSS JOIN q
        WHERE 1 - (e.vector <=> q.v) >= ${threshold}
        LIMIT ${topK * 2}
      ),
      keyword_results AS (
        SELECT 
          c.id as chunk_id,
          ROW_NUMBER() OVER (ORDER BY ts_rank(c."contentTsv", plainto_tsquery('english', ${queryText})) DESC) as rank,
          ts_rank(c."contentTsv", plainto_tsquery('english', ${queryText})) as keyword_score
        FROM document_chunks c
        JOIN documents d ON d.id = c."documentId"
        INNER JOIN eligible el ON el.chunk_id = c.id
        WHERE c."contentTsv" @@ plainto_tsquery('english', ${queryText})
        LIMIT ${topK * 2}
      ),
      combined AS (
        SELECT 
          COALESCE(s.chunk_id, k.chunk_id) as chunk_id,
          s.similarity_score,
          k.keyword_score,
          COALESCE(1.0 / (60 + COALESCE(s.rank, 1000)), 0) + 
          COALESCE(1.0 / (60 + COALESCE(k.rank, 1000)), 0) as rrf_score
        FROM semantic_results s
        FULL OUTER JOIN keyword_results k ON s.chunk_id = k.chunk_id
      )
      SELECT 
        c.id as "chunkId",
        c."documentId"::text,
        d.filename,
        c.content,
        c."pageNumber",
        c."chunkIndex",
        c."tokenCount",
        com.similarity_score as "similarityScore",
        com.rrf_score as "rankScore"
      FROM combined com
      JOIN document_chunks c ON c.id = com.chunk_id
      JOIN documents d ON d.id = c."documentId"
      ORDER BY com.rrf_score DESC
      LIMIT ${topK}
    `;

    return result.map((r) => {
      const scores: Pick<SearchResultItem, 'similarityScore' | 'rankScore'> = {};
      if (r.similarityScore) scores.similarityScore = Number(r.similarityScore);
      if (r.rankScore) scores.rankScore = Number(r.rankScore);
      return toSearchResult(r, scores);
    });
  }
}
