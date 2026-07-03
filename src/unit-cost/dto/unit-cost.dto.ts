import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

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
