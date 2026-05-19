import { z } from 'zod';

export const SearchFilterSchema = z.object({
  field: z.string(),
  operator: z.enum(['eq', 'in', 'gte', 'lte', 'contains']),
  value: z.any(),
});

export type SearchFilterProps = z.infer<typeof SearchFilterSchema>;

export class SearchFilter {
  public readonly field: string;
  public readonly operator: SearchFilterProps['operator'];
  public readonly value: any;

  private constructor(props: SearchFilterProps) {
    this.field = props.field;
    this.operator = props.operator;
    this.value = props.value;
  }

  public static create(props: SearchFilterProps): SearchFilter {
    const validated = SearchFilterSchema.parse(props);
    return new SearchFilter(validated);
  }
}
