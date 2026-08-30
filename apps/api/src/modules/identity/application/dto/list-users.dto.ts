import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { EmploymentStatus, UserRole } from '../../domain/user.entity';
import type { UserDirectoryStatus } from '../../domain/user.repository.interface';

export class ListUsersQueryDTO {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  role?: UserRole;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  regionId?: string;

  @IsOptional()
  @IsIn(['active', 'suspended', 'on_leave', 'archived', 'terminated'])
  employmentStatus?: EmploymentStatus;

  @IsOptional()
  @IsIn(['active', 'inactive', 'locked', 'all'])
  status?: UserDirectoryStatus;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}