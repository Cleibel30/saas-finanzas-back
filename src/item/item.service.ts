import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateItemDto, UpdateItemDto } from './dto/item.dto';
import { FuzzyItemResult } from './interface/item.interface';

@Injectable()
export class ItemService {
  constructor(private prisma: PrismaService) {}

  //Crear varios items a la vez
  async createItems(createItemDto: CreateItemDto[], companyId: string) {
    const items = await this.prisma.item.createMany({
      data: createItemDto.map((item) => ({ ...item, companyId })),
      skipDuplicates: true, // Skip duplicates based on unique constraints
    });
    return items;
  }

  //Obtener items de la empresa
  async getItemsByCompany(companyId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.item.findMany({
        where: { companyId, isRemoved: false },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.item.count({
        where: { companyId, isRemoved: false },
      }),
    ]);
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  //Actualizar un item específico
  async updateItem(
    itemId: string,
    companyId: string,
    updateItemDto: UpdateItemDto,
  ) {
    const findProduct = await this.prisma.item.findUnique({
      where: { id: itemId, companyId, isRemoved: false },
    });
    if (!findProduct) throw new NotFoundException('Item not found');

    return this.prisma.item.update({
      where: { id: itemId, companyId, isRemoved: false },
      data: { ...updateItemDto },
    });
  }

  //Eliminar un item específico (marcar como eliminado)
  async deleteItem(itemId: string, companyId: string) {
    const findProduct = await this.prisma.item.findUnique({
      where: { id: itemId, companyId, isRemoved: false },
    });
    if (!findProduct) throw new NotFoundException('Item not found');

    return this.prisma.item.update({
      where: { id: itemId, companyId, isRemoved: false },
      data: { isRemoved: true },
    });
  }

  //Busqueda de item por nombre (fuzzy SQL con fallback Prisma)
  async getItemByName(name: string, companyId: string) {
    const searchTerm = name?.trim();
    if (!searchTerm) {
      return {
        success: false,
        dataSource: 'database',
        searchTerm: name ?? '',
        message: 'El nombre de búsqueda no puede estar vacío.',
        count: 0,
        items: [],
      };
    }

    try {
      const fuzzyRows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
                SELECT * FROM search_item_fuzzy(${searchTerm}, ${companyId}::uuid)
            `;

      const fuzzyResult = this.normalizarFilasItem(fuzzyRows);

      if (fuzzyResult.length > 0) {
        return this.buildItemSearchResponse(
          true,
          fuzzyResult,
          searchTerm,
          'fuzzy',
        );
      }
    } catch (error) {
      console.warn(
        'search_item_fuzzy no disponible, usando búsqueda Prisma:',
        error,
      );
    }

    const prismaResult = await this.prisma.item.findMany({
      where: {
        companyId,
        isRemoved: false,
        name: { contains: searchTerm, mode: 'insensitive' },
      },
      select: {
        id: true,
        name: true,
        type: true,
        basePrice: true,
        stockCurrent: true,
      },
      take: 20,
    });

    return this.buildItemSearchResponse(
      prismaResult.length > 0,
      prismaResult,
      searchTerm,
      'prisma',
    );
  }

  /** Compatible con funciones SQL en snake_case o camelCase (Supabase / Prisma). */
  private normalizarFilasItem(
    rows: Record<string, unknown>[],
  ): FuzzyItemResult[] {
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      type: String(row.type),
      basePrice: Number(row.basePrice ?? row.base_price),
      stockCurrent: Number(row.stockCurrent ?? row.stock_current),
    }));
  }

  private buildItemSearchResponse(
    success: boolean,
    items: Array<{
      id: string;
      name: string;
      type: string;
      basePrice: FuzzyItemResult['basePrice'] | { toNumber(): number };
      stockCurrent: number;
    }>,
    searchTerm: string,
    source: 'fuzzy' | 'prisma',
  ) {
    if (!success) {
      return {
        success: false,
        dataSource: 'database',
        searchTerm,
        source,
        message: `No se encontraron productos o servicios que coincidan con "${searchTerm}".`,
        count: 0,
        items: [],
      };
    }

    return {
      success: true,
      dataSource: 'database',
      searchTerm,
      source,
      count: items.length,
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        basePrice: Number(item.basePrice),
        stockCurrent: item.stockCurrent,
      })),
    };
  }

  //Obtener solo los items de tipo PRODUCT de la empresa
  async getItemsProduct(companyId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where = { companyId, isRemoved: false, type: 'PRODUCT' as const };
    const [data, total] = await Promise.all([
      this.prisma.item.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.item.count({ where }),
    ]);
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  //Obtener solo los items de tipo SERVICE de la empresa
  async getItemsService(companyId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where = { companyId, isRemoved: false, type: 'SERVICE' as const };
    const [data, total] = await Promise.all([
      this.prisma.item.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.item.count({ where }),
    ]);
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
