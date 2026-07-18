import { IsEmail, IsString, MinLength, IsOptional, IsArray, IsUUID } from 'class-validator';
import { UserRole } from '../../domain/user.entity';

export class RegisterUserDTO {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

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
