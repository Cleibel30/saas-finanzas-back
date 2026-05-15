import { BatchStatus, TransactionStatus } from "@prisma/client";

export class CreateBatchWithTransactionsDto {
    quantity!: number;
    status!: BatchStatus;

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