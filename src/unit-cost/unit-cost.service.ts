import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { TransactionStatus, FlowDirection, ItemType } from '@prisma/client';

interface ChartDataPoint {
  period: string;
  unitCostUSD: number;
  unitCostBs: number;
  totalCostUSD: number;
  totalCostBs: number;
  quantity: number;
}

interface ProductUnitCostResponse {
  itemId: string;
  itemName: string;
  totalSold: number;
  totalCostUSD: number;
  totalCostBs: number;
  avgUnitCostUSD: number;
  avgUnitCostBs: number;
  chartData: ChartDataPoint[];
  isValid: boolean;
}

interface ServiceUnitCostResponse {
  itemId: string;
  itemName: string;
  totalServicesSold: number;
  totalCostUSD: number;
  totalCostBs: number;
  avgUnitCostUSD: number;
  avgUnitCostBs: number;
  chartData: ChartDataPoint[];
  isValid: boolean;
}

@Injectable()
export class UnitCostService {
  constructor(private prisma: PrismaService) {}

  async getBatchUnitCost(batchId: string, companyId: string) {
    const batch = await this.prisma.productionBatch.findUnique({
      where: { id: batchId, companyId, isRemoved: false },
      include: { item: true },
    });

    if (!batch) {
      throw new NotFoundException('Production batch not found.');
    }

    const outflowAgg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true },
      where: {
        batchId,
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        category: { flowDirection: FlowDirection.OUTFLOW },
      },
    });

    const totalCostUSD = Number(outflowAgg._sum.amountUSD) || 0;
    const totalCostBs = Number(outflowAgg._sum.amountBs) || 0;
    const quantity = batch.quantity;

    return {
      batchId: batch.id,
      itemId: batch.itemId,
      itemName: batch.item.name,
      batchStatus: batch.status,
      quantity,
      totalCostUSD: Number(totalCostUSD.toFixed(2)),
      totalCostBs: Number(totalCostBs.toFixed(2)),
      unitCostUSD:
        quantity > 0 ? Number((totalCostUSD / quantity).toFixed(2)) : 0,
      unitCostBs:
        quantity > 0 ? Number((totalCostBs / quantity).toFixed(2)) : 0,
    };
  }

  async getProductUnitCost(
    itemId: string,
    companyId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const item = await this.prisma.item.findUnique({
      where: { id: itemId, companyId, isRemoved: false },
    });

    if (!item) throw new NotFoundException('Product not found.');
    if (item.type === ItemType.SERVICE)
      throw new BadRequestException('The specified item is a service.');

    const dateFilter = startDate && endDate
      ? { paymentDate: { gte: new Date(startDate), lte: new Date(endDate) } }
      : {};

    const outflowAgg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true },
      where: {
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        category: { flowDirection: FlowDirection.OUTFLOW },
        OR: [{ itemId }, { costItemId: itemId }],
        ...dateFilter,
      },
    });

    const inflowAgg = await this.prisma.transaction.aggregate({
      _sum: { quantity: true },
      where: {
        itemId,
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        category: { flowDirection: FlowDirection.INFLOW },
        ...dateFilter,
      },
    });

    const totalCostUSD = Number(outflowAgg._sum.amountUSD) || 0;
    const totalCostBs = Number(outflowAgg._sum.amountBs) || 0;
    const totalSold = Number(inflowAgg._sum.quantity) || 0;

    return {
      itemId: item.id,
      itemName: item.name,
      totalSold,
      totalCostUSD: Number(totalCostUSD.toFixed(2)),
      totalCostBs: Number(totalCostBs.toFixed(2)),
      avgUnitCostUSD:
        totalSold > 0 ? Number((totalCostUSD / totalSold).toFixed(2)) : 0,
      avgUnitCostBs:
        totalSold > 0 ? Number((totalCostBs / totalSold).toFixed(2)) : 0,
    };
  }

  async getProductUnitCostWithDateRange(
    itemId: string,
    companyId: string,
    startDate: string,
    endDate: string,
  ): Promise<ProductUnitCostResponse> {
    const current = await this.getProductUnitCost(itemId, companyId, startDate, endDate);
    const { chartData, isValid } = await this.getProductChartData(
      itemId,
      companyId,
      startDate,
      endDate,
    );

    return {
      ...current,
      chartData,
      isValid,
    };
  }

  async getServiceUnitCost(
    itemId: string,
    companyId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const item = await this.prisma.item.findUnique({
      where: { id: itemId, companyId, isRemoved: false },
    });

    if (!item) throw new NotFoundException('Service not found.');
    if (item.type === ItemType.PRODUCT)
      throw new BadRequestException('The specified item is not a service.');

    const dateFilter = startDate && endDate
      ? { paymentDate: { gte: new Date(startDate), lte: new Date(endDate) } }
      : {};

    const outflowAgg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true },
      where: {
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        category: { flowDirection: FlowDirection.OUTFLOW },
        OR: [{ itemId }, { costItemId: itemId }],
        ...dateFilter,
      },
    });

    const inflowAgg = await this.prisma.transaction.aggregate({
      _sum: { quantity: true },
      where: {
        itemId,
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        category: { flowDirection: FlowDirection.INFLOW },
        ...dateFilter,
      },
    });

    const totalCostUSD = Number(outflowAgg._sum.amountUSD) || 0;
    const totalCostBs = Number(outflowAgg._sum.amountBs) || 0;
    const totalServicesSold = Number(inflowAgg._sum.quantity) || 0;

    return {
      itemId: item.id,
      itemName: item.name,
      totalServicesSold,
      totalCostUSD: Number(totalCostUSD.toFixed(2)),
      totalCostBs: Number(totalCostBs.toFixed(2)),
      avgUnitCostUSD:
        totalServicesSold > 0
          ? Number((totalCostUSD / totalServicesSold).toFixed(2))
          : 0,
      avgUnitCostBs:
        totalServicesSold > 0
          ? Number((totalCostBs / totalServicesSold).toFixed(2))
          : 0,
    };
  }

  async getServiceUnitCostWithDateRange(
    itemId: string,
    companyId: string,
    startDate: string,
    endDate: string,
  ): Promise<ServiceUnitCostResponse> {
    const current = await this.getServiceUnitCost(itemId, companyId, startDate, endDate);
    const { chartData, isValid } = await this.getServiceChartData(
      itemId,
      companyId,
      startDate,
      endDate,
    );

    return {
      ...current,
      chartData,
      isValid,
    };
  }

  private getGranularity(start: Date, end: Date): 'week' | 'month' | 'invalid' {
    const diffTime = end.getTime() - start.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    const diffMonths = diffDays / 30.44;
    const diffYears = diffDays / 365.25;

    if (diffYears > 2) return 'invalid';
    if (diffMonths <= 3) return 'week';
    return 'month';
  }

  private getPeriodStart(date: Date, granularity: 'week' | 'month'): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    if (granularity === 'month') {
      d.setDate(1);
    } else {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
    }
    return d;
  }

  private formatPeriod(date: Date, granularity: 'week' | 'month'): string {
    const d = new Date(date);
    if (granularity === 'month') {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    return d.toISOString().split('T')[0];
  }

  private async getProductChartData(
    itemId: string,
    companyId: string,
    startDate: string,
    endDate: string,
  ): Promise<{ chartData: ChartDataPoint[]; isValid: boolean }> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const granularity = this.getGranularity(start, end);

    if (granularity === 'invalid') {
      return { chartData: [], isValid: false };
    }

    const transactions = await this.prisma.transaction.findMany({
      where: {
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: { gte: start, lte: end },
        OR: [{ itemId }, { costItemId: itemId }],
      },
      include: { category: true },
      orderBy: { paymentDate: 'asc' },
    });

    const periodMap = new Map<
      string,
      { totalCostUSD: number; totalCostBs: number; quantity: number }
    >();

    for (const t of transactions) {
      const date = t.paymentDate ?? t.createdAt;
      const periodStart = this.getPeriodStart(date, granularity);
      const periodKey = this.formatPeriod(periodStart, granularity);

      const entry = periodMap.get(periodKey) ?? {
        totalCostUSD: 0,
        totalCostBs: 0,
        quantity: 0,
      };

      const amountUSD = Number(t.amountUSD);
      const amountBs = Number(t.amountBs);
      const qty = Number(t.quantity) || 0;

      // For OUTFLOW via costItemId, the quantity is on the cost item (raw material),
      // not on the finished product. Only count INFLOW quantity for the product itself.
      const isCostItemOutflow =
        t.category.flowDirection === FlowDirection.OUTFLOW &&
        t.costItemId === itemId;

      if (t.category.flowDirection === FlowDirection.OUTFLOW) {
        entry.totalCostUSD += amountUSD;
        entry.totalCostBs += amountBs;
      } else if (
        t.category.flowDirection === FlowDirection.INFLOW &&
        !isCostItemOutflow
      ) {
        entry.quantity += qty;
      }

      periodMap.set(periodKey, entry);
    }

    const chartData: ChartDataPoint[] = [];
    const cursor = this.getPeriodStart(start, granularity);
    const endPeriod = this.getPeriodStart(end, granularity);

    while (cursor <= endPeriod) {
      const periodKey = this.formatPeriod(cursor, granularity);
      const data = periodMap.get(periodKey) ?? {
        totalCostUSD: 0,
        totalCostBs: 0,
        quantity: 0,
      };

      const unitCostUSD =
        data.quantity > 0
          ? Number((data.totalCostUSD / data.quantity).toFixed(2))
          : 0;
      const unitCostBs =
        data.quantity > 0
          ? Number((data.totalCostBs / data.quantity).toFixed(2))
          : 0;

      chartData.push({
        period: periodKey,
        unitCostUSD,
        unitCostBs,
        totalCostUSD: Number(data.totalCostUSD.toFixed(2)),
        totalCostBs: Number(data.totalCostBs.toFixed(2)),
        quantity: data.quantity,
      });

      if (granularity === 'month') {
        cursor.setMonth(cursor.getMonth() + 1);
      } else {
        cursor.setDate(cursor.getDate() + 7);
      }
    }

    return { chartData, isValid: true };
  }

  private async getServiceChartData(
    itemId: string,
    companyId: string,
    startDate: string,
    endDate: string,
  ): Promise<{ chartData: ChartDataPoint[]; isValid: boolean }> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const granularity = this.getGranularity(start, end);

    if (granularity === 'invalid') {
      return { chartData: [], isValid: false };
    }

    const transactions = await this.prisma.transaction.findMany({
      where: {
        itemId,
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: { gte: start, lte: end },
      },
      include: { category: true },
      orderBy: { paymentDate: 'asc' },
    });

    const periodMap = new Map<
      string,
      { totalCostUSD: number; totalCostBs: number; quantity: number }
    >();

    for (const t of transactions) {
      const date = t.paymentDate ?? t.createdAt;
      const periodStart = this.getPeriodStart(date, granularity);
      const periodKey = this.formatPeriod(periodStart, granularity);

      const entry = periodMap.get(periodKey) ?? {
        totalCostUSD: 0,
        totalCostBs: 0,
        quantity: 0,
      };

      const amountUSD = Number(t.amountUSD);
      const amountBs = Number(t.amountBs);
      const qty = Number(t.quantity) || 0;

      if (t.category.flowDirection === FlowDirection.OUTFLOW) {
        entry.totalCostUSD += amountUSD;
        entry.totalCostBs += amountBs;
      } else if (t.category.flowDirection === FlowDirection.INFLOW) {
        entry.quantity += qty;
      }

      periodMap.set(periodKey, entry);
    }

    const chartData: ChartDataPoint[] = [];
    const cursor = this.getPeriodStart(start, granularity);
    const endPeriod = this.getPeriodStart(end, granularity);

    while (cursor <= endPeriod) {
      const periodKey = this.formatPeriod(cursor, granularity);
      const data = periodMap.get(periodKey) ?? {
        totalCostUSD: 0,
        totalCostBs: 0,
        quantity: 0,
      };

      const unitCostUSD =
        data.quantity > 0
          ? Number((data.totalCostUSD / data.quantity).toFixed(2))
          : 0;
      const unitCostBs =
        data.quantity > 0
          ? Number((data.totalCostBs / data.quantity).toFixed(2))
          : 0;

      chartData.push({
        period: periodKey,
        unitCostUSD,
        unitCostBs,
        totalCostUSD: Number(data.totalCostUSD.toFixed(2)),
        totalCostBs: Number(data.totalCostBs.toFixed(2)),
        quantity: data.quantity,
      });

      if (granularity === 'month') {
        cursor.setMonth(cursor.getMonth() + 1);
      } else {
        cursor.setDate(cursor.getDate() + 7);
      }
    }

    return { chartData, isValid: true };
  }
}
