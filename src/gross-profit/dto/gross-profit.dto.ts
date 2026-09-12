import { IsDateString, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class GrossProfitGeneralDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  companyId!: string;

  @IsDateString()
  @IsNotEmpty()
  startDate!: Date;

  @IsDateString()
  @IsNotEmpty()
  endDate!: Date;
}

export class GrossProfitItemDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  itemId!: string;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  companyId!: string;

  @IsDateString()
  @IsNotEmpty()
  startDate!: Date;

  @IsDateString()
  @IsNotEmpty()
  endDate!: Date;
}

export class GrossProfitBatchDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  batchId!: string;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  companyId!: string;
}
