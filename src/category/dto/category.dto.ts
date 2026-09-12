import { CategoryItemScope, CategoryType } from '@prisma/client';
import { FlowDirection } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Validate,
} from 'class-validator';
import { CategoryFlowValidator } from '../validators/category-flow.validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @IsEnum(CategoryType)
  type!: CategoryType;

  @IsEnum(FlowDirection)
  @Validate(CategoryFlowValidator, {
    message:
      'INFLOW categories cannot have isCogs, isVariable, or isDirectCost set to true.',
  })
  flowDirection!: FlowDirection;

  @IsEnum(CategoryItemScope)
  @IsOptional()
  itemType?: CategoryItemScope;

  @IsBoolean()
  isVariable?: boolean;

  @IsBoolean()
  isCogs!: boolean;

  // @IsOptional()
  @IsBoolean()
  isDirectCost?: boolean;
}

export class UpdateCategoryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @IsEnum(CategoryType)
  type?: CategoryType;

  @IsEnum(FlowDirection)
  @Validate(CategoryFlowValidator, {
    message:
      'INFLOW categories cannot have isCogs, isVariable, or isDirectCost set to true.',
  })
  flowDirection?: FlowDirection;

  @IsEnum(CategoryItemScope)
  @IsOptional()
  itemType?: CategoryItemScope;

  @IsOptional()
  @IsBoolean()
  isVariable?: boolean;

  @IsOptional()
  @IsBoolean()
  isCogs?: boolean;

  @IsOptional()
  @IsBoolean()
  isDirectCost?: boolean;
}
