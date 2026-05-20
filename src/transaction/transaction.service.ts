import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CreateTransactionDto } from './dto/transaction.dto';


@Injectable()
export class TransactionService {
    constructor(private prisma: PrismaService) { }

    async createTransactions(
        data: CreateTransactionDto[],
        companyId: string,
        dollarRate: number,
    ) {
        return await this.prisma.$transaction(async (tx) => {
            const results = [];

            // 1. Mapa para acumular los descuentos de stock por producto
            // Estructura: { [itemId]: cantidad_total_a_restar }
            const stockToDecrement: Record<string, number> = {};

            // 2. Mapa para almacenar en caché los datos de los ítems ya validados
            // Estructura: { [itemId]: Objeto_Item_De_La_DB }
            const itemCache: Record<string, any> = {};

            for (const t of data) {
                if (t.itemId) {
                    // Si el ítem no está en caché, lo buscamos en la DB una sola vez
                    if (!itemCache[t.itemId]) {
                        const item = await tx.item.findUnique({
                            where: { id: t.itemId, companyId, isRemoved: false }
                        });

                        if (!item) {
                            throw new BadRequestException(`El ítem con ID ${t.itemId} no existe.`);
                        }
                        itemCache[t.itemId] = item;
                    }

                    const item = itemCache[t.itemId];

                    const category = await tx.category.findUnique({
                        where: { id: t.categoryId, isRemoved: false }
                    });

                    if (!category) throw new NotFoundException(`La categoría con ID ${t.categoryId} no existe.`);

                    if (category.companyId !== companyId && category.isDefault === false) {
                        throw new UnauthorizedException(`La categoría no pertenece a la empresa.`);
                    }

                    if (category.flowDirection !== 'INFLOW' && item.type === 'PRODUCT') {
                        throw new BadRequestException(
                            `Las transacciones con ítems deben pertenecer a una categoría de entrada (INFLOW).`,
                        );
                    }

                    if (t.batchId) {
                        const batch = await tx.productionBatch.findUnique({
                            where: { id: t.batchId, companyId, isRemoved: false }
                        });

                        if (!batch) {
                            throw new BadRequestException(`El lote con ID ${t.batchId} no existe.`);
                        }
                    }

                    // Validación de stock dinámica por producto específico
                    if (item.type === 'PRODUCT') {
                        if (!t.quantity || t.quantity <= 0) {
                            throw new BadRequestException(
                                `La cantidad es obligatoria para el producto: ${item.name}`,
                            );
                        }

                        // Inicializamos o acumulamos el conteo para este producto específico
                        if (!stockToDecrement[t.itemId]) {
                            stockToDecrement[t.itemId] = 0;
                        }
                        stockToDecrement[t.itemId] += t.quantity;

                        // Comparamos el acumulado contra el stock real de ESTE producto guardado en caché
                        if (item.stockCurrent < stockToDecrement[t.itemId]) {
                            throw new BadRequestException(
                                `Stock insuficiente para ${item.name}. Disponible: ${item.stockCurrent}, Requerido en la petición: ${stockToDecrement[t.itemId]}`,
                            );
                        }
                    }
                }
            }

            // 3. Aplicamos un único .update() por cada producto diferente que vino en el arreglo
            for (const [itemId, totalDecrement] of Object.entries(stockToDecrement)) {
                await tx.item.update({
                    where: { id: itemId },
                    data: {
                        stockCurrent: { decrement: totalDecrement },
                    },
                });
            }

            // 4. Crear las transacciones financieras correspondientes
            for (const t of data) {
                const transaction = await tx.transaction.create({
                    data: {
                        ...t,
                        companyId,
                        dollarRate,
                        paymentDate: t.paymentDate ? new Date(t.paymentDate) : null,
                    },
                    include: { category: true, item: true, batch: true }
                });

                results.push(transaction);
            }

            return results;
        });
    }

    // async createTransactions(
    //     data: CreateTransactionDto[],
    //     companyId: string,
    //     dollarRate: number,
    // ) {
    //     // Usamos una transacción para asegurar que todo ocurra o nada ocurra
    //     return await this.prisma.$transaction(async (tx) => {
    //         const results = [];

    //         for (const t of data) {
    //             // 1. Si la transacción incluye un item, validar coherencia y existencia
    //             if (t.itemId) {
    //                 const item = await tx.item.findUnique({
    //                     where: { id: t.itemId, companyId, isRemoved: false } // Aseguramos que el item pertenezca a la misma empresa,
    //                 });

    //                 if (!item) {
    //                     throw new BadRequestException(`El ítem con ID ${t.itemId} no existe.`);
    //                 }

    //                 const category = await tx.category.findUnique({
    //                     where: { id: t.categoryId, isRemoved: false }
    //                 });

    //                 if (!category) throw new NotFoundException(`La categoría con ID ${t.categoryId} no existe.`);

    //                 if (category.companyId !== companyId && category.isDefault === false) {
    //                     throw new UnauthorizedException(`La categoría no pertenece a la empresa.`);
    //                 }

    //                 // REGLA: Si incluye un item, la categoría DEBE ser INFLOW (venta/entrada de dinero)
    //                 if (category.flowDirection !== 'INFLOW') {
    //                     throw new BadRequestException(
    //                         `Las transacciones con ítems deben pertenecer a una categoría de entrada (INFLOW).`,
    //                     );
    //                 }

    //                 if(t.batchId) {
    //                     const batch = await tx.productionBatch.findUnique({
    //                         where: { id: t.batchId, companyId, isRemoved: false }
    //                     });

    //                     if (!batch) {
    //                         throw new BadRequestException(`El lote con ID ${t.batchId} no existe.`);
    //                     }
    //                 }

    //                 // REGLA: Si el ítem es de tipo PRODUCT, la cantidad es obligatoria
    //                 if (item.type === 'PRODUCT') {
    //                     if (!t.quantity || t.quantity <= 0) {
    //                         throw new BadRequestException(
    //                             `La cantidad es obligatoria para el producto: ${item.name}`,
    //                         );
    //                     }

    //                     // REGLA: Verificar stock suficiente
    //                     if (item.stockCurrent < t.quantity) {
    //                         throw new BadRequestException(
    //                             `Stock insuficiente para ${item.name}. Disponible: ${item.stockCurrent}, Requerido: ${t.quantity}`,
    //                         );
    //                     }

    //                     // 2. Restar cantidad del stock del producto
    //                     await tx.item.update({
    //                         where: { id: item.id },
    //                         data: {
    //                             stockCurrent: { decrement: t.quantity },
    //                         },
    //                     });
    //                 }
    //             }

    //             // 3. Crear la transacción individualmente dentro de la transacción global
    //             const transaction = await tx.transaction.create({
    //                 data: {
    //                     ...t,
    //                     companyId,
    //                     dollarRate,
    //                     // Aseguramos formato Date para paymentDate
    //                     paymentDate: t.paymentDate ? new Date(t.paymentDate) : null,
    //                 },
    //                 include: { category: true, item: true, batch: true }
    //                 });

    //             results.push(transaction);
    //         }

    //         return results;
    //     });
    // }


    async getTransactionsByCompany(companyId: string, userId: string) {

        return this.prisma.transaction.findMany({
            where: { companyId, isRemoved: false },
            orderBy: { createdAt: 'desc' },
            include: { category: true, item: true, batch: true }
        });
    }


}


