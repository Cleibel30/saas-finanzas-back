import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CreateBatchWithTransactionsDto } from './dto/batch.dto';

@Injectable()
export class ProductionBatchService {
    constructor(private prisma: PrismaService) { }

    async createBatchAndTransactions(companyId: string, itemId: string, dto: CreateBatchWithTransactionsDto) {
        // 1. Validar que el ítem existe (como ya lo tienes)
        const findItem = await this.prisma.item.findUnique({
            where: { id: itemId, companyId },
        });
        if (!findItem) throw new NotFoundException('Item not found in this company');

        // 2. Extraer IDs únicos de categorías del DTO para validar
        const categoryIds = [...new Set(dto.transactions.map(t => t.categoryId))];

        // 3. Buscar las categorías en la DB
        const categories = await this.prisma.category.findMany({
            where: {
                id: { in: categoryIds },
                OR: [
                    { companyId: companyId }, // Categoría propia de la empresa
                    { isDefault: true }        // Categoría global del sistema
                ]
            }
        });

        // 4. Validar que todas las categorías existan y sean OUTFLOW
        for (const categoryId of categoryIds) {
            const category = categories.find(c => c.id === categoryId);

            if (!category) {
                throw new NotFoundException(`Category with ID ${categoryId} not found`);
            }

            if (category.flowDirection !== 'OUTFLOW') { // <-- AQUÍ LA VALIDACIÓN
                throw new BadRequestException(
                    `Category "${category.name}" is not an OUTFLOW. Production batches only accept expenses.`
                );
            }
        }

        // 5. Si todo está bien, crear el Batch y las Transactions
        return await this.prisma.productionBatch.create({
            data: {
                companyId: companyId,
                itemId: itemId,
                quantity: dto.quantity,
                status: dto.status,

                transactions: {
                    create: dto.transactions.map((t) => ({
                        companyId: companyId,
                        categoryId: t.categoryId,
                        itemId: itemId,
                        amount: t.amount,
                        quantity: t.quantity,
                        status: t.status,
                        dollarRate: t.dollarRate,
                        description: t.description,
                        amountBs: t.amountBs,
                        paymentDate: t.paymentDate || new Date(),
                    })),
                },
            },
            include: {
                transactions: true,
            },
        });
    }
}
