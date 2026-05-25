import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CreateBatchWithTransactionsDto, UpdateBatchDto } from './dto/batch.dto';
import { find } from 'rxjs';

@Injectable()
export class ProductionBatchService {
    constructor(private prisma: PrismaService) { }

    //Crear un batch con sus transacciones de forma atómica
    async createBatchAndTransactions(companyId: string, itemId: string, dto: CreateBatchWithTransactionsDto) {
        // 1. Validar que el ítem existe
        const findItem = await this.prisma.item.findUnique({
            where: { id: itemId, companyId },
        });
        if (!findItem) throw new NotFoundException('Item not found in this company');

        if (findItem.type === 'SERVICE') throw new BadRequestException('No se pueden crear lotes para servicios.');

        // 2. Extraer IDs únicos de categorías del DTO para validar
        const categoryIds = [...new Set(dto.transactions.map(t => t.categoryId))];

        // 3. FIX: Buscar las categorías en la DB uniendo ID y propiedad de forma segura
        const categories = await this.prisma.category.findMany({
            where: {
                AND: [
                    { id: { in: categoryIds } },
                    {
                        OR: [
                            { companyId: companyId }, // Categoría propia de la empresa
                            { isDefault: true }        // Categoría global del sistema
                        ]
                    }
                ]
            }
        });

        // Variable de control para actualizar stock al final una sola vez
        let necesitaDescontarStock = false;

        // 4. Validar que todas las categorías existan
        for (const categoryId of categoryIds) {
            const category = categories.find(c => c.id === categoryId);

            if (!category) {
                throw new NotFoundException(`Category with ID ${categoryId} not found`);
            }

            // Si detecta una venta (INFLOW) de un PRODUCTO, activa la bandera de inventario
            if (category.flowDirection === 'INFLOW' && findItem.type === 'PRODUCT') {
                necesitaDescontarStock = true;
            }
        }

        // 4.5. FIX: Descontar stock fuera del bucle para evitar el DeprecationWarning de pg
        if (necesitaDescontarStock) {
            if (findItem.stockCurrent < dto.quantity) {
                throw new BadRequestException(`No hay suficiente stock disponible para el producto ${findItem.name}. Disponible: ${findItem.stockCurrent}`);
            }

            await this.prisma.item.update({
                where: { id: itemId },
                data: { stockCurrent: { decrement: dto.quantity } } // Uso seguro de decrement de Prisma
            });
        }

        // 5. Si todo está bien, crear el Batch y las Transactions de forma atómica
        return await this.prisma.productionBatch.create({
            data: {
                companyId: companyId,
                itemId: itemId,
                quantity: dto.quantity,
                status: dto.status,
                batchDate: new Date(dto.batchDate),

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
                        paymentDate: t.paymentDate ? new Date(t.paymentDate) : new Date(),
                    })),
                },
            },
            include: {
                transactions: true,
            },
        });
    }

    //Obtener todos los lotes de la empresa
    async getBatchesByCompany(companyId: string) {
        return this.prisma.productionBatch.findMany({
            where: { companyId, isRemoved: false },
            include: { item: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    //Obtener todos los lotes de un producto específico
    async getBatchByProduct(companyId: string, itemId: string) {
        return this.prisma.productionBatch.findMany({
            where: { companyId, itemId, isRemoved: false },
            include: { item: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    //Obtener un lote específico por su ID
    async getBatchById(batchId: string, companyId: string) {
        const batch = await this.prisma.productionBatch.findFirst({
            where: { id: batchId, companyId, isRemoved: false },
            include: { item: true, transactions: true }
        });
        
        if (!batch) throw new NotFoundException('Batch not found');

        return batch;
    }

    //Actualizar un lote específico
    async updateBatch(batchId: string, companyId: string, updateData: UpdateBatchDto) {
        const findBatch = await this.prisma.productionBatch.findUnique({
            where: { id: batchId, companyId, isRemoved: false },
        });
        if (!findBatch) throw new NotFoundException('Batch not found');

        return this.prisma.productionBatch.update({
            where: { id: batchId, companyId, isRemoved: false },
            data: { ...updateData },
        });
    }

    //Eliminar un lote específico (marcar como eliminado)
    async deleteBatch(batchId: string, companyId: string) {
        const findBatch = await this.prisma.productionBatch.findUnique({
            where: { id: batchId, companyId, isRemoved: false },
        });
        if (!findBatch) throw new NotFoundException('Batch not found');

        return this.prisma.productionBatch.update({
            where: { id: batchId, companyId, isRemoved: false },
            data: { isRemoved: true },
        });
    }
}
