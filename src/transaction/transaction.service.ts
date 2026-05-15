import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CreateTransactionDto } from './dto/transaction.dto';
import { CompanyService } from '@/company/company.service';


@Injectable()
export class TransactionService {
    constructor(private prisma: PrismaService) { }

    async createTransactions(
        data: CreateTransactionDto[],
        companyId: string,
        dollarRate: number,
    ) {
        // Usamos una transacción para asegurar que todo ocurra o nada ocurra
        return await this.prisma.$transaction(async (tx) => {
            const results = [];

            for (const t of data) {
                // 1. Si la transacción incluye un item, validar coherencia y existencia
                if (t.itemId) {
                    const item = await tx.item.findUnique({
                        where: { id: t.itemId, companyId, isRemoved: false } // Aseguramos que el item pertenezca a la misma empresa,
                    });

                    if (!item) {
                        throw new BadRequestException(`El ítem con ID ${t.itemId} no existe.`);
                    }

                    const category = await tx.category.findUnique({
                        where: { id: t.categoryId, isRemoved: false }
                    });

                    if (!category) throw new NotFoundException(`La categoría con ID ${t.categoryId} no existe.`);

                    if (category.companyId !== companyId && category.isDefault === false) {
                        throw new UnauthorizedException(`La categoría no pertenece a la empresa.`);
                    }

                    // REGLA: Si incluye un item, la categoría DEBE ser INFLOW (venta/entrada de dinero)
                    if (category.flowDirection !== 'INFLOW') {
                        throw new BadRequestException(
                            `Las transacciones con ítems deben pertenecer a una categoría de entrada (INFLOW).`,
                        );
                    }

                    // REGLA: Si el ítem es de tipo PRODUCT, la cantidad es obligatoria
                    if (item.type === 'PRODUCT') {
                        if (!t.quantity || t.quantity <= 0) {
                            throw new BadRequestException(
                                `La cantidad es obligatoria para el producto: ${item.name}`,
                            );
                        }

                        // REGLA: Verificar stock suficiente
                        if (item.stockCurrent < t.quantity) {
                            throw new BadRequestException(
                                `Stock insuficiente para ${item.name}. Disponible: ${item.stockCurrent}, Requerido: ${t.quantity}`,
                            );
                        }

                        // 2. Restar cantidad del stock del producto
                        await tx.item.update({
                            where: { id: item.id },
                            data: {
                                stockCurrent: { decrement: t.quantity },
                            },
                        });
                    }
                }

                // 3. Crear la transacción individualmente dentro de la transacción global
                const transaction = await tx.transaction.create({
                    data: {
                        ...t,
                        companyId,
                        dollarRate,
                        // Aseguramos formato Date para paymentDate
                        paymentDate: t.paymentDate ? new Date(t.paymentDate) : null,
                    },
                });

                results.push(transaction);
            }

            return results;
        });
    }

    // async createTransactions(
    //     data: CreateTransactionDto[],
    //     companyId: string,
    //     dollarRate: number
    // ) {
    //     const transactions = await this.prisma.transaction.createMany({
    //         data: data.map((transaction) => ({
    //             ...transaction,
    //             companyId,
    //             dollarRate,
    //         })),
    //         skipDuplicates: true,
    //     });

    //     return transactions;
    // }

    async getTransactionsByCompany(companyId: string, userId: string) {

        return this.prisma.transaction.findMany({
            where: { companyId, isRemoved: false },
            orderBy: { createdAt: 'desc' },
            include: { category: true, item: true, batch: true }
        });
    }



