import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { CreateItemDto, UpdateItemDto } from './dto/item.dto';

@Injectable()
export class ItemService {
    constructor(private prisma: PrismaService) { }

    async createItems(createItemDto: CreateItemDto[], companyId: string) {
        const items = await this.prisma.item.createMany({
            data: createItemDto.map((item) => ({ ...item, companyId })),
            skipDuplicates: true, // Skip duplicates based on unique constraints
        });
        return items;
    }

    async getItemsByCompany(companyId: string) {
        return this.prisma.item.findMany({
            where: { companyId, isRemoved: false },
            orderBy: { createdAt: 'desc' },
        });
    }

    async updateItem(itemId: string, companyId: string, updateData: UpdateItemDto) {
        return this.prisma.item.update({
            where: { id: itemId, companyId },
            data: updateData,
        });
    }
}
