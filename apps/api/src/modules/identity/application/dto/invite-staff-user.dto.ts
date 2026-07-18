import { IsArray, IsEmail, IsOptional, IsString, IsUUID, IsIn, IsObject } from 'class-validator';
import { UserRole } from '../../domain/user.entity';
export class InviteStaffUserDTO {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsArray()
  roles?: UserRole[];

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  firstNameAr?: string;

  @IsOptional()
  @IsString()
  lastNameAr?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class BulkUserActionDTO {
  @IsArray()
  @IsUUID('4', { each: true })
  userIds!: string[];

  @IsIn([
    'deactivate',
    'reactivate',
    'suspend',
    'archive',
    'restore',
    'assign_roles',
    'assign_branches',
    'assign_departments',
  ])
  action!:
    | 'deactivate'
    | 'reactivate'
    | 'suspend'
    | 'archive'
    | 'restore'
    | 'assign_roles'
    | 'assign_branches'
    | 'assign_departments';

  @IsOptional()
  @IsArray()
  roles?: UserRole[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  branchIds?: string[];

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class CreateDepartmentDTO {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class CreateCustomRoleDTO {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsObject()
  permissions!: Record<string, string[]>;
}
