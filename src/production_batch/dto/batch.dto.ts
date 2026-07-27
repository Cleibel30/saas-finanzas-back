import { BatchStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBatchDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  quantity?: number;

  @IsOptional()
  @IsEnum(BatchStatus)
  status?: BatchStatus;

  @IsOptional()
  @IsDateString()
  batchDate?: Date;
}

export class UpdateBatchDto {
  @IsOptional()
  quantity?: number;
  status?: BatchStatus;
  @IsDateString()
  batchDate?: Date;
}
