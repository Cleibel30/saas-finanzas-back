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
import { Category, Currency, Item, Prisma } from '@prisma/client';

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

  // 1 Crear transacciones financieras con validaciones avanzadas y manejo de stock dinámico
  async createTransactions(data: CreateTransactionDto[], companyId: string) {
    // Batch validation: resolve all entities before the transaction
    const categoryIds = [...new Set(data.map((t) => t.categoryId))];
    const itemIds = [
      ...new Set(data.filter((t) => t.itemId).map((t) => t.itemId!)),
    ];
    const batchIds = [
      ...new Set(data.filter((t) => t.batchId).map((t) => t.batchId!)),
    ];

    const [categories, items, batches] = await Promise.all([
      this.prisma.category.findMany({
        where: { id: { in: categoryIds }, isRemoved: false },
      }),
      itemIds.length > 0
        ? this.prisma.item.findMany({
            where: { id: { in: itemIds }, companyId, isRemoved: false },
          })
        : Promise.resolve([] as Item[]),
      batchIds.length > 0
        ? this.prisma.productionBatch.findMany({
            where: { id: { in: batchIds }, companyId, isRemoved: false },
          })
        : Promise.resolve([] as Item[]),
    ]);

    const categoryMap = new Map(categories.map((c) => [c.id, c]));
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const batchSet = new Set(batches.map((b) => b.id));

    for (const t of data) {
      const category = categoryMap.get(t.categoryId);
      if (!category)
        throw new NotFoundException(
          `La categoría con ID ${t.categoryId} no existe.`,
        );
      if (category.companyId !== companyId && !category.isDefault) {
        throw new UnauthorizedException(
          'La categoría no pertenece a la empresa.',
        );
      }

      if (t.itemId) {
        const item = itemMap.get(t.itemId);
        if (!item)
          throw new BadRequestException(
            `El ítem con ID ${t.itemId} no existe.`,
          );

        if (t.batchId && !batchSet.has(t.batchId)) {
          throw new BadRequestException(
            `El lote con ID ${t.batchId} no existe.`,
          );
        }

        if (item.type === 'PRODUCT') {
          if (!t.quantity || t.quantity <= 0) {
            throw new BadRequestException(
              `La cantidad es obligatoria para el producto: ${item.name}`,
            );
          }
        }
      } else if (t.batchId && !batchSet.has(t.batchId)) {
        throw new BadRequestException(`El lote con ID ${t.batchId} no existe.`);
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      const results = [];
      const stockToDecrement: Record<string, number> = {};

      for (const t of data) {
        const category = categoryMap.get(t.categoryId)!;

        if (t.itemId) {
          const item = itemMap.get(t.itemId)!;

          if (item.type === 'PRODUCT' && category.flowDirection === 'INFLOW') {
            if (!stockToDecrement[t.itemId]) {
              stockToDecrement[t.itemId] = 0;
            }
            stockToDecrement[t.itemId] += t.quantity!;

            if (item.stockCurrent < stockToDecrement[t.itemId]) {
              throw new BadRequestException(
                `Stock insuficiente para ${item.name}. Disponible: ${item.stockCurrent}, Requerido en la petición: ${stockToDecrement[t.itemId]}`,
              );
            }
          }
        }
      }

      for (const [itemId, totalDecrement] of Object.entries(stockToDecrement)) {
        await tx.item.update({
          where: { id: itemId },
          data: {
            stockCurrent: { decrement: totalDecrement },
          },
        });
      }

      for (const t of data) {
        const { amountUSD, amountBs } = this.calculateAmounts(
          t.amount,
          t.currency,
          t.dollarRate,
        );

        const transaction = await tx.transaction.create({
          data: {
            categoryId: t.categoryId,
            itemId: t.itemId,
            batchId: t.batchId,
            quantity: t.quantity,
            unitPrice: t.unitPrice,
            amountUSD,
            amountBs,
            status: t.status,
            paymentMethod: t.paymentMethod,
            currency: t.currency,
            paymentReference: t.paymentReference,
            description: t.description,
            paymentDate: t.paymentDate ? new Date(t.paymentDate) : null,
            companyId,
            dollarRate: t.dollarRate,
          },
          include: { category: true, item: true, batch: true },
        });

        results.push(transaction);
      }

      return results;
    });
  }

  async getTransactionsByCompany(companyId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where = { companyId, isRemoved: false };
    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { category: true, item: true, batch: true },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getTransactionById(id: string, companyId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, companyId, isRemoved: false },
      include: { category: true, item: true, batch: true },
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
    });
    if (!transaction) {
      throw new NotFoundException(`La transacción con ID ${id} no existe.`);
    }

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

      if (data.amount !== undefined && (!data.currency || !data.dollarRate)) {
        throw new BadRequestException(
          'Para actualizar el monto, debe proporcionar también currency y dollarRate.',
        );
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
      if (data.quantity !== undefined) updatePayload.quantity = data.quantity;
      if (data.unitPrice !== undefined)
        updatePayload.unitPrice = data.unitPrice;
      if (data.status !== undefined) updatePayload.status = data.status;
      if (data.paymentMethod !== undefined)
        updatePayload.paymentMethod = data.paymentMethod;
      if (data.description !== undefined)
        updatePayload.description = data.description;
      if (data.paymentDate !== undefined) {
        updatePayload.paymentDate = data.paymentDate
          ? new Date(data.paymentDate)
          : null;
      }
      if (data.paymentReference !== undefined)
        updatePayload.paymentReference = data.paymentReference;

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
        updatePayload.amountUSD = amountUSD;
        updatePayload.amountBs = amountBs;
        updatePayload.currency = data.currency;
        updatePayload.dollarRate = data.dollarRate;
      } else {
        if (data.currency !== undefined) updatePayload.currency = data.currency;
        if (data.dollarRate !== undefined)
          updatePayload.dollarRate = data.dollarRate;
      }

      return tx.transaction.update({
        where: { id },
        data: updatePayload,
        include: { category: true, item: true, batch: true },
      });
    });
  }

  async deleteTransaction(id: string, companyId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, companyId, isRemoved: false },
    });

    if (!transaction) {
      throw new NotFoundException(`La transacción con ID ${id} no existe.`);
    }

    return await this.prisma.transaction.update({
      where: { id },
      data: { isRemoved: true },
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
    });
  }

  async getTransactionsByCategory(companyId: string, categoryId: string) {
    await this.assertCategoryForCompany(this.prisma, categoryId, companyId);

    return this.prisma.transaction.findMany({
      where: { companyId, categoryId, isRemoved: false },
      orderBy: { createdAt: 'desc' },
      include: { category: true, item: true, batch: true },
    });
  }
}
