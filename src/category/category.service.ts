import { CompanyService } from '@/company/company.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { FuzzyCategoryResult } from './interface/category.interface';

@Injectable()
export class CategoryService {
  constructor(
    private prisma: PrismaService,
    private companyService: CompanyService,
  ) {}

  async createCategory(categoryData: CreateCategoryDto, companyId: string) {
    const alreadyExists = await this.prisma.category.findFirst({
      where: {
        name: categoryData.name,
        companyId,
      },
    });

    if (alreadyExists)
      throw new ConflictException(
        'A category with this name already exists in the company.',
      );

    return this.prisma.category.create({
      data: {
        name: categoryData.name,
        type: categoryData.type,
        flowDirection: categoryData.flowDirection,
        isVariable: categoryData.isVariable ?? false,
        isCogs: categoryData.isCogs ?? false,
        isDirectCost: categoryData.isDirectCost ?? false,
        companyId,
      },
    });
  }

  async getCategoriesByCompany(companyId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where = {
      OR: [{ companyId, isRemoved: false }, { isDefault: true }],
    };
    const data = await this.prisma.category.findMany({
      where,
      skip,
      take: limit,
    });

    const total = await this.prisma.category.count({ where });

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
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

  async updateCategory(
    updateData: UpdateCategoryDto,
    categoryId: string,
    userId: string,
    companyId: string,
  ) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId, companyId, isRemoved: false },
    });

    if (!category) throw new UnauthorizedException('Category not found.');

    const effectiveFlowDirection =
      updateData.flowDirection ?? category.flowDirection;
    const wouldBeInflowWithFlags =
      effectiveFlowDirection === 'INFLOW' &&
      (updateData.isCogs === true ||
        updateData.isVariable === true ||
        updateData.isDirectCost === true);

    if (wouldBeInflowWithFlags) {
      throw new BadRequestException(
        'INFLOW categories cannot have isCogs, isVariable, or isDirectCost set to true.',
      );
    }

    return this.prisma.category.update({
      where: { id: categoryId, companyId, isRemoved: false },
      data: updateData,
    });
  }

  async getCategoryByName(name: string, companyId: string) {
    const searchTerm = name?.trim();
    if (!searchTerm) {
      return {
        success: false,
        dataSource: 'database',
        searchTerm: name ?? '',
        message: 'El nombre de búsqueda no puede estar vacío.',
        count: 0,
        categories: [],
      };
    }

    try {
      const fuzzyRows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
                SELECT * FROM search_category_fuzzy(${searchTerm}, ${companyId}::uuid)
            `;

      const fuzzyResult = this.normalizarFilasCategoria(fuzzyRows);

      if (fuzzyResult.length > 0) {
        return this.buildCategorySearchResponse(
          true,
          fuzzyResult,
          searchTerm,
          'fuzzy',
        );
      }
    } catch (error) {
      console.warn(
        'search_category_fuzzy no disponible, usando búsqueda Prisma:',
        error,
      );
    }

    const prismaResult = await this.prisma.category.findMany({
      where: {
        isRemoved: false,
        OR: [{ companyId }, { isDefault: true }],
        name: { contains: searchTerm, mode: 'insensitive' },
      },
      select: {
        id: true,
        name: true,
        type: true,
        flowDirection: true,
        isCogs: true,
        isDirectCost: true,
        isDefault: true,
      },
    });

    return this.buildCategorySearchResponse(
      prismaResult.length > 0,
      prismaResult,
      searchTerm,
      'prisma',
    );
  }

  private normalizarFilasCategoria(
    rows: Record<string, unknown>[],
  ): FuzzyCategoryResult[] {
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      type: String(row.type),
      flowDirection: String(row.flowDirection ?? row.flow_direction),
      isCogs: Boolean(row.isCogs ?? row.is_cogs),
      isDirectCost: Boolean(row.isDirectCost ?? row.is_direct_cost),
      isDefault: Boolean(row.isDefault ?? row.is_default),
    }));
  }

  private buildCategorySearchResponse(
    success: boolean,
    categories: FuzzyCategoryResult[],
    searchTerm: string,
    source: 'fuzzy' | 'prisma',
  ) {
    if (!success) {
      return {
        success: false,
        dataSource: 'database',
        searchTerm,
        source,
        message: `No se encontraron categorías que coincidan con "${searchTerm}".`,
        count: 0,
        categories: [],
      };
    }

    return {
      success: true,
      dataSource: 'database',
      searchTerm,
      source,
      count: categories.length,
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        type: category.type,
        flowDirection: category.flowDirection,
        isCogs: category.isCogs,
        isDirectCost: category.isDirectCost,
        isDefault: category.isDefault,
      })),
    };
  }
}
