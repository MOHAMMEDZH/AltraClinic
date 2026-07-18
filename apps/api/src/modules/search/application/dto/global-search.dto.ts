import { SearchEntityType } from '../../domain/search.types';

export interface SearchResultItemDto {
  type: SearchEntityType;
  id: string;
  title: string;
  subtitle: string | null;
  url: string;
  score: number;
  matchKind: string;
  matchedField: string;
  branchId: string | null;
  metadata?: Record<string, string>;
}

export interface GlobalSearchResponseDto {
  query: string;
  page: number;
  limit: number;
  total: number;
  tookMs: number;
  cached: boolean;
  results: SearchResultItemDto[];
}

export interface GlobalSearchQueryDto {
  q: string;
  types?: string;
  limit?: string;
  page?: string;
  branchId?: string;
}
