import { Controller, Get, UseGuards } from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { EffectiveImportExportViewService } from '../application/effective-import-export-view.service';
import { IMPORT_EXPORT_PERMISSION_RESOURCE } from '../import-export.constants';

/**
 * Phase 42f — thin catalog read for Operations UI.
 * Exposes EffectiveImportExportView only (no business logic).
 */
@Controller('import-export')
@UseGuards(TenantScopedAccessGuard)
export class ImportExportCatalogController {
  constructor(private readonly effectiveView: EffectiveImportExportViewService) {}

  @Get('catalog')
  @RequirePermission(IMPORT_EXPORT_PERMISSION_RESOURCE, 'view')
  async catalog(@CurrentUser() user: JwtClaimsVO) {
    const view = await this.effectiveView.resolve({
      tenantId: user.tenantId,
      branchId: user.branchId,
      roles: user.roles.map(String),
      hasReadPermission: true,
    });
    return { catalog: view };
  }
}
