import { TransactionStatus, FlowDirection } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class ContributionMarginService {
  constructor(private prisma: PrismaService) {}

  // 1. NUEVO MÉTODO: Margen de Contribución Global de toda la empresa
  async getGlobalContributionMargin(
    companyId: string,
    startDate: Date,
    endDate: Date,
  ) {
    // Sumar TODOS los ingresos (INFLOW) de la empresa

    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const totalInflowAgg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true },
      where: {
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: { gte: start, lte: end },
        category: { flowDirection: FlowDirection.INFLOW },
      },
    });
    const totalSales = Number(totalInflowAgg._sum.amountUSD) || 0;
    const totalSalesBs = Number(totalInflowAgg._sum.amountBs) || 0;

    // Sumar TODOS los costos variables (OUTFLOW e isVariable: true)
    const totalVariableCostsAgg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true },
      where: {
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: { gte: start, lte: end },
        category: { flowDirection: FlowDirection.OUTFLOW, isVariable: true },
      },
    });
    const totalVariableCosts =
      Number(totalVariableCostsAgg._sum.amountUSD) || 0;
    const totalVariableCostsBs =
      Number(totalVariableCostsAgg._sum.amountBs) || 0;

    // Cálculos de Margen Global
    const totalMargin = totalSales - totalVariableCosts;
    const globalMarginRatio = totalSales > 0 ? totalMargin / totalSales : 0;

    const totalMarginBs = totalSalesBs - totalVariableCostsBs;
    const globalMarginRatioBs =
      totalSalesBs > 0 ? totalMarginBs / totalSalesBs : 0;

    return {
      totalSales,
      totalSalesBs,
      totalVariableCosts,
      totalVariableCostsBs,
      totalMargin,
      totalMarginBs,
      globalMarginRatio,
      globalMarginRatioBs,
    };
  }

  async getContributionMarginByProductDates(
    itemId: string,
    companyId: string,
    startDate: Date,
    endDate: Date,
  ) {
    // 1. Validar que el producto exista
    const item = await this.prisma.item.findUnique({
      where: { id: itemId, companyId, isRemoved: false },
    });

    if (!item)
      throw new NotFoundException('El producto especificado no existe.');
    if (item.type === 'SERVICE')
      throw new BadRequestException('El ítem especificado es un servicio.');

    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    // 2. Sumar las VENTAS REALES (INFLOW) del producto en el rango de fechas
    const inflowsAgg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true, quantity: true },
      where: {
        itemId: itemId,
        companyId: companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: { gte: start, lte: end },
        category: { flowDirection: FlowDirection.INFLOW },
      },
    });

    const totalSales = Number(inflowsAgg._sum.amountUSD) || 0;
    const totalSalesBs = Number(inflowsAgg._sum.amountBs) || 0;
    const totalUnitsSold = Number(inflowsAgg._sum.quantity) || 0;

    // 3. OBTENER EL COSTO VARIABLE DIRECTO DESDE TRANSACCIONES
    // Sumamos todas las transacciones OUTFLOW + isVariable asociadas directamente al producto
    const variableCostsAgg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true },
      where: {
        itemId: itemId,
        companyId: companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: { gte: start, lte: end },
        category: { flowDirection: FlowDirection.OUTFLOW, isVariable: true },
      },
    });

    const totalVariableCost = Number(variableCostsAgg._sum.amountUSD) || 0;
    const totalVariableCostBs = Number(variableCostsAgg._sum.amountBs) || 0;

    // 4. MATEMÁTICA FINANCIERA
    const contributionMargin = totalSales - totalVariableCost;
    const contributionMarginBs = totalSalesBs - totalVariableCostBs;
    const ratio = totalSales > 0 ? contributionMargin / totalSales : 0;

    const unitInflow = totalUnitsSold > 0 ? totalSales / totalUnitsSold : 0;
    const unitInflowBs = totalUnitsSold > 0 ? totalSalesBs / totalUnitsSold : 0;
    const avgUnitCost =
      totalUnitsSold > 0 ? totalVariableCost / totalUnitsSold : 0;
    const avgUnitCostBs =
      totalUnitsSold > 0 ? totalVariableCostBs / totalUnitsSold : 0;

    return {
      itemId: item.id,
      itemName: item.name,
      itemType: item.type,
      totalUnitsSold,
      period: { startDate: start, endDate: end },
      financials: {
        totalInflow: totalSales,
        totalInflowBs: totalSalesBs,
        totalVariableCost: Number(totalVariableCost.toFixed(2)),
        totalVariableCostBs: Number(totalVariableCostBs.toFixed(2)),
        contributionMargin: Number(contributionMargin.toFixed(2)),
        contributionMarginBs: Number(contributionMarginBs.toFixed(2)),
        contributionMarginRatio: Number(ratio.toFixed(2)),
      },
      unitAnalysis: {
        unitInflow: Number(unitInflow.toFixed(2)),
        unitInflowBs: Number(unitInflowBs.toFixed(2)),
        unitVariableCost: Number(avgUnitCost.toFixed(2)),
        unitVariableCostBs: Number(avgUnitCostBs.toFixed(2)),
        unitContributionMargin: Number((unitInflow - avgUnitCost).toFixed(2)),
        unitContributionMarginBs: Number(
          (unitInflowBs - avgUnitCostBs).toFixed(2),
        ),
      },
    };
  }

  // Método para obtener el margen de contribución de un lote específico en productos
  async getContributionMarginByBatch(batchId: string, companyId: string) {
    // 1. Validar que el lote exista y obtener información básica del Item asociado
    const batch = await this.prisma.productionBatch.findUnique({
      where: { id: batchId, isRemoved: false, companyId },
      include: { item: true },
    });

    if (!batch) {
      throw new NotFoundException('El lote de producción no existe.');
    }

    // 2. Sumar los COSTOS VARIABLES asociados estrictamente a este LOTE (en $ y Bs)
    const variableCostsAgg = await this.prisma.transaction.aggregate({
      _sum: {
        amountUSD: true,
        amountBs: true, // <-- Añadido
      },
      where: {
        batchId: batchId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        category: {
          flowDirection: FlowDirection.OUTFLOW,
          isVariable: true,
        },
      },
    });

    // 3. Sumar los INGRESOS asociados a este LOTE (en $ y Bs)
    const inflowsAgg = await this.prisma.transaction.aggregate({
      _sum: {
        amountUSD: true,
        amountBs: true, // <-- Añadido
      },
      where: {
        batchId: batchId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        category: {
          flowDirection: FlowDirection.INFLOW,
        },
      },
    });

    // 4. Convertir los Decimals de Prisma de manera segura
    const totalBatchVariableCost = Number(variableCostsAgg._sum.amountUSD) || 0;
    const totalBatchVariableCostBs =
      Number(variableCostsAgg._sum.amountBs) || 0;

    const totalBatchInflow = Number(inflowsAgg._sum.amountUSD) || 0;
    const totalBatchInflowBs = Number(inflowsAgg._sum.amountBs) || 0;

    // 5. Cálculos de Margen del Lote (Dólares y Bolívares)
    const batchContributionMargin = totalBatchInflow - totalBatchVariableCost;
    const batchContributionMarginBs =
      totalBatchInflowBs - totalBatchVariableCostBs;

    // El ratio porcentual (%) es el mismo para ambas monedas, usamos los montos en $
    const contributionMarginRatio =
      totalBatchInflow > 0 ? batchContributionMargin / totalBatchInflow : 0;

    // 6. Análisis Unitario ($)
    const unitVariableCost =
      batch.quantity > 0 ? totalBatchVariableCost / batch.quantity : 0;
    const unitInflow =
      batch.quantity > 0 ? totalBatchInflow / batch.quantity : 0;
    const unitContributionMargin = unitInflow - unitVariableCost;

    // 7. Análisis Unitario (Bs)
    const unitVariableCostBs =
      batch.quantity > 0 ? totalBatchVariableCostBs / batch.quantity : 0;
    const unitInflowBs =
      batch.quantity > 0 ? totalBatchInflowBs / batch.quantity : 0;
    const unitContributionMarginBs = unitInflowBs - unitVariableCostBs;

    return {
      batchId: batch.id,
      itemName: batch.item.name,
      batchQuantity: batch.quantity,
      batchStatus: batch.status,
      financials: {
        totalInflow: totalBatchInflow,
        totalInflowBs: totalBatchInflowBs,
        totalVariableCost: totalBatchVariableCost,
        totalVariableCostBs: totalBatchVariableCostBs,
        contributionMargin: batchContributionMargin,
        contributionMarginBs: batchContributionMarginBs,
        contributionMarginRatio: Number(contributionMarginRatio.toFixed(2)),
      },
      unitAnalysis: {
        unitInflow: Number(unitInflow.toFixed(2)),
        unitInflowBs: Number(unitInflowBs.toFixed(2)),
        unitVariableCost: Number(unitVariableCost.toFixed(2)),
        unitVariableCostBs: Number(unitVariableCostBs.toFixed(2)),
        unitContributionMargin: Number(unitContributionMargin.toFixed(2)),
        unitContributionMarginBs: Number(unitContributionMarginBs.toFixed(2)),
      },
    };
  }

  // Calculo del margen de contribucion de servicios

  async getContributionMarginByService(
    itemId: string,
    companyId: string,
    startDate: Date,
    endDate: Date,
  ) {
    // 1. Validar que el servicio/ítem exista
    const item = await this.prisma.item.findUnique({
      where: { id: itemId, companyId, isRemoved: false },
    });

    if (!item) {
      throw new NotFoundException('El servicio especificado no existe.');
    }

    if (item.type === 'PRODUCT')
      throw new BadRequestException('El ítem especificado no es un servicio.');

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

    // 2. Sumar COSTOS VARIABLES del servicio en el rango de fechas
    const variableCostsAgg = await this.prisma.transaction.aggregate({
      _sum: {
        amountUSD: true,
        amountBs: true,
        quantity: true, // Sumamos cuántas veces se ejecutó el costo variable
      },
      where: {
        itemId: itemId,
        companyId: companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: {
          gte: start,
          lte: end,
        },
        category: {
          flowDirection: FlowDirection.OUTFLOW,
          isVariable: true,
        },
      },
    });

    // 3. Sumar los INGRESOS (Ventas) del servicio en el rango de fechas
    const inflowsAgg = await this.prisma.transaction.aggregate({
      _sum: {
        amountUSD: true,
        amountBs: true,
        quantity: true, // Sumamos cuántas unidades de servicio se vendieron
      },
      where: {
        itemId: itemId,
        companyId: companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: {
          gte: start,
          lte: end,
        },
        category: {
          flowDirection: FlowDirection.INFLOW,
        },
      },
    });

    // 4. Extraer totales de manera segura
    const totalVariableCost = Number(variableCostsAgg._sum.amountUSD) || 0;
    const totalVariableCostBs = Number(variableCostsAgg._sum.amountBs) || 0;

    const totalInflow = Number(inflowsAgg._sum.amountUSD) || 0;
    const totalInflowBs = Number(inflowsAgg._sum.amountBs) || 0;

    // Cantidad de servicios vendidos (actúa como el quantity del batch)
    const totalServicesSold = Number(inflowsAgg._sum.quantity) || 0;

    // 5. Cálculos de Margen del Servicio
    const contributionMargin = totalInflow - totalVariableCost;
    const contributionMarginBs = totalInflowBs - totalVariableCostBs;

    const contributionMarginRatio =
      totalInflow > 0 ? contributionMargin / totalInflow : 0;

    // 6. Análisis Unitario (Por cada ejecución del servicio)
    const unitVariableCost =
      totalServicesSold > 0 ? totalVariableCost / totalServicesSold : 0;
    const unitInflow =
      totalServicesSold > 0 ? totalInflow / totalServicesSold : 0;
    const unitContributionMargin = unitInflow - unitVariableCost;

    const unitVariableCostBs =
      totalServicesSold > 0 ? totalVariableCostBs / totalServicesSold : 0;
    const unitInflowBs =
      totalServicesSold > 0 ? totalInflowBs / totalServicesSold : 0;
    const unitContributionMarginBs = unitInflowBs - unitVariableCostBs;

    return {
      itemId: item.id,
      itemName: item.name,
      itemType: item.type,
      totalServicesSold,
      period: {
        startDate: start,
        endDate: end,
      },
      financials: {
        totalInflow,
        totalInflowBs,
        totalVariableCost,
        totalVariableCostBs,
        contributionMargin,
        contributionMarginBs,
        contributionMarginRatio: Number(contributionMarginRatio.toFixed(2)),
      },
      unitAnalysis: {
        unitInflow: Number(unitInflow.toFixed(2)),
        unitInflowBs: Number(unitInflowBs.toFixed(2)),
        unitVariableCost: Number(unitVariableCost.toFixed(2)),
        unitVariableCostBs: Number(unitVariableCostBs.toFixed(2)),
        unitContributionMargin: Number(unitContributionMargin.toFixed(2)),
        unitContributionMarginBs: Number(unitContributionMarginBs.toFixed(2)),
      },
    };
  }
}
