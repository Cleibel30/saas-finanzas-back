import { ContributionMarginService } from '@/contribution-margin/contribution-margin.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TransactionStatus, FlowDirection } from '@prisma/client';

@Injectable()
export class BalancePointService {
  constructor(
    private readonly contributionMarginService: ContributionMarginService,
    private readonly prisma: PrismaService,
  ) {}

  private getDataConfidence(transactionCount: number): string {
    if (transactionCount === 0) return 'insufficient';
    if (transactionCount < 5) return 'low';
    if (transactionCount < 20) return 'medium';
    return 'high';
  }

  private resolveMarginStatus(
    breakEvenStatus: string,
    isSafeUsd: boolean,
    isSafeBs: boolean,
    ratioUsd: number,
    ratioBs: number,
  ): string {
    if (breakEvenStatus === 'no_sales') return 'no_sales';
    if (ratioUsd <= 0 || ratioBs <= 0) return 'negative';
    if (isSafeUsd && isSafeBs) return 'safe';
    return 'at_risk';
  }

  async getCompanyBreakEven(companyId: string, startDate: Date, endDate: Date) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const transactionCountAgg = await this.prisma.transaction.aggregate({
      _count: { id: true },
      where: {
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: { gte: start, lte: end },
        category: { flowDirection: FlowDirection.INFLOW },
      },
    });
    const transactionCount = transactionCountAgg._count.id;

    const globalMargin =
      await this.contributionMarginService.getGlobalContributionMargin(
        companyId,
        startDate,
        endDate,
      );

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

    const breakEvenSalesVolume =
      globalMargin.globalMarginRatio > 0
        ? totalFixedCosts / globalMargin.globalMarginRatio
        : null;

    const breakEvenSalesVolumeBs =
      globalMargin.globalMarginRatioBs > 0
        ? totalFixedCostsBs / globalMargin.globalMarginRatioBs
        : null;

    const isSafeUsd =
      breakEvenSalesVolume !== null &&
      globalMargin.totalSales >= breakEvenSalesVolume;
    const isSafeBs =
      breakEvenSalesVolumeBs !== null &&
      globalMargin.totalSalesBs >= breakEvenSalesVolumeBs;

    const breakEvenStatus =
      transactionCount === 0
        ? 'no_sales'
        : globalMargin.globalMarginRatio <= 0 ||
            globalMargin.globalMarginRatioBs <= 0
          ? 'negative_margin'
          : isSafeUsd && isSafeBs
            ? 'safe'
            : 'at_risk';

    const dataConfidence = this.getDataConfidence(transactionCount);

    const marginStatus = this.resolveMarginStatus(
      breakEvenStatus,
      isSafeUsd,
      isSafeBs,
      globalMargin.globalMarginRatio,
      globalMargin.globalMarginRatioBs,
    );

