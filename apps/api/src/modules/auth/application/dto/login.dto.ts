import { IsEmail, IsNotEmpty, IsString, IsUUID, MaxLength, MinLength, IsOptional } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(128)
  password!: string;

  @IsUUID()
  tenantId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceTrustToken?: string;
}

export class LoginResponseDto {
  accessToken?: string;
  refreshToken?: string;
  accessExpiresIn?: number;
  sessionId?: string;
  tokenType = 'Bearer';
  mfaRequired?: boolean;
  mfaChallengeToken?: string;
  mfaExpiresIn?: number;
  deviceTrustToken?: string;
  deviceTrustExpiresIn?: number;
}
