import { IsUUID } from 'class-validator';

export class CreateBeautyRecordDto {
  @IsUUID()
  patientId!: string;
}