    return {
      companyId,
      period: { startDate: start, endDate: end },
      breakEvenStatus,
      dataConfidence,
      transactionCount,
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
        salesVolumeRequired:
          breakEvenSalesVolume !== null
            ? Number(breakEvenSalesVolume.toFixed(2))
            : null,
        salesVolumeRequiredBs:
          breakEvenSalesVolumeBs !== null
            ? Number(breakEvenSalesVolumeBs.toFixed(2))
            : null,
        isEstimated: false,
        isSafe:
          breakEvenStatus === 'safe'
            ? true
            : breakEvenStatus === 'no_sales'
              ? null
              : false,
        isSafeUsd,
        isSafeBs,
        distanceToBreakEven:
          breakEvenSalesVolume !== null
            ? Number(
                (globalMargin.totalSales - breakEvenSalesVolume).toFixed(2),
              )
            : null,
        distanceToBreakEvenBs:
          breakEvenSalesVolumeBs !== null
            ? Number(
                (globalMargin.totalSalesBs - breakEvenSalesVolumeBs).toFixed(2),
              )
            : null,
        marginStatus,
        marginStatusUsd:
          globalMargin.globalMarginRatio <= 0
            ? 'negative'
            : isSafeUsd
              ? 'safe'
              : 'at_risk',
        marginStatusBs:
          globalMargin.globalMarginRatioBs <= 0
            ? 'negative'
            : isSafeBs
              ? 'safe'
              : 'at_risk',
      },
    };
  }

  async getProductBreakEven(
    itemId: string,
    companyId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const item = await this.prisma.item.findUnique({
      where: { id: itemId, companyId, isRemoved: false },
    });

    if (!item)
      throw new NotFoundException('El producto especificado no existe.');
    if (item.type === 'SERVICE')
      throw new BadRequestException('El ítem especificado es un servicio.');

    const transactionCountAgg = await this.prisma.transaction.aggregate({
      _count: { id: true },
      where: {
        itemId,
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: { gte: start, lte: end },
        category: { flowDirection: FlowDirection.INFLOW },
      },
    });
    const transactionCount = transactionCountAgg._count.id;

    const productMargin =
      await this.contributionMarginService.getContributionMarginByProductDates(
        itemId,
        companyId,
        startDate,
        endDate,
      );

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

    const totalCompanySalesAgg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true },
      where: {
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: { gte: start, lte: end },
        category: { flowDirection: FlowDirection.INFLOW },
      },
    });

    const totalCompanySales = Number(totalCompanySalesAgg._sum.amountUSD) || 0;
    const totalCompanySalesBs = Number(totalCompanySalesAgg._sum.amountBs) || 0;

    const participation =
      totalCompanySales > 0
        ? productMargin.financials.totalInflow / totalCompanySales
        : 0;
    const participationBs =
      totalCompanySalesBs > 0
        ? productMargin.financials.totalInflowBs / totalCompanySalesBs
        : 0;

    const allocatedFixedCosts = totalFixedCosts * participation;
    const allocatedFixedCostsBs = totalFixedCostsBs * participationBs;

    let ratio = productMargin.financials.contributionMarginRatio;
    let ratioBs =
      productMargin.financials.totalInflowBs > 0
        ? (productMargin.financials.totalInflowBs -
            productMargin.financials.totalVariableCostBs) /
          productMargin.financials.totalInflowBs
        : 0;

    let unitPrice = productMargin.unitAnalysis.unitInflow;
    let unitPriceBs = productMargin.unitAnalysis.unitInflowBs;
    let unitVariableCost = productMargin.unitAnalysis.unitVariableCost;
    let unitVariableCostBs = productMargin.unitAnalysis.unitVariableCostBs;
    let unitContributionMargin =
      productMargin.unitAnalysis.unitContributionMargin;
    let unitContributionMarginBs =
      productMargin.unitAnalysis.unitContributionMarginBs;

    let breakEvenVolume = ratio > 0 ? allocatedFixedCosts / ratio : null;
    let breakEvenVolumeBs =
      ratioBs > 0 ? allocatedFixedCostsBs / ratioBs : null;

    let isEstimated = false;

    if (transactionCount === 0 && Number(item.basePrice) > 0) {
      const basePrice = Number(item.basePrice);
      const basePriceBs = basePrice * 7.8;

      unitPrice = basePrice;
      unitPriceBs = basePriceBs;
      unitVariableCost = productMargin.unitAnalysis.unitVariableCost || 0;
      unitVariableCostBs = productMargin.unitAnalysis.unitVariableCostBs || 0;
      unitContributionMargin = basePrice - unitVariableCost;
      unitContributionMarginBs = basePriceBs - unitVariableCostBs;

      if (unitContributionMargin > 0) {
        ratio = unitContributionMargin / basePrice;
        ratioBs =
          unitContributionMarginBs > 0
            ? unitContributionMarginBs / basePriceBs
            : 0;
        breakEvenVolume = ratio > 0 ? allocatedFixedCosts / ratio : null;
        breakEvenVolumeBs =
          ratioBs > 0 ? allocatedFixedCostsBs / ratioBs : null;
        isEstimated = true;
      }
    }

    const unitsRequired =
      breakEvenVolume !== null && unitContributionMargin > 0
        ? Math.ceil(allocatedFixedCosts / unitContributionMargin)
        : null;
    const unitsRequiredBs =
      breakEvenVolumeBs !== null && unitContributionMarginBs > 0
        ? Math.ceil(allocatedFixedCostsBs / unitContributionMarginBs)
        : null;

    const isSafeUsd =
      breakEvenVolume !== null &&
      productMargin.financials.totalInflow >= breakEvenVolume;
    const isSafeBs =
      breakEvenVolumeBs !== null &&
      productMargin.financials.totalInflowBs >= breakEvenVolumeBs;

    const breakEvenStatus =
      transactionCount === 0
        ? 'no_sales'
        : ratio <= 0 || ratioBs <= 0
          ? 'negative_margin'
          : isSafeUsd && isSafeBs
            ? 'safe'
            : 'at_risk';

    const dataConfidence = this.getDataConfidence(transactionCount);

    const marginStatus = this.resolveMarginStatus(
      breakEvenStatus,
      isSafeUsd,
      isSafeBs,
      ratio,
      ratioBs,
    );

    return {
      itemId: item.id,
      itemName: item.name,
      itemType: item.type,
      companyId,
      period: { startDate: start, endDate: end },
      breakEvenStatus,
      dataConfidence,
      transactionCount,
      financialsActual: {
        dollars: {
          totalSales: productMargin.financials.totalInflow,
          totalVariableCosts: productMargin.financials.totalVariableCost,
          totalFixedCosts: Number(allocatedFixedCosts.toFixed(2)),
          contributionMarginRatio: Number((ratio * 100).toFixed(2)),
          unitPrice: Number(unitPrice.toFixed(2)),
          unitVariableCost: Number(unitVariableCost.toFixed(2)),
          unitContributionMargin: Number(unitContributionMargin.toFixed(2)),
        },
        bs: {
          totalSalesBs: productMargin.financials.totalInflowBs,
          totalVariableCostsBs: productMargin.financials.totalVariableCostBs,
          totalFixedCostsBs: Number(allocatedFixedCostsBs.toFixed(2)),
          contributionMarginRatioBs: Number((ratioBs * 100).toFixed(2)),
          unitPriceBs: Number(unitPriceBs.toFixed(2)),
          unitVariableCostBs: Number(unitVariableCostBs.toFixed(2)),
          unitContributionMarginBs: Number(unitContributionMarginBs.toFixed(2)),
        },
      },
      breakEven: {
        salesVolumeRequired:
          breakEvenVolume !== null ? Number(breakEvenVolume.toFixed(2)) : null,
        salesVolumeRequiredBs:
          breakEvenVolumeBs !== null
            ? Number(breakEvenVolumeBs.toFixed(2))
            : null,
        unitsRequired:
          unitsRequired !== null &&
          unitsRequiredBs !== null &&
          unitsRequired === unitsRequiredBs
            ? unitsRequired
            : unitsRequired,
        unitsRequiredBs:
          unitsRequiredBs !== null &&
          unitsRequired !== null &&
          unitsRequired === unitsRequiredBs
            ? undefined
            : unitsRequiredBs,
        isEstimated,
        isSafe:
          breakEvenStatus === 'safe'
            ? true
            : breakEvenStatus === 'no_sales'
              ? null
              : false,
        isSafeUsd,
        isSafeBs,
        distanceToBreakEven:
          breakEvenVolume !== null
            ? Number(
                (
                  productMargin.financials.totalInflow - breakEvenVolume
                ).toFixed(2),
              )
            : null,
        distanceToBreakEvenBs:
          breakEvenVolumeBs !== null
            ? Number(
                (
                  productMargin.financials.totalInflowBs - breakEvenVolumeBs
                ).toFixed(2),
              )
            : null,
        distanceToBreakEvenUnits:
          breakEvenVolume !== null && unitsRequired !== null
            ? productMargin.totalUnitsSold - unitsRequired
            : null,
        marginStatus,
        marginStatusUsd:
          ratio <= 0 ? 'negative' : isSafeUsd ? 'safe' : 'at_risk',
        marginStatusBs:
          ratioBs <= 0 ? 'negative' : isSafeBs ? 'safe' : 'at_risk',
      },
    };
  }

  async getBatchBreakEven(batchId: string, companyId: string) {
    const batch = await this.prisma.productionBatch.findUnique({
      where: { id: batchId, isRemoved: false, companyId },
      include: { item: true },
    });

    if (!batch) throw new NotFoundException('El lote de producción no existe.');

    const batchDate = new Date(batch.batchDate);
    const start = new Date(batchDate.getFullYear(), batchDate.getMonth(), 1);
    const end = new Date(
      batchDate.getFullYear(),
      batchDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const transactionCountAgg = await this.prisma.transaction.aggregate({
      _count: { id: true },
      where: {
        batchId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        category: { flowDirection: FlowDirection.INFLOW },
      },
    });
    const transactionCount = transactionCountAgg._count.id;

    const batchMargin =
      await this.contributionMarginService.getContributionMarginByBatch(
        batchId,
        companyId,
      );

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

    const totalCompanySalesAgg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true },
      where: {
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: { gte: start, lte: end },
        category: { flowDirection: FlowDirection.INFLOW },
      },
    });

    const totalCompanySales = Number(totalCompanySalesAgg._sum.amountUSD) || 0;
    const totalCompanySalesBs = Number(totalCompanySalesAgg._sum.amountBs) || 0;

    const participation =
      totalCompanySales > 0
        ? batchMargin.financials.totalInflow / totalCompanySales
        : 0;
    const participationBs =
      totalCompanySalesBs > 0
        ? batchMargin.financials.totalInflowBs / totalCompanySalesBs
        : 0;

    const allocatedFixedCosts = totalFixedCosts * participation;
    const allocatedFixedCostsBs = totalFixedCostsBs * participationBs;

    let ratio = batchMargin.financials.contributionMarginRatio;
    let ratioBs =
      batchMargin.financials.totalInflowBs > 0
        ? (batchMargin.financials.totalInflowBs -
            batchMargin.financials.totalVariableCostBs) /
          batchMargin.financials.totalInflowBs
        : 0;

    let unitPrice = batchMargin.unitAnalysis.unitInflow;
    let unitPriceBs = batchMargin.unitAnalysis.unitInflowBs;
    let unitVariableCost = batchMargin.unitAnalysis.unitVariableCost;
    let unitVariableCostBs = batchMargin.unitAnalysis.unitVariableCostBs;
    let unitContributionMargin =
      batchMargin.unitAnalysis.unitContributionMargin;
    let unitContributionMarginBs =
      batchMargin.unitAnalysis.unitContributionMarginBs;

    let breakEvenVolume = ratio > 0 ? allocatedFixedCosts / ratio : null;
    let breakEvenVolumeBs =
      ratioBs > 0 ? allocatedFixedCostsBs / ratioBs : null;

    let isEstimated = false;

    if (transactionCount === 0 && Number(batch.item.basePrice) > 0) {
      const basePrice = Number(batch.item.basePrice);
      const basePriceBs = basePrice * 7.8;

      unitPrice = basePrice;
      unitPriceBs = basePriceBs;
      unitVariableCost =
        batch.quantity > 0
          ? batchMargin.financials.totalVariableCost / batch.quantity
          : 0;
      unitVariableCostBs =
        batch.quantity > 0
          ? batchMargin.financials.totalVariableCostBs / batch.quantity
          : 0;
      unitContributionMargin = basePrice - unitVariableCost;
      unitContributionMarginBs = basePriceBs - unitVariableCostBs;

      if (unitContributionMargin > 0) {
        ratio = unitContributionMargin / basePrice;
        ratioBs =
          unitContributionMarginBs > 0
            ? unitContributionMarginBs / basePriceBs
            : 0;
        breakEvenVolume = ratio > 0 ? allocatedFixedCosts / ratio : null;
        breakEvenVolumeBs =
          ratioBs > 0 ? allocatedFixedCostsBs / ratioBs : null;
        isEstimated = true;
      }
    }

    const unitsRequired =
      breakEvenVolume !== null && unitContributionMargin > 0
        ? Math.ceil(allocatedFixedCosts / unitContributionMargin)
        : null;
    const unitsRequiredBs =
      breakEvenVolumeBs !== null && unitContributionMarginBs > 0
        ? Math.ceil(allocatedFixedCostsBs / unitContributionMarginBs)
        : null;

    const isSafeUsd =
      breakEvenVolume !== null &&
      batchMargin.financials.totalInflow >= breakEvenVolume;
    const isSafeBs =
      breakEvenVolumeBs !== null &&
      batchMargin.financials.totalInflowBs >= breakEvenVolumeBs;

    const breakEvenStatus =
      transactionCount === 0
        ? 'no_sales'
        : ratio <= 0 || ratioBs <= 0
          ? 'negative_margin'
          : isSafeUsd && isSafeBs
            ? 'safe'
            : 'at_risk';

    const dataConfidence = this.getDataConfidence(transactionCount);

    const marginStatus = this.resolveMarginStatus(
      breakEvenStatus,
      isSafeUsd,
      isSafeBs,
      ratio,
      ratioBs,
    );

    return {
      batchId: batch.id,
      itemName: batch.item.name,
      batchQuantity: batch.quantity,
      batchStatus: batch.status,
      companyId,
      period: { startDate: start, endDate: end },
      breakEvenStatus,
      dataConfidence,
      transactionCount,
      financialsActual: {
        dollars: {
          totalInflow: batchMargin.financials.totalInflow,
          totalVariableCosts: batchMargin.financials.totalVariableCost,
          totalFixedCosts: Number(allocatedFixedCosts.toFixed(2)),
          contributionMarginRatio: Number((ratio * 100).toFixed(2)),
          unitPrice: Number(unitPrice.toFixed(2)),
          unitVariableCost: Number(unitVariableCost.toFixed(2)),
          unitContributionMargin: Number(unitContributionMargin.toFixed(2)),
        },
        bs: {
          totalInflowBs: batchMargin.financials.totalInflowBs,
          totalVariableCostsBs: batchMargin.financials.totalVariableCostBs,
          totalFixedCostsBs: Number(allocatedFixedCostsBs.toFixed(2)),
          contributionMarginRatioBs: Number((ratioBs * 100).toFixed(2)),
          unitPriceBs: Number(unitPriceBs.toFixed(2)),
          unitVariableCostBs: Number(unitVariableCostBs.toFixed(2)),
          unitContributionMarginBs: Number(unitContributionMarginBs.toFixed(2)),
        },
      },
      breakEven: {
        salesVolumeRequired:
          breakEvenVolume !== null ? Number(breakEvenVolume.toFixed(2)) : null,
        salesVolumeRequiredBs:
          breakEvenVolumeBs !== null
            ? Number(breakEvenVolumeBs.toFixed(2))
            : null,
        unitsRequired:
          unitsRequired !== null &&
          unitsRequiredBs !== null &&
          unitsRequired === unitsRequiredBs
            ? unitsRequired
            : unitsRequired,
        unitsRequiredBs:
          unitsRequiredBs !== null &&
          unitsRequired !== null &&
          unitsRequired === unitsRequiredBs
            ? undefined
            : unitsRequiredBs,
        isEstimated,
        isSafe:
          breakEvenStatus === 'safe'
            ? true
            : breakEvenStatus === 'no_sales'
              ? null
              : false,
        isSafeUsd,
        isSafeBs,
        distanceToBreakEven:
          breakEvenVolume !== null
            ? Number(
                (batchMargin.financials.totalInflow - breakEvenVolume).toFixed(
                  2,
                ),
              )
            : null,
        distanceToBreakEvenBs:
          breakEvenVolumeBs !== null
            ? Number(
                (
                  batchMargin.financials.totalInflowBs - breakEvenVolumeBs
                ).toFixed(2),
              )
            : null,
        distanceToBreakEvenUnits:
          breakEvenVolume !== null && unitsRequired !== null
            ? batch.quantity - unitsRequired
            : null,
        marginStatus,
        marginStatusUsd:
          ratio <= 0 ? 'negative' : isSafeUsd ? 'safe' : 'at_risk',
        marginStatusBs:
          ratioBs <= 0 ? 'negative' : isSafeBs ? 'safe' : 'at_risk',
      },
    };
  }

  async getServiceBreakEven(
    itemId: string,
    companyId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const item = await this.prisma.item.findUnique({
      where: { id: itemId, companyId, isRemoved: false },
    });

    if (!item)
      throw new NotFoundException('El servicio especificado no existe.');
    if (item.type === 'PRODUCT')
      throw new BadRequestException('El ítem especificado no es un servicio.');

    const transactionCountAgg = await this.prisma.transaction.aggregate({
      _count: { id: true },
      where: {
        itemId,
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: { gte: start, lte: end },
        category: { flowDirection: FlowDirection.INFLOW },
      },
    });
    const transactionCount = transactionCountAgg._count.id;

    const serviceMargin =
      await this.contributionMarginService.getContributionMarginByService(
        itemId,
        companyId,
        startDate,
        endDate,
      );

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

    const totalCompanySalesAgg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true },
      where: {
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: { gte: start, lte: end },
        category: { flowDirection: FlowDirection.INFLOW },
      },
    });

    const totalCompanySales = Number(totalCompanySalesAgg._sum.amountUSD) || 0;
    const totalCompanySalesBs = Number(totalCompanySalesAgg._sum.amountBs) || 0;

    const participation =
      totalCompanySales > 0
        ? serviceMargin.financials.totalInflow / totalCompanySales
        : 0;
    const participationBs =
      totalCompanySalesBs > 0
        ? serviceMargin.financials.totalInflowBs / totalCompanySalesBs
        : 0;

    const allocatedFixedCosts = totalFixedCosts * participation;
    const allocatedFixedCostsBs = totalFixedCostsBs * participationBs;

    let ratio = serviceMargin.financials.contributionMarginRatio;
    let ratioBs =
      serviceMargin.financials.totalInflowBs > 0
        ? (serviceMargin.financials.totalInflowBs -
            serviceMargin.financials.totalVariableCostBs) /
          serviceMargin.financials.totalInflowBs
        : 0;

    let unitPrice = serviceMargin.unitAnalysis.unitInflow;
    let unitPriceBs = serviceMargin.unitAnalysis.unitInflowBs;
    let unitVariableCost = serviceMargin.unitAnalysis.unitVariableCost;
    let unitVariableCostBs = serviceMargin.unitAnalysis.unitVariableCostBs;
    let unitContributionMargin =
      serviceMargin.unitAnalysis.unitContributionMargin;
    let unitContributionMarginBs =
      serviceMargin.unitAnalysis.unitContributionMarginBs;

    let breakEvenVolume = ratio > 0 ? allocatedFixedCosts / ratio : null;
    let breakEvenVolumeBs =
      ratioBs > 0 ? allocatedFixedCostsBs / ratioBs : null;

    let isEstimated = false;

    if (transactionCount === 0 && Number(item.basePrice) > 0) {
      const basePrice = Number(item.basePrice);
      const basePriceBs = basePrice * 7.8;

      unitPrice = basePrice;
      unitPriceBs = basePriceBs;
      unitVariableCost = serviceMargin.unitAnalysis.unitVariableCost || 0;
      unitVariableCostBs = serviceMargin.unitAnalysis.unitVariableCostBs || 0;
      unitContributionMargin = basePrice - unitVariableCost;
      unitContributionMarginBs = basePriceBs - unitVariableCostBs;

      if (unitContributionMargin > 0) {
        ratio = unitContributionMargin / basePrice;
        ratioBs =
          unitContributionMarginBs > 0
            ? unitContributionMarginBs / basePriceBs
            : 0;
        breakEvenVolume = ratio > 0 ? allocatedFixedCosts / ratio : null;
        breakEvenVolumeBs =
          ratioBs > 0 ? allocatedFixedCostsBs / ratioBs : null;
        isEstimated = true;
      }
    }

    const unitsRequired =
      breakEvenVolume !== null && unitContributionMargin > 0
        ? Math.ceil(allocatedFixedCosts / unitContributionMargin)
        : null;
    const unitsRequiredBs =
      breakEvenVolumeBs !== null && unitContributionMarginBs > 0
        ? Math.ceil(allocatedFixedCostsBs / unitContributionMarginBs)
        : null;

    const isSafeUsd =
      breakEvenVolume !== null &&
      serviceMargin.financials.totalInflow >= breakEvenVolume;
    const isSafeBs =
      breakEvenVolumeBs !== null &&
      serviceMargin.financials.totalInflowBs >= breakEvenVolumeBs;

    const breakEvenStatus =
      transactionCount === 0
        ? 'no_sales'
        : ratio <= 0 || ratioBs <= 0
          ? 'negative_margin'
          : isSafeUsd && isSafeBs
            ? 'safe'
            : 'at_risk';

    const dataConfidence = this.getDataConfidence(transactionCount);

    const marginStatus = this.resolveMarginStatus(
      breakEvenStatus,
      isSafeUsd,
      isSafeBs,
      ratio,
      ratioBs,
    );

    return {
      itemId: item.id,
      itemName: item.name,
      itemType: item.type,
      companyId,
      period: { startDate: start, endDate: end },
      breakEvenStatus,
      dataConfidence,
      transactionCount,
      financialsActual: {
        dollars: {
          totalSales: serviceMargin.financials.totalInflow,
          totalVariableCosts: serviceMargin.financials.totalVariableCost,
          totalFixedCosts: Number(allocatedFixedCosts.toFixed(2)),
          contributionMarginRatio: Number((ratio * 100).toFixed(2)),
          unitPrice: Number(unitPrice.toFixed(2)),
          unitVariableCost: Number(unitVariableCost.toFixed(2)),
          unitContributionMargin: Number(unitContributionMargin.toFixed(2)),
        },
        bs: {
          totalSalesBs: serviceMargin.financials.totalInflowBs,
          totalVariableCostsBs: serviceMargin.financials.totalVariableCostBs,
          totalFixedCostsBs: Number(allocatedFixedCostsBs.toFixed(2)),
          contributionMarginRatioBs: Number((ratioBs * 100).toFixed(2)),
          unitPriceBs: Number(unitPriceBs.toFixed(2)),
          unitVariableCostBs: Number(unitVariableCostBs.toFixed(2)),
          unitContributionMarginBs: Number(unitContributionMarginBs.toFixed(2)),
        },
      },
      breakEven: {
        salesVolumeRequired:
          breakEvenVolume !== null ? Number(breakEvenVolume.toFixed(2)) : null,
        salesVolumeRequiredBs:
          breakEvenVolumeBs !== null
            ? Number(breakEvenVolumeBs.toFixed(2))
            : null,
        unitsRequired:
          unitsRequired !== null &&
          unitsRequiredBs !== null &&
          unitsRequired === unitsRequiredBs
            ? unitsRequired
            : unitsRequired,
        unitsRequiredBs:
          unitsRequiredBs !== null &&
          unitsRequired !== null &&
          unitsRequired === unitsRequiredBs
            ? undefined
            : unitsRequiredBs,
        isEstimated,
        isSafe:
          breakEvenStatus === 'safe'
            ? true
            : breakEvenStatus === 'no_sales'
              ? null
              : false,
        isSafeUsd,
        isSafeBs,
        distanceToBreakEven:
          breakEvenVolume !== null
            ? Number(
                (
                  serviceMargin.financials.totalInflow - breakEvenVolume
                ).toFixed(2),
              )
            : null,
        distanceToBreakEvenBs:
          breakEvenVolumeBs !== null
            ? Number(
                (
                  serviceMargin.financials.totalInflowBs - breakEvenVolumeBs
                ).toFixed(2),
              )
            : null,
        distanceToBreakEvenUnits:
          breakEvenVolume !== null && unitsRequired !== null
            ? serviceMargin.totalServicesSold - unitsRequired
            : null,
        marginStatus,
        marginStatusUsd:
          ratio <= 0 ? 'negative' : isSafeUsd ? 'safe' : 'at_risk',
        marginStatusBs:
          ratioBs <= 0 ? 'negative' : isSafeBs ? 'safe' : 'at_risk',
      },
    };
  }
}
