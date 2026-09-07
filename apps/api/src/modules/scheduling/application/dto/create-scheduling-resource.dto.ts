import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateSchedulingResourceDTO {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsIn(['ROOM', 'EQUIPMENT', 'OPERATORY'])
  resourceType!: 'ROOM' | 'EQUIPMENT' | 'OPERATORY';

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  displaySubtype?: string;
}
