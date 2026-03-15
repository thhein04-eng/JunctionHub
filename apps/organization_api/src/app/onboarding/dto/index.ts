import { IsString, IsNotEmpty } from 'class-validator';

export class StartOnboardingDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  industryTypeSlug: string;
}
