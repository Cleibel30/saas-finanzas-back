import { PrismaService } from '@/prisma/prisma.service';
import { TransactionService } from '@/transaction/transaction.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateBatchDto, UpdateBatchDto } from './dto/batch.dto';

@Injectable()
export class ProductionBatchService {
  constructor(
    private prisma: PrismaService,
    private transactionService: TransactionService,
  ) {}

  //Crear un batch sin transacciones
  async createBatch(companyId: string, itemId: string, dto: CreateBatchDto) {
    const findItem = await this.transactionService.assertItemForCompany(
      this.prisma,
      itemId,
      companyId,
    );
    if (findItem.type === 'SERVICE')
      throw new BadRequestException('No se pueden crear lotes para servicios.');

    return this.prisma.productionBatch.create({
      data: {
        companyId,
        itemId,
        quantity: dto.quantity ?? 0,
        status: dto.status ?? 'OPEN',
        batchDate: dto.batchDate ? new Date(dto.batchDate) : new Date(),
      },
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

  async getBatchById(companyId: string, batchId: string) {
    const batch = await this.prisma.productionBatch.findFirst({
      where: { id: batchId, companyId, isRemoved: false },
      include: {
        item: true,
        transactions: {
          where: { companyId, isRemoved: false },
          include: {
            category: true,
          },
        },
      },
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
