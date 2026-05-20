import { BatchStatus, TransactionStatus } from "@prisma/client";
import { IsDateString, isNotEmpty } from "class-validator";

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