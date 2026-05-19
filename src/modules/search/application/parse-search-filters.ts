import { SearchFilter } from '../domain/value-objects/search-filter.vo';

/** Build filters including mandatory user scoping. */
export function parseSearchFilters(
  userId: string,
  filters?: Record<string, unknown>,
): SearchFilter[] {
  const result: SearchFilter[] = [
    SearchFilter.create({ field: 'userId', operator: 'eq', value: userId }),
  ];

  if (!filters) return result;

  for (const [field, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;

    if (field === 'documentIds' && Array.isArray(value)) {
      result.push(SearchFilter.create({ field: 'documentId', operator: 'in', value }));
      continue;
    }

    if (Array.isArray(value)) {
      result.push(SearchFilter.create({ field, operator: 'in', value }));
      continue;
    }

    result.push(SearchFilter.create({ field, operator: 'eq', value }));
  }

  return result;
}
