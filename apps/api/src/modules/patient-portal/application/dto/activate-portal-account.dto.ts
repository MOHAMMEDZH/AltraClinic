import { IsNotEmpty, IsString } from 'class-validator';

export class ActivatePortalAccountDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;
}
