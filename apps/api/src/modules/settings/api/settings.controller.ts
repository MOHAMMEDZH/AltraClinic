import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { RequireLicensedFeature } from '../../subscription/api/decorators/require-licensed-feature.decorator';
import { CreateBranchDto } from '../application/dto/create-branch.dto';
import { UpdateBillingSequencesDto } from '../application/dto/update-billing-sequences.dto';
import { UpdateBranchDto } from '../application/dto/update-branch.dto';
import { UpdateTenantSettingsDto } from '../application/dto/update-tenant-settings.dto';
import { SettingsService } from '../application/services/settings.service';
import { SettingsWebhookService } from '../application/services/settings-webhook.service';
import { TenantPolicyService } from '../application/services/tenant-policy.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { SkipMaintenance } from '../../../common/decorators/skip-maintenance.decorator';

interface AuthenticatedRequest {
  user?: { id: string; sub?: string; roles: string[] };
}

@Controller('settings')
@UseGuards(TenantScopedAccessGuard)
@RequireLicensedModule('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly tenantContext: TenantContextService,
    private readonly tenantPolicy: TenantPolicyService,
    private readonly webhookService: SettingsWebhookService,
  ) {}

  private actorId(request: AuthenticatedRequest): string {
    return request.user?.sub ?? request.user?.id ?? '';
  }

  @Get('overview')
  @RequirePermission('api.settings', 'view')
  async getOverview() {
    const { tenantId } = await this.tenantContext.resolve();
    return this.settingsService.getOverview(tenantId);
  }

  @Get('tenant')
  @RequirePermission('api.settings', 'view')
  async getTenantSettings() {
    const { tenantId } = await this.tenantContext.resolve();
    return this.settingsService.getTenantSettings(tenantId);
  }

  @Get('status')
  @RequirePermission('api.settings', 'view')
  async getStatus() {
    const { tenantId } = await this.tenantContext.resolve();
    const [maintenance, security] = await Promise.all([
      this.tenantPolicy.getAdvancedPolicy(tenantId),
      this.tenantPolicy.getSecurityPolicy(tenantId),
    ]);
    return {
      maintenanceMode: maintenance.maintenanceMode,
      mfaRequired: security.mfaRequired,
    };
  }

  @Patch('tenant')
  @SkipMaintenance()
  @RequirePermission('api.settings', 'update')
  async updateTenantSettings(@Body() body: UpdateTenantSettingsDto, @Req() request: AuthenticatedRequest) {
    const { tenantId } = await this.tenantContext.resolve();
    return this.settingsService.updateTenantSettings(tenantId, body, this.actorId(request));
  }

  @Get('branches')
  @RequirePermission('api.settings', 'view')
  async listBranches() {
    const { tenantId } = await this.tenantContext.resolve();
    return this.settingsService.listBranches(tenantId);
  }

  @Get('branches/:branchId')
  @RequirePermission('api.settings', 'view')
  async getBranch(@Param('branchId') branchId: string) {
    const { tenantId } = await this.tenantContext.resolve();
    return this.settingsService.getBranch(tenantId, branchId);
  }

  @Post('branches')
  @RequirePermission('api.settings', 'create')
  async createBranch(@Body() body: CreateBranchDto) {
    const { tenantId } = await this.tenantContext.resolve();
    return this.settingsService.createBranch(tenantId, body);
  }

  @Patch('branches/:branchId')
  @RequirePermission('api.settings', 'update')
  async updateBranch(@Param('branchId') branchId: string, @Body() body: UpdateBranchDto) {
    const { tenantId } = await this.tenantContext.resolve();
    return this.settingsService.updateBranch(tenantId, branchId, body);
  }

  @Post('branches/:branchId/archive')
  @RequirePermission('api.settings', 'delete')
  async archiveBranch(@Param('branchId') branchId: string) {
    const { tenantId } = await this.tenantContext.resolve();
    return this.settingsService.archiveBranch(tenantId, branchId);
  }

  @Get('billing/sequences')
  @RequirePermission('api.settings', 'view')
  async getBillingSequences() {
    const { tenantId } = await this.tenantContext.resolve();
    return this.settingsService.getBillingSequences(tenantId);
  }

  @Patch('billing/sequences')
  @RequirePermission('api.settings', 'manage')
  async updateBillingSequences(@Body() body: UpdateBillingSequencesDto) {
    const { tenantId } = await this.tenantContext.resolve();
    return this.settingsService.updateBillingSequences(tenantId, body);
  }

  @Get('developer/api-keys')
  @RequireLicensedFeature('apiAccess')
  @RequirePermission('api.settings', 'manage')
  async listApiKeys() {
    const { tenantId } = await this.tenantContext.resolve();
    return this.settingsService.listApiKeys(tenantId);
  }

  @Post('developer/api-keys')
  @RequireLicensedFeature('apiAccess')
  @RequirePermission('api.settings', 'manage')
  async createApiKey(@Body() body: { name: string }, @Req() request: AuthenticatedRequest) {
    const { tenantId } = await this.tenantContext.resolve();
    return this.settingsService.createApiKey(tenantId, body.name, this.actorId(request));
  }

  @Delete('developer/api-keys/:keyId')
  @RequireLicensedFeature('apiAccess')
  @RequirePermission('api.settings', 'manage')
  async revokeApiKey(@Param('keyId') keyId: string) {
    const { tenantId } = await this.tenantContext.resolve();
    return this.settingsService.revokeApiKey(tenantId, keyId);
  }

  @Post('integrations/webhooks/test')
  @RequireLicensedFeature('integrations')
  @RequirePermission('api.settings', 'manage')
  async testWebhook(@Req() request: AuthenticatedRequest) {
    const { tenantId } = await this.tenantContext.resolve();
    const config = await this.tenantPolicy.getIntegrationWebhook(tenantId);
    if (!config.enabled || !config.url) {
      return { ok: false, statusCode: 0, url: config.url, message: 'Webhooks are not configured.' };
    }
    return this.webhookService.dispatch(config.url, {
      event: 'settings.test',
      tenantId,
      actorId: this.actorId(request),
      at: new Date().toISOString(),
    });
  }
}
