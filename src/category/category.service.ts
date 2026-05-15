import { CompanyService } from '@/company/company.service';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoryService {
    constructor(private prisma: PrismaService, private companyService: CompanyService) { }

    async createCategory(categoryData: CreateCategoryDto, userId: string, companyId: string) {
        return this.prisma.category.create({
            data: {
                name: categoryData.name,
                type: categoryData.type,
                flowDirection: categoryData.flowDirection,
                companyId,
            }
        });
    }

    async getCategoriesByCompany(companyId: string, userId: string) {
        return this.prisma.category.findMany({
            where: {
                OR: [
                    { companyId, isRemoved: false },
                    { isDefault: true }
                ]
            },
        });
    }

    async deleteCategory(categoryId: string, userId: string, companyId: string) {

        const category = await this.prisma.category.findUnique({
            where: { id: categoryId, companyId },
        });

        if (!category) throw new UnauthorizedException('Category not found.');

        return this.prisma.category.update({
            where: { id: categoryId, companyId },
            data: { isRemoved: true },
        });
    }

    async updateCategory(updateData: UpdateCategoryDto, categoryId: string, userId: string, companyId: string) {
        const verifyOwnership = await this.companyService.verifyCompanyOwnership(companyId, userId);

        if (!verifyOwnership) throw new UnauthorizedException('You do not have permission to update this category.');

        const category = await this.prisma.category.findUnique({
            where: { id: categoryId, companyId },
        });

        if (!category) throw new UnauthorizedException('Category not found.');

        return this.prisma.category.update({
            where: { id: categoryId, companyId },
            data: updateData,
        });
    }
}
