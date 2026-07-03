import { CategoryType } from '@prisma/client';
import { FlowDirection } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @IsEnum(CategoryType)
  type!: CategoryType;

  @IsEnum(FlowDirection)
  flowDirection!: FlowDirection;

  @IsBoolean()
  isVariable?: boolean;

  @IsBoolean()
  isCogs!: boolean;
}

export class UpdateCategoryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @IsEnum(CategoryType)
  type?: CategoryType;

  @IsEnum(FlowDirection)
  flowDirection?: FlowDirection;

  @IsBoolean()
  isVariable?: boolean;

  @IsBoolean()
  isCogs?: boolean;
}
