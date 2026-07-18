/**
 * Permission System Seeds
 *
 * Generates the canonical permission entries for every resource × action × role
 * triple defined in the permission matrix.
 *
 * Usage:
 *   ts-node prisma/seeds/permission-seeds.ts
 *   — or via npx ts-node if installed locally —
 *   npx ts-node prisma/seeds/permission-seeds.ts
 *
 * These seeds are idempotent: duplicate inserts are skipped with upsert logic.
 */
type PermissionAction = 'view' | 'create' | 'update' | 'delete' | 'approve' | 'export' | 'manage';
interface PermissionResource {
    id: string;
    kind: string;
    name: string;
    description?: string;
    permissions: Record<PermissionAction, string[]>;
}
interface PermissionMatrix {
    version: string;
    roles: Array<{
        key: string;
        name: string;
    }>;
    actions: PermissionAction[];
    resources: PermissionResource[];
}
export interface RoleSeed {
    key: string;
    name: string;
    description: string;
}
export interface PermissionSeed {
    id: string;
    resource: string;
    action: PermissionAction;
    resourceKind: string;
    resourceName: string;
}
export interface RolePermissionSeed {
    roleKey: string;
    permissionId: string;
}
export declare function generateRoleSeeds(matrix: PermissionMatrix): RoleSeed[];
export declare function generatePermissionSeeds(matrix: PermissionMatrix): PermissionSeed[];
export declare function generateRolePermissionSeeds(matrix: PermissionMatrix): RolePermissionSeed[];
export declare function generateSQLSeeds(matrix: PermissionMatrix): string;
export declare function buildPrismaUpserts(matrix: PermissionMatrix): {
    roles: RoleSeed[];
    permissions: PermissionSeed[];
    rolePermissions: RolePermissionSeed[];
};
export {};
