import { Injectable } from '@nestjs/common';
import { rolesCanAccessResource, rolesCanAccessResourceAnyAction } from '../../../common/authorization/permission-matrix.util';

@Injectable()
export class ReportingPolicy {
  canAccessReports(userRoles: string[]): boolean {
    return rolesCanAccessResourceAnyAction(userRoles, 'api.reporting');
  }

  canRequestReport(userRoles: string[]): boolean {
    return (
      rolesCanAccessResource(userRoles, 'api.reporting', 'create') ||
      rolesCanAccessResource(userRoles, 'api.reporting', 'export')
    );
  }
}
