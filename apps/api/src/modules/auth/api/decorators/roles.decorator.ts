import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../../identity/domain/user.entity';

export const ROLES_KEY = 'roles';

/**
 * Restrict a route to specific roles.
 * Usage: @Roles('doctor', 'nurse')
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