    async getTotalCashFlow(companyId: string, startDate?: Date, endDate?: Date) {
        const transactions = await this.prisma.transaction.findMany({
            where: {
                companyId,
                status: { in: ['COMPLETED', 'PENDING'] }, // Incluimos ambos para el resumen
                isRemoved: false,
                // Opcional: Filtrar por periodo si se proporcionan fechas
                paymentDate: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            include: {
                category: true,
            },
        });

        // Colores sugeridos por tipo de flujo/categoría
        const colorMap = {
            INFLOW: '#4CAF50', // Verde
            OUTFLOW: '#F44336', // Rojo
        };

        const initialSummary = {
            usd: { current_balance: 0, pending_inflow: 0, pending_outflow: 0, net_cash_flow: 0 },
            bs: { current_balance: 0, pending_inflow: 0, pending_outflow: 0, net_cash_flow: 0 }
        };

        const cashFlowStatement = {
            OPERATING: { totalUsd: 0, totalBs: 0, categories: new Map() },
            INVESTING: { totalUsd: 0, totalBs: 0, categories: new Map() },
            FINANCING: { totalUsd: 0, totalBs: 0, categories: new Map() },
        };

        const summary = transactions.reduce((acc, curr) => {
            const amountUsd = Number(curr.amount);
            const amountBs = Number(curr.amountBs);
            const isInflow = curr.category.flowDirection === 'INFLOW';

            // 1. Lógica de Resumen (Summary)
            const currencies = ['usd', 'bs'] as const;
            currencies.forEach(cur => {
                const val = cur === 'usd' ? amountUsd : amountBs;

                if (curr.status === 'COMPLETED') {
                    acc[cur].current_balance += isInflow ? val : -val;
                } else if (curr.status === 'PENDING') {
                    if (isInflow) acc[cur].pending_inflow += val;
                    else acc[cur].pending_outflow -= val;
                }
                // Net cash flow es la proyección total
                acc[cur].net_cash_flow = acc[cur].current_balance + acc[cur].pending_inflow + acc[cur].pending_outflow;
            });

            // 2. Lógica de Cash Flow Statement (Solo completados para el reporte formal)
            if (curr.status === 'COMPLETED') {
                const type = curr.category.type; // OPERATING, etc.
                const catId = curr.category.id;
                const signedUsd = isInflow ? amountUsd : -amountUsd;
                const signedBs = isInflow ? amountBs : -amountBs;

                cashFlowStatement[type].totalUsd += signedUsd;
                cashFlowStatement[type].totalBs += signedBs;

                if (!cashFlowStatement[type].categories.has(catId)) {
                    cashFlowStatement[type].categories.set(catId, {
                        name: curr.category.name,
                        amountUsd: 0,
                        amountBs: 0,
                        color: colorMap[curr.category.flowDirection]
                    });
                }

                const catData = cashFlowStatement[type].categories.get(catId);
                catData.amountUsd += signedUsd;
                catData.amountBs += signedBs;
            }

            return acc;
        }, initialSummary);

        // Formatear el mapa de categorías a un array para la respuesta JSON
        const formatStatement = (type: keyof typeof cashFlowStatement, currency: 'Usd' | 'Bs') => ({
            total: cashFlowStatement[type][`total${currency}`],
            categories: Array.from(cashFlowStatement[type].categories.values()).map(c => ({
                name: c.name,
                amount: c[`amount${currency}`],
                color: c.color
            }))
        });

        return {
            companyId,
            // Retornamos ambas monedas siguiendo la estructura de la imagen
            usd: {
                summary: summary.usd,
                cash_flow_statement: {
                    operating: formatStatement('OPERATING', 'Usd'),
                    investing: formatStatement('INVESTING', 'Usd'),
                    financing: formatStatement('FINANCING', 'Usd'),
                }
            },
            bs: {
                summary: summary.bs,
                cash_flow_statement: {
                    operating: formatStatement('OPERATING', 'Bs'),
                    investing: formatStatement('INVESTING', 'Bs'),
                    financing: formatStatement('FINANCING', 'Bs'),
                }
            },
            period: {
                start_date: startDate || transactions[transactions.length - 1]?.createdAt,
                end_date: endDate || new Date()
            }
        };
    }

    async getCashFlow(companyId: string, startDate: Date, endDate: Date) {
        // 1. Validación y ajuste de fechas (Evita el error de Invalid Date)
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            // Si las fechas son inválidas, podrías optar por no filtrar o lanzar un error
            // Aquí optamos por traer los últimos 30 días por defecto si fallan
            start.setDate(new Date().getDate() - 30);
            end.setHours(23, 59, 59, 999);
        } else {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        }

        const transactions = await this.prisma.transaction.findMany({
            where: {
                companyId,
                isRemoved: false,
                status: 'COMPLETED',
                paymentDate: {
                    gte: start,
                    lte: end
                },
            },
            include: {
                category: true,
            },
            orderBy: {
                paymentDate: 'desc',
            },
        });

        // 2. Inicialización de la estructura tipo "Statement"
        const colorMap = {
            INFLOW: '#4CAF50',
            OUTFLOW: '#F44336',
        };

        const cashFlowStatement = {
            OPERATING: { totalUsd: 0, totalBs: 0, categories: new Map() },
            INVESTING: { totalUsd: 0, totalBs: 0, categories: new Map() },
            FINANCING: { totalUsd: 0, totalBs: 0, categories: new Map() },
        };

        // 3. Procesamiento en un solo paso
        const totals = transactions.reduce(
            (acc, curr) => {
                const amountUsd = Number(curr.amount);
                const amountBs = Number(curr.amountBs);
                const isInflow = curr.category.flowDirection === 'INFLOW';
                const signedUsd = isInflow ? amountUsd : -amountUsd;
                const signedBs = isInflow ? amountBs : -amountBs;

                // Totales generales para el summary
                if (isInflow) {
                    acc.inflowUsd += amountUsd;
                    acc.inflowBs += amountBs;
                } else {
                    acc.outflowUsd += amountUsd;
                    acc.outflowBs += amountBs;
                }

                // Agrupación por tipo de categoría (Operating, Investing, Financing)
                const type = curr.category.type;
                const catId = curr.category.id;

                cashFlowStatement[type].totalUsd += signedUsd;
                cashFlowStatement[type].totalBs += signedBs;

                if (!cashFlowStatement[type].categories.has(catId)) {
                    cashFlowStatement[type].categories.set(catId, {
                        name: curr.category.name,
                        amountUsd: 0,
                        amountBs: 0,
                        color: colorMap[curr.category.flowDirection]
                    });
                }

                const catData = cashFlowStatement[type].categories.get(catId);
                catData.amountUsd += signedUsd;
                catData.amountBs += signedBs;

                return acc;
            },
            { inflowUsd: 0, outflowUsd: 0, inflowBs: 0, outflowBs: 0 },
        );

        // 4. Formateador de secciones del Statement
        const formatSection = (type: keyof typeof cashFlowStatement, currency: 'Usd' | 'Bs') => ({
            total: cashFlowStatement[type][`total${currency}`],
            categories: Array.from(cashFlowStatement[type].categories.values()).map(c => ({
                name: c.name,
                amount: c[`amount${currency}`],
                color: c.color
            }))
        });

        // 5. Respuesta Final (Combinando el summary de la imagen + tus records)
        return {
            period: { startDate, endDate },
            usd: {
                summary: {
                    current_balance: totals.inflowUsd - totals.outflowUsd, // balance de lo completado en el rango
                    inflow: totals.inflowUsd,
                    outflow: totals.outflowUsd,
                    net_cash_flow: totals.inflowUsd - totals.outflowUsd
                },
                cash_flow_statement: {
                    operating: formatSection('OPERATING', 'Usd'),
                    investing: formatSection('INVESTING', 'Usd'),
                    financing: formatSection('FINANCING', 'Usd'),
                }
            },
            bs: {
                summary: {
                    current_balance: totals.inflowBs - totals.outflowBs,
                    inflow: totals.inflowBs,
                    outflow: totals.outflowBs,
                    net_cash_flow: totals.inflowBs - totals.outflowBs
                },
                cash_flow_statement: {
                    operating: formatSection('OPERATING', 'Bs'),
                    investing: formatSection('INVESTING', 'Bs'),
                    financing: formatSection('FINANCING', 'Bs'),
                }
            },
            transactionCount: transactions.length,
            records: transactions // Mantenemos los registros originales por si el frontend los lista
        };
    }

}


