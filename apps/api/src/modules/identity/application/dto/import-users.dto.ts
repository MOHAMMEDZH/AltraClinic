import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ImportUserRowDTO {
  email!: string;
  firstName!: string;
  lastName!: string;
  roles?: string[];
  password?: string;
}

export class ImportUsersDTO {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportUserRowDTO)
  rows!: ImportUserRowDTO[];
}
