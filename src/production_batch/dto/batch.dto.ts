import { BatchStatus, TransactionStatus } from "@prisma/client";
import { IsDateString, isNotEmpty, IsOptional } from "class-validator";

export class CreateBatchWithTransactionsDto {
    quantity!: number;
    status!: BatchStatus;

    @IsDateString()
    batchDate!: Date;

    // Lista de transacciones iniciales
    transactions!: {
        categoryId: string;
        dollarRate: number;
        amount: number;
        amountBs: number;
        quantity: number;
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