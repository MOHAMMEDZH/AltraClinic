import { IsOptional, IsString } from 'class-validator';

export class PlatformLoginDto {
  @IsString()
  email!: string;

  @IsString()
  password!: string;
}

export class PlatformRefreshBodyDto {
  /** Optional body fallback for non-browser clients; browsers use HttpOnly cookie. */
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class PlatformMfaEnrollmentBeginDto {
  /** Required unless the caller is already authenticated (re-enroll / replace uses step-up flow instead). */
  @IsOptional()
  @IsString()
  preauthToken?: string;
}

export class PlatformMfaEnrollmentConfirmDto {
  @IsString()
  preauthToken!: string;

  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  deviceLabel?: string;
}

export class PlatformMfaChallengeDto {
  @IsString()
  preauthToken!: string;

  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  deviceLabel?: string;
}

export class PlatformMfaReplaceConfirmDto {
  @IsString()
  code!: string;
}

export class PlatformStepUpVerifyDto {
  @IsString()
  code!: string;
}
