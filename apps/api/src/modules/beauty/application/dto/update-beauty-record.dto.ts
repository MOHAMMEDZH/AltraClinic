import { IsObject } from 'class-validator';

export class UpdateBeautyRecordDto {
  @IsObject()
  bodyMapState!: Record<string, unknown>;
}
