import { IsArray, IsNotEmpty, IsOptional, IsObject, IsString } from 'class-validator';

export class CreateAuditEntryDTO {
  @IsString()
  @IsNotEmpty()
  action!: string;

  @IsString()
  @IsNotEmpty()
  resourceType!: string;

  @IsString()
  @IsNotEmpty()
  resourceId!: string;

  @IsString()
  @IsNotEmpty()
  actorId!: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  actorRoles!: string[];

  @IsOptional()
  @IsObject()
  details?: Record<string, string>;

  @IsOptional()
  @IsObject()
  changes?: Record<string, { before?: string | null; after?: string | null }>;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  correlationId?: string;
}
