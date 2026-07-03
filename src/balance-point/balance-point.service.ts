import { ContributionMarginService } from '@/contribution-margin/contribution-margin.service';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { TransactionStatus, FlowDirection } from '@prisma/client';

@Injectable()
export class BalancePointService {
  constructor(
    private readonly contributionMarginService: ContributionMarginService,
    private readonly prisma: PrismaService,
  ) {}

  async getCompanyBreakEven(companyId: string, startDate: Date, endDate: Date) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    // 1. Consumimos el nuevo método aislado de margen global
    const globalMargin =
      await this.contributionMarginService.getGlobalContributionMargin(
        companyId,
        startDate,
        endDate,
      );

    // 2. Sumar TODOS los costos fijos (OUTFLOW e isVariable: false) del mes
    const totalFixedCostsAgg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true },
      where: {
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: { gte: start, lte: end },
        category: { flowDirection: FlowDirection.OUTFLOW, isVariable: false },
      },
    });

    const totalFixedCosts = Number(totalFixedCostsAgg._sum.amountUSD) || 0;
    const totalFixedCostsBs = Number(totalFixedCostsAgg._sum.amountBs) || 0;

    // 3. PUNTO DE EQUILIBRIO GLOBAL (Meta mínima usando los ratios del servicio de margen)
    const breakEvenSalesVolume =
      globalMargin.globalMarginRatio > 0
        ? totalFixedCosts / globalMargin.globalMarginRatio
        : 0;

    const breakEvenSalesVolumeBs =
      globalMargin.globalMarginRatioBs > 0
        ? totalFixedCostsBs / globalMargin.globalMarginRatioBs
        : 0;

    return {
      companyId,
      period: { startDate: start, endDate: end },
      financialsActual: {
        dollars: {
          totalSales: globalMargin.totalSales,
          totalVariableCosts: globalMargin.totalVariableCosts,
          totalFixedCosts,
          globalMarginRatio: Number(
            (globalMargin.globalMarginRatio * 100).toFixed(2),
          ),
        },
        bs: {
          totalSalesBs: globalMargin.totalSalesBs,
          totalVariableCostsBs: globalMargin.totalVariableCostsBs,
          totalFixedCostsBs,
          globalMarginRatioBs: Number(
            (globalMargin.globalMarginRatioBs * 100).toFixed(2),
          ),
        },
      },
      breakEven: {
        salesVolumeRequired: Number(breakEvenSalesVolume.toFixed(2)),
        salesVolumeRequiredBs: Number(breakEvenSalesVolumeBs.toFixed(2)),
        isSafe: globalMargin.totalSales >= breakEvenSalesVolume,
        distanceToBreakEven: Number(
          (globalMargin.totalSales - breakEvenSalesVolume).toFixed(2),
        ),
        distanceToBreakEvenBs: Number(
          (globalMargin.totalSalesBs - breakEvenSalesVolumeBs).toFixed(2),
        ),
      },
    };
  }
}
