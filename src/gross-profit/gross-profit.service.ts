import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { TransactionStatus, FlowDirection, ItemType } from '@prisma/client';

@Injectable()
export class GrossProfitService {
  constructor(private prisma: PrismaService) {}

  private normalizeDateRange(startDate: Date, endDate: Date) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  async getGlobalGrossProfit(
    companyId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const { start, end } = this.normalizeDateRange(startDate, endDate);

    const salesAgg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true },
      where: {
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: { gte: start, lte: end },
        category: { flowDirection: FlowDirection.INFLOW },
      },
    });

    const cogsAgg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true },
      where: {
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: { gte: start, lte: end },
        category: { flowDirection: FlowDirection.OUTFLOW, isCogs: true },
      },
    });

    const netSales = Number(salesAgg._sum.amountUSD) || 0;
    const netSalesBs = Number(salesAgg._sum.amountBs) || 0;
    const cogs = Number(cogsAgg._sum.amountUSD) || 0;
    const cogsBs = Number(cogsAgg._sum.amountBs) || 0;
    const grossProfit = netSales - cogs;
    const grossProfitBs = netSalesBs - cogsBs;
    const grossMarginRatio = netSales > 0 ? grossProfit / netSales : 0;

    return {
      netSales,
      netSalesBs,
      cogs,
      cogsBs,
      grossProfit,
      grossProfitBs,
      grossMarginRatio: Number(grossMarginRatio.toFixed(2)),
    };
  }

  async getProductGrossProfit(
    itemId: string,
    companyId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const item = await this.prisma.item.findUnique({
      where: { id: itemId, companyId, isRemoved: false },
    });

    if (!item) throw new NotFoundException('Product not found.');
    if (item.type === ItemType.SERVICE)
      throw new BadRequestException('The specified item is a service.');

    const { start, end } = this.normalizeDateRange(startDate, endDate);

    const salesAgg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true, quantity: true },
      where: {
        itemId,
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: { gte: start, lte: end },
        category: { flowDirection: FlowDirection.INFLOW },
      },
    });

    const cogsAgg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true, quantity: true },
      where: {
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: { gte: start, lte: end },
        category: { flowDirection: FlowDirection.OUTFLOW, isCogs: true },
        OR: [{ itemId }, { costItemId: itemId }],
      },
    });

    const netSales = Number(salesAgg._sum.amountUSD) || 0;
    const netSalesBs = Number(salesAgg._sum.amountBs) || 0;
    const totalUnitsSold = Number(salesAgg._sum.quantity) || 0;
    const cogs = Number(cogsAgg._sum.amountUSD) || 0;
    const cogsBs = Number(cogsAgg._sum.amountBs) || 0;
    const grossProfit = netSales - cogs;
    const grossProfitBs = netSalesBs - cogsBs;
    const grossMarginRatio = netSales > 0 ? grossProfit / netSales : 0;

    const avgUnitPrice = totalUnitsSold > 0 ? netSales / totalUnitsSold : 0;
    const avgUnitCogs = totalUnitsSold > 0 ? cogs / totalUnitsSold : 0;

    return {
      itemId: item.id,
      itemName: item.name,
      totalUnitsSold,
      netSales,
      netSalesBs,
      cogs,
      cogsBs,
      grossProfit,
      grossProfitBs,
      grossMarginRatio: Number(grossMarginRatio.toFixed(2)),
      unitAnalysis: {
        avgUnitPrice: Number(avgUnitPrice.toFixed(2)),
        avgUnitCogs: Number(avgUnitCogs.toFixed(2)),
        unitGrossProfit: Number((avgUnitPrice - avgUnitCogs).toFixed(2)),
      },
    };
  }

  async getServiceGrossProfit(
    itemId: string,
    companyId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const item = await this.prisma.item.findUnique({
      where: { id: itemId, companyId, isRemoved: false },
    });

    if (!item) throw new NotFoundException('Service not found.');
    if (item.type === ItemType.PRODUCT)
      throw new BadRequestException('The specified item is not a service.');

    const { start, end } = this.normalizeDateRange(startDate, endDate);

    const salesAgg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true, quantity: true },
      where: {
        itemId,
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: { gte: start, lte: end },
        category: { flowDirection: FlowDirection.INFLOW },
      },
    });

    const cogsAgg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true },
      where: {
        itemId,
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: { gte: start, lte: end },
        category: { flowDirection: FlowDirection.OUTFLOW, isCogs: true },
      },
    });

    const netSales = Number(salesAgg._sum.amountUSD) || 0;
    const netSalesBs = Number(salesAgg._sum.amountBs) || 0;
    const totalServicesSold = Number(salesAgg._sum.quantity) || 0;
    const cogs = Number(cogsAgg._sum.amountUSD) || 0;
    const cogsBs = Number(cogsAgg._sum.amountBs) || 0;
    const grossProfit = netSales - cogs;
    const grossProfitBs = netSalesBs - cogsBs;
    const grossMarginRatio = netSales > 0 ? grossProfit / netSales : 0;

    const avgUnitPrice =
      totalServicesSold > 0 ? netSales / totalServicesSold : 0;
    const avgUnitCogs = totalServicesSold > 0 ? cogs / totalServicesSold : 0;

    return {
      itemId: item.id,
      itemName: item.name,
      totalServicesSold,
      netSales,
      netSalesBs,
      cogs,
      cogsBs,
      grossProfit,
      grossProfitBs,
      grossMarginRatio: Number(grossMarginRatio.toFixed(2)),
      unitAnalysis: {
        avgUnitPrice: Number(avgUnitPrice.toFixed(2)),
        avgUnitCogs: Number(avgUnitCogs.toFixed(2)),
        unitGrossProfit: Number((avgUnitPrice - avgUnitCogs).toFixed(2)),
      },
    };
  }

  async getBatchGrossProfit(batchId: string, companyId: string) {
    const batch = await this.prisma.productionBatch.findUnique({
      where: { id: batchId, isRemoved: false, companyId },
      include: { item: true },
    });

    if (!batch) throw new NotFoundException('Production batch not found.');

    const salesAgg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true, quantity: true },
      where: {
        batchId,
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        category: { flowDirection: FlowDirection.INFLOW },
      },
    });

    const cogsAgg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true },
      where: {
        batchId,
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        category: { flowDirection: FlowDirection.OUTFLOW, isCogs: true },
      },
    });

    const netSales = Number(salesAgg._sum.amountUSD) || 0;
    const netSalesBs = Number(salesAgg._sum.amountBs) || 0;
    const totalUnitsSold = Number(salesAgg._sum.quantity) || 0;
    const cogs = Number(cogsAgg._sum.amountUSD) || 0;
    const cogsBs = Number(cogsAgg._sum.amountBs) || 0;
    const grossProfit = netSales - cogs;
    const grossProfitBs = netSalesBs - cogsBs;
    const grossMarginRatio = netSales > 0 ? grossProfit / netSales : 0;

    const avgUnitPrice = totalUnitsSold > 0 ? netSales / totalUnitsSold : 0;
    const avgUnitCogs = totalUnitsSold > 0 ? cogs / totalUnitsSold : 0;

    return {
      batchId: batch.id,
      itemName: batch.item.name,
      batchQuantity: batch.quantity,
      batchStatus: batch.status,
      netSales,
      netSalesBs,
      cogs,
      cogsBs,
      grossProfit,
      grossProfitBs,
      grossMarginRatio: Number(grossMarginRatio.toFixed(2)),
      unitAnalysis: {
        avgUnitPrice: Number(avgUnitPrice.toFixed(2)),
        avgUnitCogs: Number(avgUnitCogs.toFixed(2)),
        unitGrossProfit: Number((avgUnitPrice - avgUnitCogs).toFixed(2)),
      },
    };
  }
}
