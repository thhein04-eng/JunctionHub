import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateResourceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  resourceTypeSlug: string;
}

export class RenameResourceDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class CreateRelationshipDto {
  @IsUUID()
  @IsNotEmpty()
  targetResourceId: string;

  @IsString()
  @IsNotEmpty()
  relationLabel: string;
}

export class ListResourcesDto {
  @IsString()
  @IsOptional()
  typeSlug?: string;
}
