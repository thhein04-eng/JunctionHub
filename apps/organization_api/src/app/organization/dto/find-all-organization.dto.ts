import { Type } from 'class-transformer';

export class FindAllOrganizationDto {
  @Type(() => Number)
  skip?: number;

  @Type(() => Number)
  take?: number;
}
