import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
} from './dto/transaction.dto';
import {
  Category,
  Currency,
  FlowDirection,
  Item,
  Prisma,
  StockEffect,
} from '@prisma/client';
type DbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class TransactionService {
  constructor(private prisma: PrismaService) {}

  async assertCategoryForCompany(
    db: DbClient,
    categoryId: string,
    companyId: string,
  ): Promise<Category> {
    const category = await db.category.findUnique({
      where: { id: categoryId, isRemoved: false },
    });

    if (!category) {
      throw new NotFoundException(
        `La categoría con ID ${categoryId} no existe.`,
      );
    }

    if (category.companyId !== companyId && !category.isDefault) {
      throw new UnauthorizedException(
        'La categoría no pertenece a la empresa.',
      );
    }

    return category;
  }

  async assertItemForCompany(
    db: DbClient,
    itemId: string,
    companyId: string,
  ): Promise<Item> {
    const item = await db.item.findUnique({
      where: { id: itemId, companyId, isRemoved: false },
    });

    if (!item) {
      throw new BadRequestException(`El ítem con ID ${itemId} no existe.`);
    }

    return item;
  }

  async assertBatchForCompany(
    db: DbClient,
    batchId: string,
    companyId: string,
  ): Promise<void> {
    const batch = await db.productionBatch.findUnique({
      where: { id: batchId, companyId, isRemoved: false },
    });

    if (!batch) {
      throw new BadRequestException(`El lote con ID ${batchId} no existe.`);
    }
  }

  calculateAmounts(amount: number, currency: Currency, dollarRate: number) {
    if (currency === Currency.DOLARES) {
      return {
        amountUSD: amount,
        amountBs: amount * dollarRate,
      };
    }
    return {
      amountUSD: dollarRate > 0 ? amount / dollarRate : 0,
      amountBs: amount,
    };
  }

  async createTransactions(data: CreateTransactionDto[], companyId: string) {
    const categoryIds = [...new Set(data.map((t) => t.categoryId))];
    const itemIds = [
      ...new Set(data.filter((t) => t.itemId).map((t) => t.itemId!)),
    ];
    const batchIds = [
      ...new Set(data.filter((t) => t.batchId).map((t) => t.batchId!)),
    ];
    const costItemIds = [
      ...new Set(data.filter((t) => t.costItemId).map((t) => t.costItemId!)),
    ];

    return await this.prisma.$transaction(async (tx) => {
      // 1. Obtención de datos (secuencial para evitar colisión de conexiones en pg)
      const categories = await tx.category.findMany({
        where: { id: { in: categoryIds }, isRemoved: false },
      });
      const allItemIds = [...new Set([...itemIds, ...costItemIds])];
      const items =
        allItemIds.length > 0
          ? await tx.item.findMany({
              where: { id: { in: allItemIds }, companyId, isRemoved: false },
            })
          : [];
      const batches =
        batchIds.length > 0
          ? await tx.productionBatch.findMany({
              where: { id: { in: batchIds }, companyId, isRemoved: false },
            })
          : [];

      const categoryMap = new Map(categories.map((c) => [c.id, c]));
      const itemMap = new Map(items.map((i) => [i.id, i]));
      const batchSet = new Set(batches.map((b) => b.id));

      // 2. Acumular cambios de stock según stockEffect
      const stockDelta: Record<string, number> = {};

      for (const t of data) {
        const category = categoryMap.get(t.categoryId);
        if (!category)
          throw new NotFoundException(
            `Categoría ${t.categoryId} no encontrada.`,
          );

        if (t.costItemId && !itemMap.has(t.costItemId))
          throw new BadRequestException(
            `El ítem (costItemId) ${t.costItemId} no existe.`,
          );

        if (
          t.itemId &&
          t.stockEffect &&
          t.stockEffect !== 'NONE' &&
          t.quantity
        ) {
          const item = itemMap.get(t.itemId);
          if (!item)
            throw new BadRequestException(`El ítem ${t.itemId} no existe.`);

          if (item.type !== 'PRODUCT') continue;

          const delta =
            t.stockEffect === 'INCREMENT' ? t.quantity : -t.quantity;
          stockDelta[t.itemId] = (stockDelta[t.itemId] ?? 0) + delta;
        }

        if (t.costItemId && t.stockEffect === 'INCREMENT' && t.quantity) {
          const item = itemMap.get(t.costItemId);
          if (!item)
            throw new BadRequestException(
              `El ítem (costItemId) ${t.costItemId} no existe.`,
            );

          if (item.type !== 'PRODUCT') continue;

          stockDelta[t.costItemId] =
            (stockDelta[t.costItemId] ?? 0) + t.quantity;
        }
      }

      // 3. SECUENCIAL: Validar stock suficiente y aplicar cambios
      for (const [itemId, delta] of Object.entries(stockDelta)) {
        if (delta === 0) continue;

        const item = itemMap.get(itemId)!;

        if (delta < 0 && item.stockCurrent < Math.abs(delta)) {
          throw new BadRequestException(
            `Stock insuficiente para el producto ${item.name}. Disponible: ${item.stockCurrent}, Requerido: ${Math.abs(delta)}`,
          );
        }

        await tx.item.update({
          where: { id: itemId },
          data: { stockCurrent: { increment: delta } },
        });
      }

      // 4. SECUENCIAL: Creación de registros de transacciones
      const results = [];
      let deltaUSD = 0;
      let deltaBs = 0;

      for (const t of data) {
        const transaction = await tx.transaction.create({
          data: {
            categoryId: t.categoryId,
            itemId: t.itemId,
            batchId: t.batchId,
            costItemId: t.costItemId,
            quantity: t.quantity,
            unitPrice: t.unitPrice,
            amountUSD: t.amountUSD,
            amountBs: t.amountBs,
            status: t.status,
            paymentMethod: t.paymentMethod,
            currency: t.currency,
            paymentReference: t.paymentReference,
            description: t.description,
            stockEffect: t.stockEffect ?? 'NONE',
            paymentDate: t.paymentDate ? new Date(t.paymentDate) : null,
            companyId,
            dollarRate: t.dollarRate,
          },
        });
        results.push(transaction);

        if (t.status === 'COMPLETED') {
          const category = categoryMap.get(t.categoryId)!;
          const sign = category.flowDirection === FlowDirection.INFLOW ? 1 : -1;
          deltaUSD += sign * t.amountUSD;
          deltaBs += sign * t.amountBs;
        }
      }

      if (deltaUSD !== 0 || deltaBs !== 0) {
        await tx.company.update({
          where: { id: companyId },
          data: {
            cashBalanceUSD: { increment: deltaUSD },
            cashBalanceBs: { increment: deltaBs },
          },
        });
      }

      return results;
    });
  }

  async getTransactionsByCompany(companyId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where = { companyId, isRemoved: false };

    const data = await this.prisma.transaction.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      include: {
        category: true,
        item: true,
        batch: { include: { item: true } },
        costItem: true,
      },
      skip,
      take: limit,
    });

    const total = await this.prisma.transaction.count({ where });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTransactionById(id: string, companyId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, companyId, isRemoved: false },
      include: {
        category: true,
        item: true,
        batch: { include: { item: true } },
        costItem: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException(`La transacción con ID ${id} no existe.`);
    }

    return transaction;
  }

  async updateTransaction(
    id: string,
    companyId: string,
    data: UpdateTransactionDto,
  ) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, companyId, isRemoved: false },
      include: { category: true },
    });
    if (!transaction) {
      throw new NotFoundException(`La transacción con ID ${id} no existe.`);
    }

    const oldSign =
      transaction.category.flowDirection === FlowDirection.INFLOW ? 1 : -1;
    const wasCompleted = transaction.status === 'COMPLETED';

    return await this.prisma.$transaction(async (tx) => {
      if (data.categoryId) {
        await this.assertCategoryForCompany(tx, data.categoryId, companyId);
      }

      if (data.itemId) {
        await this.assertItemForCompany(tx, data.itemId, companyId);
      }

      if (data.batchId) {
        await this.assertBatchForCompany(tx, data.batchId, companyId);
      }

      if (data.costItemId) {
        await this.assertItemForCompany(tx, data.costItemId, companyId);
      }

      if (data.amount !== undefined && (!data.currency || !data.dollarRate)) {
        throw new BadRequestException(
          'Para actualizar el monto, debe proporcionar también currency y dollarRate.',
        );
      }

      // --- Stock reversal logic ---
      const toDelta = (
        itemId: string | null | undefined,
        qty: number | null | undefined,
        effect: string | null | undefined,
      ): number => {
        if (!itemId || !effect || effect === StockEffect.NONE) return 0;
        const q = qty ?? 0;
        return effect === StockEffect.INCREMENT ? q : -q;
      };

      const oldItemId = transaction.itemId;
      const oldQuantity = transaction.quantity ?? 0;
      const oldStockEffect = transaction.stockEffect ?? StockEffect.NONE;
      const oldDelta = toDelta(oldItemId, oldQuantity, oldStockEffect);

      const newItemId = data.itemId !== undefined ? data.itemId : oldItemId;
      const newQuantity =
        data.quantity !== undefined ? data.quantity : oldQuantity;
      const newStockEffect =
        data.stockEffect !== undefined ? data.stockEffect : oldStockEffect;
      const newDelta = toDelta(newItemId, newQuantity, newStockEffect);

      const oldCostItemId = transaction.costItemId;
      const oldCostItemDelta = toDelta(
        oldCostItemId,
        oldQuantity,
        oldStockEffect,
      );
      const newCostItemId =
        data.costItemId !== undefined ? data.costItemId : oldCostItemId;
      const newCostItemDelta = toDelta(
        newCostItemId,
        newQuantity,
        newStockEffect,
      );

      const stockChanged =
        data.itemId !== undefined ||
        data.quantity !== undefined ||
        data.stockEffect !== undefined;

      if (stockChanged) {
        if (oldItemId && newItemId && oldItemId === newItemId) {
          const netDelta = newDelta - oldDelta;
          if (netDelta !== 0) {
            if (netDelta < 0) {
              const item = await tx.item.findUnique({
                where: { id: newItemId, companyId, isRemoved: false },
                select: { stockCurrent: true, name: true },
              });
              if (!item)
                throw new BadRequestException(
                  `El ítem ${newItemId} no existe.`,
                );
              if (item.stockCurrent < Math.abs(netDelta)) {
                throw new BadRequestException(
                  `Stock insuficiente para el producto ${item.name}. Disponible: ${item.stockCurrent}, Requerido: ${Math.abs(netDelta)}`,
                );
              }
            }
            await tx.item.update({
              where: { id: newItemId },
              data: { stockCurrent: { increment: netDelta } },
            });
          }
        } else {
          if (oldItemId && oldDelta !== 0) {
            await tx.item.update({
              where: { id: oldItemId },
              data: { stockCurrent: { increment: -oldDelta } },
            });
          }
          if (newItemId && newDelta !== 0) {
            if (newDelta < 0) {
              const item = await tx.item.findUnique({
                where: { id: newItemId, companyId, isRemoved: false },
                select: { stockCurrent: true, name: true },
              });
              if (!item)
                throw new BadRequestException(
                  `El ítem ${newItemId} no existe.`,
                );
              if (item.stockCurrent < Math.abs(newDelta)) {
                throw new BadRequestException(
                  `Stock insuficiente para el producto ${item.name}. Disponible: ${item.stockCurrent}, Requerido: ${Math.abs(newDelta)}`,
                );
              }
            }
            await tx.item.update({
              where: { id: newItemId },
              data: { stockCurrent: { increment: newDelta } },
            });
          }
        }
      }

      const costItemStockChanged =
        data.costItemId !== undefined ||
        data.quantity !== undefined ||
        data.stockEffect !== undefined;

      if (costItemStockChanged && oldCostItemId) {
        if (oldCostItemDelta !== 0) {
          await tx.item.update({
            where: { id: oldCostItemId },
            data: { stockCurrent: { increment: -oldCostItemDelta } },
          });
        }
        if (newCostItemId && newCostItemDelta !== 0) {
          await tx.item.update({
            where: { id: newCostItemId },
            data: { stockCurrent: { increment: newCostItemDelta } },
          });
        }
      }

      const updatePayload: Prisma.TransactionUpdateInput = {};

      if (data.categoryId !== undefined)
        updatePayload.category = { connect: { id: data.categoryId } };
      if (data.itemId !== undefined) {
        updatePayload.item = data.itemId
          ? { connect: { id: data.itemId } }
          : { disconnect: true };
      }
      if (data.batchId !== undefined) {
        updatePayload.batch = data.batchId
          ? { connect: { id: data.batchId } }
          : { disconnect: true };
      }
      if (data.costItemId !== undefined) {
        updatePayload.costItem = data.costItemId
          ? { connect: { id: data.costItemId } }
          : { disconnect: true };
      }
      if (data.quantity !== undefined) updatePayload.quantity = data.quantity;
      if (data.unitPrice !== undefined)
        updatePayload.unitPrice = data.unitPrice;
      if (data.status !== undefined) updatePayload.status = data.status;
      if (data.paymentMethod !== undefined)
        updatePayload.paymentMethod = data.paymentMethod;
      if (data.description !== undefined)
        updatePayload.description = data.description;
      if (data.stockEffect !== undefined)
        updatePayload.stockEffect = data.stockEffect;
      if (data.paymentDate !== undefined) {
        updatePayload.paymentDate = data.paymentDate
          ? new Date(data.paymentDate)
          : null;
      }
      if (data.paymentReference !== undefined)
        updatePayload.paymentReference = data.paymentReference;

      let newAmountUSD = Number(transaction.amountUSD);
      let newAmountBs = Number(transaction.amountBs);

      if (
        data.amount !== undefined &&
        data.currency &&
        data.dollarRate !== undefined
      ) {
        const { amountUSD, amountBs } = this.calculateAmounts(
          data.amount,
          data.currency,
          data.dollarRate,
        );
        newAmountUSD = amountUSD;
        newAmountBs = amountBs;
        updatePayload.amountUSD = amountUSD;
        updatePayload.amountBs = amountBs;
        updatePayload.currency = data.currency;
        updatePayload.dollarRate = data.dollarRate;
      } else {
        if (data.currency !== undefined) updatePayload.currency = data.currency;
        if (data.dollarRate !== undefined)
          updatePayload.dollarRate = data.dollarRate;
      }

      const newStatus = data.status ?? transaction.status;
      let newSign = oldSign;

      if (data.categoryId && data.categoryId !== transaction.categoryId) {
        const newCategory = await tx.category.findUnique({
          where: { id: data.categoryId },
        });
        if (!newCategory) {
          throw new NotFoundException(
            `La categoría con ID ${data.categoryId} no existe.`,
          );
        }
        newSign = newCategory.flowDirection === FlowDirection.INFLOW ? 1 : -1;
      }

      const oldEffect = wasCompleted
        ? {
            usd: oldSign * Number(transaction.amountUSD),
            bs: oldSign * Number(transaction.amountBs),
          }
        : { usd: 0, bs: 0 };
      const newEffect =
        newStatus === 'COMPLETED'
          ? { usd: newSign * newAmountUSD, bs: newSign * newAmountBs }
          : { usd: 0, bs: 0 };

      const deltaUSD = newEffect.usd - oldEffect.usd;
      const deltaBs = newEffect.bs - oldEffect.bs;

      const updated = await tx.transaction.update({
        where: { id },
        data: updatePayload,
        include: {
          category: true,
          item: true,
          batch: { include: { item: true } },
          costItem: true,
        },
      });

      if (deltaUSD !== 0 || deltaBs !== 0) {
        await tx.company.update({
          where: { id: companyId },
          data: {
            cashBalanceUSD: { increment: deltaUSD },
            cashBalanceBs: { increment: deltaBs },
          },
        });
      }

      return updated;
    });
  }

  async deleteTransaction(id: string, companyId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, companyId, isRemoved: false },
      include: { category: true },
    });

    if (!transaction) {
      throw new NotFoundException(`La transacción con ID ${id} no existe.`);
    }

    return await this.prisma.$transaction(async (tx) => {
      // Revertir stock
      if (
        transaction.itemId &&
        transaction.stockEffect &&
        transaction.stockEffect !== StockEffect.NONE
      ) {
        const qty = transaction.quantity ?? 0;
        const delta =
          transaction.stockEffect === StockEffect.INCREMENT ? -qty : qty;
        if (delta !== 0) {
          await tx.item.update({
            where: { id: transaction.itemId },
            data: { stockCurrent: { increment: delta } },
          });
        }
      }

      if (
        transaction.costItemId &&
        transaction.stockEffect &&
        transaction.stockEffect !== StockEffect.NONE
      ) {
        const qty = transaction.quantity ?? 0;
        const delta =
          transaction.stockEffect === StockEffect.INCREMENT ? -qty : qty;
        if (delta !== 0) {
          await tx.item.update({
            where: { id: transaction.costItemId },
            data: { stockCurrent: { increment: delta } },
          });
        }
      }

      const result = await tx.transaction.update({
        where: { id },
        data: { isRemoved: true },
      });

      if (transaction.status === 'COMPLETED') {
        const sign =
          transaction.category.flowDirection === FlowDirection.INFLOW ? 1 : -1;
        const deltaUSD = -(sign * Number(transaction.amountUSD));
        const deltaBs = -(sign * Number(transaction.amountBs));

        await tx.company.update({
          where: { id: companyId },
          data: {
            cashBalanceUSD: { increment: deltaUSD },
            cashBalanceBs: { increment: deltaBs },
          },
        });
      }

      return result;
    });
  }

  async getTransactionsByDateRange(
    companyId: string,
    startDate: Date,
    endDate: Date,
  ) {
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
        },
      },
      include: { category: true },
    });
  }

  async getCompanyBalance(
    companyId: string,
  ): Promise<{ usd: number; bs: number }> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { cashBalanceUSD: true, cashBalanceBs: true },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return {
      usd: Number(company.cashBalanceUSD),
      bs: Number(company.cashBalanceBs),
    };
  }

  async getMonthlyChartData(
    companyId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ month: string; revenue: number; expenses: number }>> {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        companyId,
        isRemoved: false,
        paymentDate: { gte: startDate, lte: endDate },
      },
      include: { category: true },
    });

    const monthlyMap = new Map<string, { revenue: number; expenses: number }>();

    for (const t of transactions) {
      const d = t.paymentDate ?? t.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const entry = monthlyMap.get(key) ?? { revenue: 0, expenses: 0 };
      const amount = Number(t.amountUSD);
      if (t.category.flowDirection === 'INFLOW') {
        entry.revenue += amount;
      } else {
        entry.expenses += amount;
      }
      monthlyMap.set(key, entry);
    }

    const result: Array<{
      month: string;
      revenue: number;
      expenses: number;
    }> = [];
    const cursor = new Date(startDate);
    const end = new Date(endDate);
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      const data = monthlyMap.get(key) ?? { revenue: 0, expenses: 0 };
      result.push({ month: key, ...data });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return result;
  }

  async getTransactionsByCategory(companyId: string, categoryId: string) {
    await this.assertCategoryForCompany(this.prisma, categoryId, companyId);

    return this.prisma.transaction.findMany({
      where: { companyId, categoryId, isRemoved: false },
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        item: true,
        batch: { include: { item: true } },
        costItem: true,
      },
    });
  }
}
