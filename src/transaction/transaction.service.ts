import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CreateTransactionDto, UpdateTransactionDto } from './dto/transaction.dto';


@Injectable()
export class TransactionService {
    constructor(private prisma: PrismaService) { }

    // 1 Crear transacciones financieras con validaciones avanzadas y manejo de stock dinámico
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

    //2 Obtener lista de todas las transacciones
    async getTransactionsByCompany(companyId: string) {

        return this.prisma.transaction.findMany({
            where: { companyId, isRemoved: false },
            orderBy: { createdAt: 'desc' },
            include: { category: true, item: true, batch: true }
        });
    }

    //3 Obtener la informacion de una transaccion
    async getTransactionById(id: string, companyId: string) {
        const transaction = await this.prisma.transaction.findFirst({
            where: { id, companyId, isRemoved: false },
            include: { category: true, item: true, batch: true }
        });

        if (!transaction) {
            throw new NotFoundException(`La transacción con ID ${id} no existe.`);
        }

        return transaction;
    }

    //4 Actualizar una transaccion
    async updateTransaction(id: string, companyId: string, data: UpdateTransactionDto) {
        const transaction = await this.prisma.transaction.findFirst({
            where: { id, companyId, isRemoved: false },
        });
        if (!transaction) {
            throw new NotFoundException(`La transacción con ID ${id} no existe.`);
        }

        return await this.prisma.transaction.update({
            where: { id },
            data: { ...data }
        });
    }

    //5 Eliminar una transaccion (soft delete)
    async deleteTransaction(id: string, companyId: string) {
        const transaction = await this.prisma.transaction.findFirst({
            where: { id, companyId, isRemoved: false },
        });

        if (!transaction) {
            throw new NotFoundException(`La transacción con ID ${id} no existe.`);
        }

        return await this.prisma.transaction.update({
            where: { id },
            data: { isRemoved: true }
        });
    }



    //6 Obtener las transacciones dentro de un rango de fechas específico
    async getTransactionsByDateRange(companyId: string, startDate: Date, endDate: Date) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        return this.prisma.transaction.findMany({
            where: {
                companyId,
                isRemoved: false,
                paymentDate: {
                    gte: start,
                    lte: end,
                }
            }
        });
    }

    //7 Obtener transacciones por categoría específica
    async getTransactionsByCategory(companyId: string, categoryId: string) {

        const category = await this.prisma.category.findFirst({
            where: {
                AND: [
                    { id: categoryId, isRemoved: false },
                    {
                        OR: [
                            { companyId: companyId }, // Categoría propia de la empresa
                            { isDefault: true }        // Categoría global del sistema
                        ]
                    }
                ]
            }
        });

        if (!category) {
            throw new NotFoundException(`La categoría con ID ${categoryId} no existe o no pertenece a la empresa.`);
        }

        return this.prisma.transaction.findMany({
            where: { companyId, categoryId, isRemoved: false },
            orderBy: { createdAt: 'desc' },
            include: { category: true, item: true, batch: true }
        });
    }
}


