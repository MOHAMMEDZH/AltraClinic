import { Injectable } from '@nestjs/common';
import { rolesCanAccessResourceAnyAction } from '../../../common/authorization/permission-matrix.util';

@Injectable()
export class AiAccessPolicy {
  canAccess(roles: string[]): boolean {
    return rolesCanAccessResourceAnyAction(roles, 'api.ai');
  }
}
