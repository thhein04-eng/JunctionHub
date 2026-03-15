import {
  IsString,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateResourceTypeDto {
  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsBoolean()
  isEssential: boolean;
}

export class CreateResourceTypeRelationshipDto {
  @IsString()
  @IsNotEmpty()
  sourceSlug: string;

  @IsString()
  @IsNotEmpty()
  targetSlug: string;

  @IsString()
  @IsNotEmpty()
  relationLabel: string;
}

export class CreateIndustryTypeDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  slug: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateResourceTypeDto)
  resourceTypes: CreateResourceTypeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateResourceTypeRelationshipDto)
  relationships: CreateResourceTypeRelationshipDto[];
}
