import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/category.dto';
import { UserDto } from '@/auth/dto/user.dto';
import { AuthGuard } from '@nestjs/passport';
import { ValidateCompanyGuard } from '@/company/guards/validate-company/validate-company.guard';
import { SearchDto } from '@/item/dto/item.dto';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('category')
export class CategoryController {
  constructor(private categoryService: CategoryService) {}

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('create/:companyId')
  async createCategory(
    @Body() categoryData: CreateCategoryDto,
    @Param('companyId') companyId: string,
  ) {
    return this.categoryService.createCategory(categoryData, companyId);
  }

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Get('list/:companyId')
  async getCategories(
    @Param('companyId') companyId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.categoryService.getCategoriesByCompany(
      companyId,
      pagination.page,
      pagination.limit,
    );
  }

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Post('delete/:companyId/:categoryId')
  async deleteCategory(
    @Param('companyId') companyId: string,
    @Param('categoryId') categoryId: string,
    @Req() req: Request & { user: UserDto },
  ) {
    const userId = req.user.userId;
    return this.categoryService.deleteCategory(categoryId, userId, companyId);
  }

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Post('update/:companyId/:categoryId')
  async updateCategory(
    @Body() updateData: CreateCategoryDto,
    @Param('companyId') companyId: string,
    @Param('categoryId') categoryId: string,
    @Req() req: Request & { user: UserDto },
  ) {
    const userId = req.user.userId;
    return this.categoryService.updateCategory(
      updateData,
      categoryId,
      userId,
      companyId,
    );
  }

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Get('get-by-name/:name/:companyId')
  async getCategoryByName(@Param() params: SearchDto) {
    return this.categoryService.getCategoryByName(
      params.name,
      params.companyId,
    );
  }
}
