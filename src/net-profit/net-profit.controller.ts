import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ValidateCompanyGuard } from '@/company/guards/validate-company/validate-company.guard';
import { NetProfitService } from './net-profit.service';
import { NetProfitDto } from './dto/net-profit.dto';

@Controller('net-profit')
export class NetProfitController {
  constructor(private readonly netProfitService: NetProfitService) {}

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Get(':companyId/:startDate/:endDate')
  async getNetProfit(@Param() params: NetProfitDto) {
    return this.netProfitService.getNetProfit(
      params.companyId,
      params.startDate,
      params.endDate,
    );
  }

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Get('statement/:companyId/:startDate/:endDate')
  async getStatement(@Param() params: NetProfitDto) {
    return this.netProfitService.getStatement(
      params.companyId,
      params.startDate,
      params.endDate,
    );
  }
}
