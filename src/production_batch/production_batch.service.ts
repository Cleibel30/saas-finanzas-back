import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CreateBatchWithTransactionsDto } from './dto/batch.dto';
import { find } from 'rxjs';

@Injectable()
export class ProductionBatchService {
    constructor(private prisma: PrismaService) { }

    async createBatchAndTransactions(companyId: string, itemId: string, dto: CreateBatchWithTransactionsDto) {
        // 1. Validar que el ítem existe
        const findItem = await this.prisma.item.findUnique({
            where: { id: itemId, companyId },
        });
        if (!findItem) throw new NotFoundException('Item not found in this company');

        if(findItem.type === 'SERVICE') throw new BadRequestException('No se pueden crear lotes para servicios.'); 

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

    // async createBatchAndTransactions(companyId: string, itemId: string, dto: CreateBatchWithTransactionsDto) {
    //     // 1. Validar que el ítem existe (como ya lo tienes)
    //     const findItem = await this.prisma.item.findUnique({
    //         where: { id: itemId, companyId },
    //     });
    //     if (!findItem) throw new NotFoundException('Item not found in this company');

    //     // 2. Extraer IDs únicos de categorías del DTO para validar
    //     const categoryIds = [...new Set(dto.transactions.map(t => t.categoryId))];

    //     // 3. Buscar las categorías en la DB
    //     const categories = await this.prisma.category.findMany({
    //         where: {
    //             id: { in: categoryIds },
    //             OR: [
    //                 { companyId: companyId }, // Categoría propia de la empresa
    //                 { isDefault: true }        // Categoría global del sistema
    //             ]
    //         }
    //     });

    //     // 4. Validar que todas las categorías existan
    //     for (const categoryId of categoryIds) {
    //         const category = categories.find(c => c.id === categoryId);

    //         if (!category) {
    //             throw new NotFoundException(`Category with ID ${categoryId} not found`);
    //         }

    //         //Quitar stock en una venta
    //         if (category.flowDirection === 'INFLOW' && findItem.type === 'PRODUCT') { 
    //             if(findItem.stockCurrent === 0) throw new BadRequestException(`No hay stock disponible para el producto ${findItem.name}.`);

    //             await this.prisma.item.update({
    //                 where: { id: itemId },
    //                 data: { stockCurrent: findItem.stockCurrent - dto.quantity }
    //             });
    //         }

    //     }

    //     // 5. Si todo está bien, crear el Batch y las Transactions
    //     return await this.prisma.productionBatch.create({
    //         data: {
    //             companyId: companyId,
    //             itemId: itemId,
    //             quantity: dto.quantity,
    //             status: dto.status,

    //             transactions: {
    //                 create: dto.transactions.map((t) => ({
    //                     companyId: companyId,
    //                     categoryId: t.categoryId,
    //                     itemId: itemId,
    //                     amount: t.amount,
    //                     quantity: t.quantity,
    //                     status: t.status,
    //                     dollarRate: t.dollarRate,
    //                     description: t.description,
    //                     amountBs: t.amountBs,
    //                     paymentDate: t.paymentDate || new Date(),
    //                 })),
    //             },
    //         },
    //         include: {
    //             transactions: true,
    //         },
    //     });
    // }
}
