import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateItemDto, UpdateItemDto } from './dto/item.dto';
import { FuzzyItemResult } from './interface/item.interface';

@Injectable()
export class ItemService {
    constructor(private prisma: PrismaService) { }

    //Crear varios items a la vez
    async createItems(createItemDto: CreateItemDto[], companyId: string) {
        const items = await this.prisma.item.createMany({
            data: createItemDto.map((item) => ({ ...item, companyId })),
            skipDuplicates: true, // Skip duplicates based on unique constraints
        });
        return items;
    }

    //Obtener items de la empresa
    async getItemsByCompany(companyId: string) {
        return this.prisma.item.findMany({
            where: { companyId, isRemoved: false },
            orderBy: { createdAt: 'desc' },
        });
    }

    //Actualizar un item específico
    async updateItem(itemId: string, companyId: string, updateItemDto: UpdateItemDto) {
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

    //Busqueda de de item por nombre utilizando la función de búsqueda difusa en PostgreSQL
    async getItemByName(name: string, companyId: string) {
        try {
            // Pasamos los parámetros de manera limpia dejando que Prisma infiera los tipos nativos
            const result = await this.prisma.$queryRaw<FuzzyItemResult[]>`
                SELECT id, name, type, "basePrice", "stockCurrent"
                FROM search_item_fuzzy(${name}, ${companyId})
            `;

            // CONTROL DE VACÍOS: Si no hay resultados, devolvemos una respuesta explícita para evitar alucinaciones
            if (!result || result.length === 0) {
                return {
                    success: false,
                    message: `No se encontraron productos o servicios que coincidan con el nombre: "${name}".`,
                    items: []
                };
            }

            return {
                success: true,
                count: result.length,
                items: result.map(item => ({
                    id: item.id,
                    name: item.name,
                    type: item.type,
                    basePrice: item.basePrice,
                    stockCurrent: item.stockCurrent
                }))
            };

        } catch (error) {
            // 🔍 Reporte seguro del error en la consola de tu servidor NestJS
            console.error("🚨 Error real de la Base de Datos en getItemByName:", error);

            return {
                success: false,
                error: "Error interno al realizar la búsqueda difusa en la base de datos.",
                details: error instanceof Error ? error.message : String(error)
            };
        }
    }
    
    //Obtener solo los items de tipo PRODUCT de la empresa
    async getItemsProduct(companyId: string) {
        return this.prisma.item.findMany({
            where: { companyId, isRemoved: false, type: 'PRODUCT' },
            orderBy: { createdAt: 'desc' }
        });
    }

    //Obtener solo los items de tipo SERVICE de la empresa
    async getItemsService(companyId: string) {
        return this.prisma.item.findMany({
            where: { companyId, isRemoved: false, type: 'SERVICE' },
            orderBy: { createdAt: 'desc' }
        });
    }
}
