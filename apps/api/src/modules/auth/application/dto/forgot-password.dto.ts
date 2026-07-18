import { IsEmail, IsNotEmpty, IsUUID } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsUUID()
  tenantId!: string;
}
