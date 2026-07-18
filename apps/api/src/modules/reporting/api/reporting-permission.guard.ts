import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { ReportingPolicy } from '../policies/reporting-policy.service';
import { ReportRepository } from '../domain/repositories/report.repository.interface';
import { REPORT_REPOSITORY } from '../../../infrastructure/provider.tokens';

@Injectable()
export class ReportingPermissionGuard implements CanActivate {
  constructor(
    private readonly policy: ReportingPolicy,
    @Inject(REPORT_REPOSITORY) private readonly repository: ReportRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user ?? null;
    if (!user) {
      throw new UnauthorizedException('Authentication required to access reporting endpoints.');
    }

    const tenantId = String(req.headers?.['x-tenant-id'] ?? req.headers?.['tenant-id'] ?? '').trim() || undefined;
    if (!tenantId) {
      throw new ForbiddenException('Tenant header is required to access reporting resources.');
    }

    const roles = Array.isArray(user.roles) ? (user.roles as string[]) : [];
    if (!this.policy.canAccessReports(roles)) {
      throw new ForbiddenException('You do not have permission to access reports.');
    }

    const reportId = String(req.params?.reportId ?? '').trim();
    const method = String(req.method ?? '').toUpperCase();

    if (reportId && method === 'GET') {
      const report = await this.repository.findById(reportId, tenantId);
      if (!report) {
        throw new ForbiddenException('Report not found or access denied.');
      }
    }

    return true;
  }
}
