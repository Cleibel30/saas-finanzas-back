import { PrismaService } from '@/prisma/prisma.service';
import { TransactionService } from '@/transaction/transaction.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateBatchWithTransactionsDto,
  UpdateBatchDto,
} from './dto/batch.dto';
import { delay } from '@/common/utils/delay';

@Injectable()
export class ProductionBatchService {
  constructor(
    private prisma: PrismaService,
    private transactionService: TransactionService,
  ) {}

  //Crear un batch con sus transacciones de forma atómica
  async createBatchAndTransactions(
    companyId: string,
    itemId: string,
    dto: CreateBatchWithTransactionsDto,
  ) {
    // 1. Validar que el ítem existe
    const findItem = await this.transactionService.assertItemForCompany(
      this.prisma,
      itemId,
      companyId,
    );
    if (findItem.type === 'SERVICE')
      throw new BadRequestException('No se pueden crear lotes para servicios.');

    // 2. Extraer IDs únicos de categorías del DTO para validar
    const categoryIds = [...new Set(dto.transactions.map((t) => t.categoryId))];

    // 3. Validar todas las categorías usando el servicio compartido
    const categories: { id: string; flowDirection: string }[] = [];
    for (const catId of categoryIds) {
      const cat = await this.transactionService.assertCategoryForCompany(
        this.prisma,
        catId,
        companyId,
      );
      categories.push(cat);
    }

    let necesitaDescontarStock = false;

    for (const category of categories) {
      if (category.flowDirection === 'INFLOW' && findItem.type === 'PRODUCT') {
        necesitaDescontarStock = true;
      }
    }

    // 4. Ejecutar todo de forma atómica (stock + creación)
    return await this.prisma.$transaction(async (tx) => {
      if (necesitaDescontarStock) {
        const itemActual = await tx.item.findUnique({ where: { id: itemId } });
        await delay(1);

        if (!itemActual || itemActual.stockCurrent < dto.quantity) {
          throw new BadRequestException(
            `No hay suficiente stock disponible para el producto ${findItem.name}. Disponible: ${itemActual?.stockCurrent ?? 0}`,
          );
        }

        await tx.item.update({
          where: { id: itemId },
          data: { stockCurrent: { decrement: dto.quantity } },
        });
        await delay(1);
      }

      return await tx.productionBatch.create({
        data: {
          companyId: companyId,
          itemId: itemId,
          quantity: dto.quantity,
          status: dto.status,
          batchDate: new Date(dto.batchDate),

          transactions: {
            create: dto.transactions.map((t) => {
              const { amountUSD, amountBs } =
                this.transactionService.calculateAmounts(
                  t.amount,
                  t.currency,
                  t.dollarRate,
                );
              return {
                companyId: companyId,
                categoryId: t.categoryId,
                itemId: itemId,
                amountUSD,
                amountBs,
                quantity: t.quantity,
                status: t.status,
                paymentMethod: t.paymentMethod,
                currency: t.currency,
                paymentReference: t.paymentReference,
                dollarRate: t.dollarRate,
                description: t.description,
                paymentDate: t.paymentDate
                  ? new Date(t.paymentDate)
                  : new Date(),
              };
            }),
          },
        },
        include: {
          transactions: true,
        },
      });
    });
  }

  //Obtener todos los lotes de la empresa
  async getBatchesByCompany(companyId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where = { companyId, isRemoved: false };
    const data = await this.prisma.productionBatch.findMany({
      where,
      include: { item: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
    const total = await this.prisma.productionBatch.count({ where });
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  //Obtener todos los lotes de un producto específico
  async getBatchByProduct(
    companyId: string,
    itemId: string,
    page = 1,
    limit = 50,
  ) {
    const skip = (page - 1) * limit;
    const where = { companyId, itemId, isRemoved: false };
    const data = await this.prisma.productionBatch.findMany({
      where,
      include: { item: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
    const total = await this.prisma.productionBatch.count({ where });
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getBatchById(batchId: string, companyId: string) {
    const batch = await this.prisma.productionBatch.findFirst({
      where: { id: batchId, companyId, isRemoved: false },
      include: { item: true, transactions: true },
    });

    if (!batch) throw new NotFoundException('El lote especificado no existe.');

    return batch;
  }

  //Actualizar un lote específico
  async updateBatch(
    batchId: string,
    companyId: string,
    updateData: UpdateBatchDto,
  ) {
    const findBatch = await this.prisma.productionBatch.findUnique({
      where: { id: batchId, companyId, isRemoved: false },
    });
    if (!findBatch)
      throw new NotFoundException('El lote especificado no existe.');

    return this.prisma.productionBatch.update({
      where: { id: batchId, companyId, isRemoved: false },
      data: { ...updateData },
    });
  }

  //Eliminar un lote específico (marcar como eliminado)
  async deleteBatch(batchId: string, companyId: string) {
    const findBatch = await this.prisma.productionBatch.findUnique({
      where: { id: batchId, companyId, isRemoved: false },
    });
    if (!findBatch)
      throw new NotFoundException('El lote especificado no existe.');

    return this.prisma.productionBatch.update({
      where: { id: batchId, companyId, isRemoved: false },
      data: { isRemoved: true },
    });
  }
}
