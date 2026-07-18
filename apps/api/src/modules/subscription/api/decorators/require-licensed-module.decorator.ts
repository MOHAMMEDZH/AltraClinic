import { SetMetadata } from '@nestjs/common';
import { LicensedModuleId } from '../../domain/config/licensing.config';

export const LICENSED_MODULE_KEY = 'licensed_module';

/** Require tenant license module access before handler execution. */
export const RequireLicensedModule = (moduleId: LicensedModuleId) =>
  SetMetadata(LICENSED_MODULE_KEY, moduleId);
