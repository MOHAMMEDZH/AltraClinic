import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LicensedFeatureId, LicensedModuleId } from '../../domain/config/licensing.config';
import { SubscriptionEnforcementService } from '../../application/services/subscription-enforcement.service';
import { LicensingAuditService } from '../../application/services/licensing-audit.service';
import { LICENSED_MODULE_KEY } from '../decorators/require-licensed-module.decorator';
import { LICENSED_FEATURE_KEY } from '../decorators/require-licensed-feature.decorator';
import { requireTenantScope } from '../../../../common/tenant-scope.util';
import { PlanLimitExceededException } from '../../domain/exceptions/plan-limit-exceeded.exception';

@Injectable()
export class LicensedModuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly enforcement: SubscriptionEnforcementService,
    private readonly audit: LicensingAuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduleId = this.reflector.getAllAndOverride<LicensedModuleId | undefined>(
      LICENSED_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );
    const featureId = this.reflector.getAllAndOverride<LicensedFeatureId | undefined>(
      LICENSED_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!moduleId && !featureId) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { tenantId } = requireTenantScope(request);
    const actorId = request.user?.sub ?? request.user?.id;

    try {
      if (moduleId) {
        await this.enforcement.enforceModuleAccess(tenantId, moduleId);
      }
      if (featureId) {
        await this.enforcement.enforceLicensedFeature(tenantId, featureId);
      }
      return true;
    } catch (err) {
      if (err instanceof ForbiddenException || err instanceof PlanLimitExceededException) {
        await this.audit.recordLicenseEvent({
          tenantId,
          actorId,
          eventType: moduleId ? 'module.denied' : 'feature.denied',
          moduleId,
          featureId,
          decision: 'denied',
          reason: err.message,
          source: 'http.guard',
          metadata: { moduleId, featureId },
        });
      }
      throw err;
    }
  }
}
