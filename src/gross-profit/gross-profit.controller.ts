import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ValidateCompanyGuard } from '@/company/guards/validate-company/validate-company.guard';
import { GrossProfitService } from './gross-profit.service';
import {
  GrossProfitGeneralDto,
  GrossProfitItemDto,
  GrossProfitBatchDto,
} from './dto/gross-profit.dto';

@Controller('gross-profit')
export class GrossProfitController {
  constructor(private readonly grossProfitService: GrossProfitService) {}

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Get('global/:companyId/:startDate/:endDate')
  async getGlobalGrossProfit(@Param() params: GrossProfitGeneralDto) {
    return this.grossProfitService.getGlobalGrossProfit(
      params.companyId,
      params.startDate,
      params.endDate,
    );
  }

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Get('product/:itemId/:companyId/:startDate/:endDate')
  async getProductGrossProfit(@Param() params: GrossProfitItemDto) {
    return this.grossProfitService.getProductGrossProfit(
      params.itemId,
      params.companyId,
      params.startDate,
      params.endDate,
    );
  }

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Get('service/:itemId/:companyId/:startDate/:endDate')
  async getServiceGrossProfit(@Param() params: GrossProfitItemDto) {
    return this.grossProfitService.getServiceGrossProfit(
      params.itemId,
      params.companyId,
      params.startDate,
      params.endDate,
    );
  }

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Get('batch/:batchId/:companyId')
  async getBatchGrossProfit(@Param() params: GrossProfitBatchDto) {
    return this.grossProfitService.getBatchGrossProfit(
      params.batchId,
      params.companyId,
    );
  }
}
