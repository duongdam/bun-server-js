import { Prisma } from '@prisma/client';
import { prisma } from '../../../shared/infrastructure/prisma/client';
import { ISearchRepository, SearchResultItem } from '../domain/repositories/search.repository.interface';
import { SearchFilter } from '../domain/value-objects/search-filter.vo';

export class PgVectorSearchRepository implements ISearchRepository {
  private buildFilterClauses(filters?: SearchFilter[]): Prisma.Sql {
    if (!filters || filters.length === 0) return Prisma.empty;

    const conditions: Prisma.Sql[] = [];
    for (const filter of filters) {
      if (filter.field === 'documentId') {
        if (filter.operator === 'eq') {
          conditions.push(Prisma.sql`c."documentId"::text = ${filter.value}`);
        } else if (filter.operator === 'in' && Array.isArray(filter.value)) {
          // Prisma.join is useful here, but for simplicity we can construct an IN clause
          // Assuming simple UUID strings
          conditions.push(Prisma.sql`c."documentId"::text = ANY(ARRAY[${Prisma.join(filter.value)}]::text[])`);
        }
      } else if (filter.field === 'userId') {
        if (filter.operator === 'eq') {
          conditions.push(Prisma.sql`d."userId" = ${filter.value}`);
        }
      }
      // Add more filter handlers (tags, metadata) as needed
    }

    if (conditions.length === 0) return Prisma.empty;
    return Prisma.sql`AND ${Prisma.join(conditions, ' AND ')}`;
  }

  async semanticSearch(
    queryVector: number[],
    topK: number,
    threshold: number,
    filters?: SearchFilter[]
  ): Promise<SearchResultItem[]> {
    const vectorString = `[${queryVector.join(',')}]`;
    const filterSql = this.buildFilterClauses(filters);

    const result = await prisma.$queryRaw<any[]>`
      SELECT 
        c.id as "chunkId",
        c."documentId"::text,
        d.filename,
        c.content,
        c."pageNumber",
        c."chunkIndex",
        c."tokenCount",
        1 - (e.vector <=> ${vectorString}::vector) as "similarityScore"
      FROM document_chunks c
      JOIN embeddings e ON e."chunkId" = c.id
      JOIN documents d ON d.id = c."documentId"
      WHERE 1 - (e.vector <=> ${vectorString}::vector) >= ${threshold}
        ${filterSql}
      ORDER BY e.vector <=> ${vectorString}::vector ASC
      LIMIT ${topK}
    `;

    return result.map(r => ({
      ...r,
      similarityScore: Number(r.similarityScore)
    }));
  }

  async keywordSearch(
    queryText: string,
    topK: number,
    filters?: SearchFilter[]
  ): Promise<SearchResultItem[]> {
    const filterSql = this.buildFilterClauses(filters);

    const result = await prisma.$queryRaw<any[]>`
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

    return result.map(r => ({
      ...r,
      rankScore: Number(r.rankScore)
    }));
  }

  async hybridSearch(
    queryText: string,
    queryVector: number[],
    topK: number,
    threshold: number,
    filters?: SearchFilter[]
  ): Promise<SearchResultItem[]> {
    // Basic implementation of Reciprocal Rank Fusion (RRF)
    const vectorString = `[${queryVector.join(',')}]`;
    const filterSql = this.buildFilterClauses(filters);

    const result = await prisma.$queryRaw<any[]>`
      WITH semantic_results AS (
        SELECT 
          c.id as chunk_id,
          ROW_NUMBER() OVER (ORDER BY e.vector <=> ${vectorString}::vector ASC) as rank,
          1 - (e.vector <=> ${vectorString}::vector) as similarity_score
        FROM document_chunks c
        JOIN embeddings e ON e."chunkId" = c.id
        WHERE 1 - (e.vector <=> ${vectorString}::vector) >= ${threshold}
          ${filterSql}
        LIMIT ${topK * 2}
      ),
      keyword_results AS (
        SELECT 
          c.id as chunk_id,
          ROW_NUMBER() OVER (ORDER BY ts_rank(c."contentTsv", plainto_tsquery('english', ${queryText})) DESC) as rank,
          ts_rank(c."contentTsv", plainto_tsquery('english', ${queryText})) as keyword_score
        FROM document_chunks c
        WHERE c."contentTsv" @@ plainto_tsquery('english', ${queryText})
          ${filterSql}
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

    return result.map(r => ({
      ...r,
      similarityScore: r.similarityScore ? Number(r.similarityScore) : undefined,
      rankScore: r.rankScore ? Number(r.rankScore) : undefined
    }));
  }
}
