import { ItemType } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateItemDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @IsEnum(ItemType)
  type!: ItemType;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  basePrice!: number;

  @IsNumber()
  @Min(0)
  stockCurrent?: number;
}

export class UpdateItemDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @IsOptional()
  @IsEnum(ItemType)
  type?: ItemType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stockCurrent?: number;
}

export class SearchDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsUUID()
  @IsNotEmpty()
  companyId!: string;
}
