import {
  BatchStatus,
  TransactionStatus,
  PaymentMethod,
  Currency,
} from '@prisma/client';
import { IsDateString, IsOptional } from 'class-validator';

export class CreateBatchWithTransactionsDto {
  quantity!: number;
  status!: BatchStatus;

  @IsDateString()
  batchDate!: Date;

  // Lista de transacciones iniciales
  transactions!: {
    categoryId: string;
    amount: number;
    dollarRate: number;
    quantity: number;
    paymentMethod: PaymentMethod;
    currency: Currency;
    paymentReference?: string;
    description?: string;
    status: TransactionStatus;
    paymentDate?: Date;
  }[];
}

export class UpdateBatchDto {
  @IsOptional()
  quantity?: number;
  status?: BatchStatus;
  @IsDateString()
  batchDate?: Date;
}
