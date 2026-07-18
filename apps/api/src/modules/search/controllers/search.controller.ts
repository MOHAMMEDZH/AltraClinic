import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { GlobalSearchHandler } from '../application/handlers/global-search.handler';
import { GlobalSearchQueryDto, GlobalSearchResponseDto } from '../application/dto/global-search.dto';
import {
  ALL_SEARCH_ENTITY_TYPES,
  SearchEntityType,
} from '../domain/search.types';

interface AuthenticatedRequest {
  user?: JwtClaimsVO;
}

function parseTypes(raw?: string): SearchEntityType[] | undefined {
  if (!raw?.trim()) return undefined;
  const parts = raw.split(',').map((s) => s.trim().toLowerCase());
  const valid = parts.filter((p): p is SearchEntityType =>
    (ALL_SEARCH_ENTITY_TYPES as string[]).includes(p),
  );
  return valid.length > 0 ? valid : undefined;
}

@Controller('search')
@UseGuards(TenantScopedAccessGuard)
@RequireLicensedModule('search')
export class SearchController {
  constructor(private readonly globalSearchHandler: GlobalSearchHandler) {}

  /**
   * Global tenant-scoped search across permitted entity types.
   * GET /search?q=ahmed&types=patient,appointment&limit=20&page=1
   */
  @Get()
  @RequirePermission('api.search', 'view')
  async search(
    @Query() query: GlobalSearchQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<GlobalSearchResponseDto> {
    return this.globalSearchHandler.execute({
      q: query.q ?? '',
      types: parseTypes(query.types),
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      page: query.page ? parseInt(query.page, 10) : undefined,
      branchId: query.branchId ?? null,
      userRoles: request.user?.roles ?? [],
    });
  }
}
