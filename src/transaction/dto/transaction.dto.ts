import {
  IsUUID,
  IsNumber,
  IsEnum,
  IsOptional,
  IsDateString,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionStatus, PaymentMethod, Currency } from '@prisma/client';

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
  @Type(() => Number)
  quantity?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  unitPrice?: number;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  amount!: number;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  dollarRate!: number;

  @IsEnum(TransactionStatus)
  status!: TransactionStatus;

  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  paymentMethod!: PaymentMethod;

  @IsEnum(Currency)
  @IsNotEmpty()
  currency!: Currency;

  @IsString()
  @IsOptional()
  @MinLength(4)
  @Matches(/^\d+$/, { message: 'paymentReference debe contener solo dígitos' })
  paymentReference?: string;

  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(100)
  description?: string;

  @IsDateString()
  @IsOptional()
  paymentDate?: string;
}

export class UpdateTransactionDto {
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsUUID()
  @IsOptional()
  itemId?: string;

  @IsUUID()
  @IsOptional()
  batchId?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  quantity?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  unitPrice?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  amount?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  dollarRate?: number;

  @IsEnum(TransactionStatus)
  @IsOptional()
  status?: TransactionStatus;

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;

  @IsString()
  @IsOptional()
  @MinLength(4)
  @Matches(/^\d+$/, { message: 'paymentReference debe contener solo dígitos' })
  paymentReference?: string;

  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(100)
  description?: string;

  @IsDateString()
  @IsOptional()
  paymentDate?: string;
}

export class GetCashFlowDto {
  @IsDateString()
  @IsNotEmpty()
  startDate!: Date;

  @IsDateString()
  @IsNotEmpty()
  endDate!: Date;
}

export class GetTransactionsByDateRangeDto {
  @IsUUID()
  @IsNotEmpty()
  companyId!: string;

  @IsDateString()
  @IsNotEmpty()
  startDate!: Date;

  @IsDateString()
  @IsNotEmpty()
  endDate!: Date;
}
