import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PLATFORM_REGIONS } from '../../domain/value-objects/platform-region';
import { ENTITLEMENT_PLANS } from '../../domain/value-objects/entitlement-plan';
import { PRIVILEGED_ACCESS_SCOPES, PrivilegedAccessScope } from '../../domain/value-objects/privileged-access-scope';

export class ProvisionPlatformTenantDto {
  @IsString()
  @MinLength(1)
  tenantId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  displayName!: string;

  @IsIn(PLATFORM_REGIONS as readonly string[])
  region!: string;

  @IsIn(ENTITLEMENT_PLANS as readonly string[])
  plan!: string;
}

export class SuspendPlatformTenantDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class ArchivePlatformTenantDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class ChangePlatformTenantPlanDto {
  @IsIn(ENTITLEMENT_PLANS as readonly string[])
  plan!: string;
}

export class RequestPrivilegedAccessDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  adminName!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(PRIVILEGED_ACCESS_SCOPES as readonly string[], { each: true })
  scopes!: PrivilegedAccessScope[];

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  justification!: string;

  @IsISO8601()
  expiresAt!: string;

  @IsOptional()
  @IsBoolean()
  breakGlass?: boolean;
}

export class RejectPrivilegedAccessDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RevokePrivilegedAccessDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
