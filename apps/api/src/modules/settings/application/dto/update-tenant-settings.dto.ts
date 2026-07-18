import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateTenantSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(3650)
  dataRetentionDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  customDomain?: string;

  @IsOptional()
  @IsObject()
  features?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  clinicProfile?: {
    legalName?: string;
    registrationNumber?: string;
    country?: string;
    city?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    workingDays?: string[];
    workingHours?: string;
    defaultCurrency?: string;
    defaultBranchId?: string;
    clinicType?: 'medical' | 'dental' | 'beauty' | 'multi';
    description?: string;
    specialties?: string[];
    publicProfileEnabled?: boolean;
    logoStorageKey?: string;
    socialLinks?: Record<string, string>;
    mapLocation?: { label?: string; latitude?: string; longitude?: string };
  };

  @IsOptional()
  @IsObject()
  branding?: {
    logoStorageKey?: string;
    faviconStorageKey?: string;
    primaryColor?: string;
    accentColor?: string;
    themePreference?: 'light' | 'dark' | 'system';
  };

  @IsOptional()
  @IsObject()
  moduleFlags?: Record<string, boolean>;

  @IsOptional()
  @IsObject()
  billingSettings?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  inventorySettings?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  securityPolicy?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  auditSettings?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  reportSettings?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  notificationSettings?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  integrationSettings?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  developerSettings?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  advancedSettings?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  localizationSettings?: Record<string, unknown>;
}
