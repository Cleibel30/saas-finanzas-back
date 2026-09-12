import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { BalancePointService } from './balance-point.service';
import { ValidateCompanyGuard } from '@/company/guards/validate-company/validate-company.guard';
import { AuthGuard } from '@nestjs/passport';

@Controller('balance-point')
export class BalancePointController {
  constructor(private balancePointService: BalancePointService) {}

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Get('product/:itemId/:companyId/:startDate/:endDate')
  async getProductBreakEven(
    @Param()
    params: {
      itemId: string;
      companyId: string;
      startDate: Date;
      endDate: Date;
    },
  ) {
    return this.balancePointService.getProductBreakEven(
      params.itemId,
      params.companyId,
      params.startDate,
      params.endDate,
    );
  }

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Get('batch/:batchId/:companyId')
  async getBatchBreakEven(
    @Param() params: { batchId: string; companyId: string },
  ) {
    return this.balancePointService.getBatchBreakEven(
      params.batchId,
      params.companyId,
    );
  }

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Get('service/:itemId/:companyId/:startDate/:endDate')
  async getServiceBreakEven(
    @Param()
    params: {
      itemId: string;
      companyId: string;
      startDate: Date;
      endDate: Date;
    },
  ) {
    return this.balancePointService.getServiceBreakEven(
      params.itemId,
      params.companyId,
      params.startDate,
      params.endDate,
    );
  }

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Get(':companyId/:startDate/:endDate')
  async getCompanyBreakEven(
    @Param() params: { companyId: string; startDate: Date; endDate: Date },
  ) {
    return this.balancePointService.getCompanyBreakEven(
      params.companyId,
      params.startDate,
      params.endDate,
    );
  }
}
