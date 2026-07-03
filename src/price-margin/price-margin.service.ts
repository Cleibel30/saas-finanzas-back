import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UnitCostService } from '@/unit-cost/unit-cost.service';
import { ItemType } from '@prisma/client';

@Injectable()
export class PriceMarginService {
  constructor(
    private prisma: PrismaService,
    private readonly unitCostService: UnitCostService,
  ) {}

  async calculateMarginTarget(
    itemId: string,
    companyId: string,
    targetMarginPercent: number,
  ) {
    const item = await this.prisma.item.findUnique({
      where: { id: itemId, companyId, isRemoved: false },
    });

    if (!item) throw new BadRequestException('Item not found.');

    if (targetMarginPercent >= 100) {
      throw new BadRequestException('Target margin must be less than 100%.');
    }

    let costUSD: number;
    let costBs: number;
    let itemName: string;

    if (item.type === ItemType.PRODUCT) {
      const unitCost = await this.unitCostService.getProductUnitCost(
        itemId,
        companyId,
      );
      if (unitCost.totalBatches === 0) {
        throw new BadRequestException(
          'No closed batches found for this product. Cannot calculate unit cost.',
        );
      }
      costUSD = unitCost.weightedAvgUnitCostUSD;
      costBs = unitCost.weightedAvgUnitCostBs;
      itemName = unitCost.itemName;
    } else {
      const unitCost = await this.unitCostService.getServiceUnitCost(
        itemId,
        companyId,
      );
      if (unitCost.totalServicesSold === 0) {
        throw new BadRequestException(
          'No services sold found for this item. Cannot calculate unit cost.',
        );
      }
      costUSD = unitCost.avgUnitCostUSD;
      costBs = unitCost.avgUnitCostBs;
      itemName = unitCost.itemName;
    }

    const marginDecimal = targetMarginPercent / 100;

    const priceFromMarginUSD = costUSD / (1 - marginDecimal);
    const priceFromMarginBs = costBs / (1 - marginDecimal);

    const priceFromMarkupUSD = costUSD * (1 + marginDecimal);
    const priceFromMarkupBs = costBs * (1 + marginDecimal);

    const grossMarginUSD = priceFromMarginUSD - costUSD;
    const grossMarginBs = priceFromMarginBs - costBs;

    return {
      itemId,
      itemName,
      itemType: item.type,
      unitCostUSD: Number(costUSD.toFixed(2)),
      unitCostBs: Number(costBs.toFixed(2)),
      targetMarginPercent,
      marginMethod: {
        priceUSD: Number(priceFromMarginUSD.toFixed(2)),
        priceBs: Number(priceFromMarginBs.toFixed(2)),
        grossMarginUSD: Number(grossMarginUSD.toFixed(2)),
        grossMarginBs: Number(grossMarginBs.toFixed(2)),
        description: `Selling price to achieve ${targetMarginPercent}% margin on sale price`,
      },
      markupMethod: {
        priceUSD: Number(priceFromMarkupUSD.toFixed(2)),
        priceBs: Number(priceFromMarkupBs.toFixed(2)),
        description: `Selling price with ${targetMarginPercent}% markup on cost`,
      },
    };
  }
}
