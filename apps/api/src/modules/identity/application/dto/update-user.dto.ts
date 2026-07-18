import { IsArray, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { EmploymentStatus, UserRole } from '../../domain/user.entity';

export class UpdateUserDTO {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  firstNameAr?: string | null;

  @IsOptional()
  @IsString()
  lastNameAr?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsOptional()
  @IsArray()
  roles?: UserRole[];

  @IsOptional()
  @IsString()
  jobTitle?: string | null;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsUUID()
  managerId?: string | null;

  @IsOptional()
  @IsString()
  startDate?: string | null;

  @IsOptional()
  @IsIn(['active', 'suspended', 'on_leave', 'archived', 'terminated'])
  employmentStatus?: EmploymentStatus;

  @IsOptional()
  @IsString()
  timezone?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsString()
  avatarUrl?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsString()
  emergencyContactName?: string | null;

  @IsOptional()
  @IsString()
  emergencyContactPhone?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  branchIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  customRoleIds?: string[];

  @IsOptional()
  @IsIn(['single', 'multi', 'global'])
  branchAccessMode?: 'single' | 'multi' | 'global';
}
