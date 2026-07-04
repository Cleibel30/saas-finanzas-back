import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  TransactionStatus,
  FlowDirection,
  BatchStatus,
  ItemType,
} from '@prisma/client';

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
      unitCostUSD: quantity > 0 ? Number((totalCostUSD / quantity).toFixed(2)) : 0,
      unitCostBs: quantity > 0 ? Number((totalCostBs / quantity).toFixed(2)) : 0,
    };
  }

  async getProductUnitCost(itemId: string, companyId: string) {
    const item = await this.prisma.item.findUnique({
      where: { id: itemId, companyId, isRemoved: false },
    });

    if (!item) throw new NotFoundException('Product not found.');
    if (item.type === ItemType.SERVICE) throw new BadRequestException('The specified item is a service.');

    const closedBatches = await this.prisma.productionBatch.findMany({
      where: {
        itemId,
        companyId,
        status: BatchStatus.CLOSED,
        isRemoved: false,
      },
      include: { transactions: true },
    });

    if (closedBatches.length === 0) {
      return {
        itemId: item.id,
        itemName: item.name,
        totalBatches: 0,
        totalQuantity: 0,
        totalCostUSD: 0,
        totalCostBs: 0,
        weightedAvgUnitCostUSD: 0,
        weightedAvgUnitCostBs: 0,
      };
    }

    let totalQuantity = 0;
    let totalCostUSD = 0;
    let totalCostBs = 0;

    for (const batch of closedBatches) {
      const outflowAgg = await this.prisma.transaction.aggregate({
        _sum: { amountUSD: true, amountBs: true },
        where: {
          batchId: batch.id,
          status: TransactionStatus.COMPLETED,
          isRemoved: false,
          category: { flowDirection: FlowDirection.OUTFLOW },
        },
      });

      const batchCostUSD = Number(outflowAgg._sum.amountUSD) || 0;
      const batchCostBs = Number(outflowAgg._sum.amountBs) || 0;

      totalQuantity += batch.quantity;
      totalCostUSD += batchCostUSD;
      totalCostBs += batchCostBs;
    }

    return {
      itemId: item.id,
      itemName: item.name,
      totalBatches: closedBatches.length,
      totalQuantity,
      totalCostUSD: Number(totalCostUSD.toFixed(2)),
      totalCostBs: Number(totalCostBs.toFixed(2)),
      weightedAvgUnitCostUSD: totalQuantity > 0 ? Number((totalCostUSD / totalQuantity).toFixed(2)) : 0,
      weightedAvgUnitCostBs: totalQuantity > 0 ? Number((totalCostBs / totalQuantity).toFixed(2)) : 0,
    };
  }

  async getServiceUnitCost(itemId: string, companyId: string) {
    const item = await this.prisma.item.findUnique({
      where: { id: itemId, companyId, isRemoved: false },
    });

    if (!item) throw new NotFoundException('Service not found.');
    if (item.type === ItemType.PRODUCT)
      throw new BadRequestException('The specified item is not a service.');

    const outflowAgg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true },
      where: {
        itemId,
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        category: { flowDirection: FlowDirection.OUTFLOW },
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
}
