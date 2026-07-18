import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';



export class VerifyMfaDto {

  @IsString()

  @IsNotEmpty()

  mfaChallengeToken!: string;



  @IsString()

  @MinLength(6)

  @MaxLength(12)

  code!: string;



  @IsOptional()

  @IsBoolean()

  trustDevice?: boolean;

}



export class ConfirmMfaDto {

  @IsString()

  @MinLength(6)

  @MaxLength(6)

  code!: string;

}



export class DisableMfaDto {

  @IsString()

  @IsNotEmpty()

  @MaxLength(128)

  password!: string;



  @IsString()

  @MinLength(6)

  @MaxLength(12)

  code!: string;

}



export class RegenerateMfaBackupCodesDto {

  @IsString()

  @IsNotEmpty()

  @MaxLength(128)

  password!: string;



  @IsString()

  @MinLength(6)

  @MaxLength(12)

  code!: string;

}



export class RevokeSessionDto {

  @IsString()

  @IsNotEmpty()

  sessionId!: string;

}


