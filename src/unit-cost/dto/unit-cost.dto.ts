import { IsNotEmpty, IsString, IsUUID, IsDateString } from 'class-validator';
import { DateRange } from '@/transaction/validators/date-range.validator';

export class UnitCostBatchDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  batchId!: string;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  companyId!: string;
}

export class UnitCostProductDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  itemId!: string;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  companyId!: string;
}

@DateRange()
export class UnitCostDateRangeDto {
  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @IsDateString()
  @IsNotEmpty()
  endDate!: string;
}

@DateRange()
export class UnitCostBatchDateRangeDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  batchId!: string;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  companyId!: string;
}

@DateRange()
export class UnitCostItemDateRangeDto extends UnitCostDateRangeDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  itemId!: string;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  companyId!: string;
}
