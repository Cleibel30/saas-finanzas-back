import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductionBatchService } from './production_batch.service';
import { AuthGuard } from '@nestjs/passport';
import {
  CreateBatchWithTransactionsDto,
  UpdateBatchDto,
} from './dto/batch.dto';
import { ValidateCompanyGuard } from '@/company/guards/validate-company/validate-company.guard';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('production-batch')
export class ProductionBatchController {
  constructor(private productionBatchService: ProductionBatchService) {}

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('create/:companyId/:itemId')
  async createBatchWithTransactions(
    @Param('companyId') companyId: string,
    @Param('itemId') itemId: string,
    @Body() dto: CreateBatchWithTransactionsDto,
  ) {
    return await this.productionBatchService.createBatchAndTransactions(
      companyId,
      itemId,
      dto,
    );
  }

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Get('get-all/:companyId')
  async getBatchesByCompany(
    @Param('companyId') companyId: string,
    @Query() pagination: PaginationDto,
  ) {
    return await this.productionBatchService.getBatchesByCompany(
      companyId,
      pagination.page,
      pagination.limit,
    );
  }

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Get('get-all-by-product/:companyId/:itemId')
  async getBatchesByProduct(
    @Param('companyId') companyId: string,
    @Param('itemId') itemId: string,
    @Query() pagination: PaginationDto,
  ) {
    return await this.productionBatchService.getBatchByProduct(
      companyId,
      itemId,
      pagination.page,
      pagination.limit,
    );
  }

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Get('get-all-by-batch-id/:companyId/:batchId')
  async getBatchesByBatchId(
    @Param('companyId') companyId: string,
    @Param('batchId') batchId: string,
  ) {
    return await this.productionBatchService.getBatchById(companyId, batchId);
  }

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Patch('update/:companyId/:batchId')
  async updateBatch(
    @Param('companyId') companyId: string,
    @Param('batchId') batchId: string,
    @Body() updateData: UpdateBatchDto,
  ) {
    return await this.productionBatchService.updateBatch(
      companyId,
      batchId,
      updateData,
    );
  }

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Patch('delete/:companyId/:batchId')
  async deleteBatch(
    @Param('companyId') companyId: string,
    @Param('batchId') batchId: string,
  ) {
    return await this.productionBatchService.deleteBatch(companyId, batchId);
  }
}
