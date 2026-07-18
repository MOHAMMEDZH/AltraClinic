import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { UserRole } from '../../domain/user.entity';

type FieldRule = { field: string; minAction: string; roles?: string[] };

@Injectable()
export class IdentityFieldPolicyService {
  private static rules: FieldRule[] | null = null;

  private loadRules(): FieldRule[] {
    if (IdentityFieldPolicyService.rules) return IdentityFieldPolicyService.rules;
    try {
      const path = join(process.cwd(), 'config', 'identity-field-permissions.json');
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as { fields: FieldRule[] };
      IdentityFieldPolicyService.rules = parsed.fields ?? [];
    } catch {
      IdentityFieldPolicyService.rules = [];
    }
    return IdentityFieldPolicyService.rules;
  }

  /** Returns fields the actor may not update given their roles. */
  filterUpdateInput<T extends Record<string, unknown>>(
    actorRoles: UserRole[],
    input: T,
    canManage: boolean,
  ): T {
    if (canManage || actorRoles.includes('super_admin') || actorRoles.includes('owner')) {
      return input;
    }
    const blocked = new Set(
      this.loadRules()
        .filter((r) => r.roles && !r.roles.some((role) => actorRoles.includes(role as UserRole)))
        .map((r) => r.field),
    );
    if (!blocked.size) return input;
    const filtered = { ...input };
    for (const field of blocked) {
      delete filtered[field];
    }
    return filtered;
  }
}
