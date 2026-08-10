import { SetMetadata } from '@nestjs/common';

export const PLATFORM_PERMISSION_KEY = 'platform_permission';
export const RequirePlatformPermission = (key: string) => SetMetadata(PLATFORM_PERMISSION_KEY, key);
