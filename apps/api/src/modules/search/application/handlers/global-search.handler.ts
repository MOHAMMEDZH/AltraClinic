import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { CacheService } from '../../../../infrastructure/redis/services/cache.service';
import { PrismaGlobalSearchRepository } from '../../infrastructure/prisma-global-search.repository';
import { SearchRankerService } from '../services/search-ranker.service';
import { SearchPermissionFilterService } from '../services/search-permission-filter.service';
import {
  ALL_SEARCH_ENTITY_TYPES,
  GlobalSearchResult,
  SearchEntityType,
} from '../../domain/search.types';
import { GlobalSearchResponseDto, SearchResultItemDto } from '../dto/global-search.dto';

export interface GlobalSearchQuery {
  q: string;
  types?: SearchEntityType[];
  limit?: number;
  page?: number;
  branchId?: string | null;
  userRoles: string[];
}

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const CACHE_TTL_SECONDS = 60;

@Injectable()
export class GlobalSearchHandler {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly repository: PrismaGlobalSearchRepository,
    private readonly ranker: SearchRankerService,
    private readonly permissionFilter: SearchPermissionFilterService,
    private readonly cache: CacheService,
  ) {}

  async execute(query: GlobalSearchQuery): Promise<GlobalSearchResponseDto> {
    const q = query.q?.trim() ?? '';
    if (q.length < MIN_QUERY_LENGTH) {
      throw new BadRequestException(`Query must be at least ${MIN_QUERY_LENGTH} characters`);
    }
    if (q.length > MAX_QUERY_LENGTH) {
      throw new BadRequestException(`Query must not exceed ${MAX_QUERY_LENGTH} characters`);
    }

    const tenant = await this.tenantContext.resolve();
    if (!tenant?.tenantId) {
      throw new BadRequestException('Tenant context could not be resolved');
    }

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit ?? DEFAULT_LIMIT));

    const requestedTypes = query.types?.length ? query.types : [...ALL_SEARCH_ENTITY_TYPES];
    const allowedTypes = this.permissionFilter.filterTypes(requestedTypes, query.userRoles);

    if (allowedTypes.length === 0) {
      return {
        query: q,
        page,
        limit,
        total: 0,
        results: [],
        tookMs: 0,
        cached: false,
      };
    }

    const cacheId = this.buildCacheId(q, allowedTypes, page, limit, query.userRoles);
    const cached = await this.cache.get<GlobalSearchResult>(tenant.tenantId, 'search', cacheId);
    if (cached) {
      return this.toDto(cached, true);
    }

    const started = Date.now();
    const hits = await this.repository.search({
      tenantId: tenant.tenantId,
      branchId: query.branchId ?? tenant.branchId ?? null,
      query: q,
      types: allowedTypes,
      limit: limit * 3,
      page,
    });

    const ranked = this.ranker.rank(hits, q);
    const pageResults = this.ranker.paginate(ranked, page, limit);

    const result: GlobalSearchResult = {
      query: q,
      page,
      limit,
      total: ranked.length,
      results: pageResults,
      tookMs: Date.now() - started,
      cached: false,
    };

    await this.cache.set(tenant.tenantId, 'search', cacheId, result, {
      ttl: CACHE_TTL_SECONDS,
    });

    return this.toDto(result, false);
  }

  private buildCacheId(
    q: string,
    types: SearchEntityType[],
    page: number,
    limit: number,
    roles: string[],
  ): string {
    const raw = `${q.toLowerCase()}|${types.sort().join(',')}|${page}|${limit}|${roles.sort().join(',')}`;
    return createHash('sha256').update(raw).digest('hex').slice(0, 20);
  }

  private toDto(result: GlobalSearchResult, cached: boolean): GlobalSearchResponseDto {
    return {
      query: result.query,
      page: result.page,
      limit: result.limit,
      total: result.total,
      tookMs: result.tookMs,
      cached,
      results: result.results.map(
        (r): SearchResultItemDto => ({
          type: r.type,
          id: r.id,
          title: r.title,
          subtitle: r.subtitle,
          url: r.url,
          score: r.score,
          matchKind: r.matchKind,
          matchedField: r.matchedField,
          branchId: r.branchId,
          metadata: r.metadata,
        }),
      ),
    };
  }
}
