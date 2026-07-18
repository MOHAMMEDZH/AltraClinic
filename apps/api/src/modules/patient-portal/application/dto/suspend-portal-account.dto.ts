import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SuspendPortalAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
