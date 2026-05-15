// create-transaction.dto.ts
import { IsUUID, IsNumber, IsEnum, IsOptional, IsDateString, IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';
import { TransactionStatus } from '@prisma/client';

export class CreateTransactionDto {

  @IsUUID()
  @IsNotEmpty()
  categoryId!: string;

  @IsUUID()
  @IsOptional()
  itemId?: string;

  @IsUUID()
  @IsOptional()
  batchId?: string;

  @IsNumber()
  @IsOptional()
  quantity?: number;

  @IsNumber()
  @IsOptional()
  unitPrice?: number;

  @IsNumber()
  @IsNotEmpty()
  amount!: number;

  @IsNumber()
  @IsNotEmpty()
  amountBs!: number;

  @IsEnum(TransactionStatus)
  status!: TransactionStatus;

  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(100)
  description?: string;

  @IsDateString()
  @IsOptional()
  paymentDate?: string;
}

export class getCashFlowDto {
  @IsDateString()
  @IsNotEmpty()
  startDate!: Date;

  @IsDateString()
  @IsNotEmpty()
  endDate!: Date;
}