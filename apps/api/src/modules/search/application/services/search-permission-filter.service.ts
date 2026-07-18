import { Injectable } from '@nestjs/common';
import {
  ALL_SEARCH_ENTITY_TYPES,
  SEARCH_ENTITY_PERMISSION_RESOURCES,
  SearchEntityType,
} from '../../domain/search.types';

interface PermissionMatrixResource {
  id: string;
  permissions: Record<string, string[]>;
}

interface PermissionMatrix {
  resources: PermissionMatrixResource[];
}

/**
 * Filters searchable entity types based on the caller's roles and the permission matrix.
 * Even with api.search view, users only see entity types they can view individually.
 */
@Injectable()
export class SearchPermissionFilterService {
  private static cachedMatrix: PermissionMatrix | null = null;

  resolveAllowedTypes(userRoles: string[]): SearchEntityType[] {
    if (userRoles.includes('super_admin')) {
      return [...ALL_SEARCH_ENTITY_TYPES];
    }

    return ALL_SEARCH_ENTITY_TYPES.filter((type) =>
      this.canViewEntityType(type, userRoles),
    );
  }

  filterTypes(requested: SearchEntityType[], userRoles: string[]): SearchEntityType[] {
    const allowed = new Set(this.resolveAllowedTypes(userRoles));
    return requested.filter((t) => allowed.has(t));
  }

  canViewEntityType(type: SearchEntityType, userRoles: string[]): boolean {
    if (userRoles.includes('super_admin')) return true;

    const resources = SEARCH_ENTITY_PERMISSION_RESOURCES[type];
    const resourceIds = Array.isArray(resources) ? resources : [resources];

    return resourceIds.some((resourceId) => this.hasViewPermission(resourceId, userRoles));
  }

  private hasViewPermission(resourceId: string, userRoles: string[]): boolean {
    const matrix = SearchPermissionFilterService.loadMatrix();
    if (!matrix) return false;

    const resource = matrix.resources.find((r) => r.id === resourceId);
    if (!resource) return false;

    const allowedRoles = resource.permissions.view ?? [];
    return userRoles.some((role) => allowedRoles.includes(role));
  }

  private static loadMatrix(): PermissionMatrix | null {
    if (SearchPermissionFilterService.cachedMatrix) {
      return SearchPermissionFilterService.cachedMatrix;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const matrix = require('../../../../../config/permission-matrix.json') as PermissionMatrix;
      SearchPermissionFilterService.cachedMatrix = matrix;
      return matrix;
    } catch {
      return null;
    }
  }
}
