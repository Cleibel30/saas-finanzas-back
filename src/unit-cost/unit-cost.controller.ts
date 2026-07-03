import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ValidateCompanyGuard } from '@/company/guards/validate-company/validate-company.guard';
import { UnitCostService } from './unit-cost.service';
import { UnitCostBatchDto, UnitCostProductDto } from './dto/unit-cost.dto';

@Controller('unit-cost')
export class UnitCostController {
  constructor(private readonly unitCostService: UnitCostService) {}

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Get('batch/:batchId/:companyId')
  async getBatchUnitCost(@Param() params: UnitCostBatchDto) {
    return this.unitCostService.getBatchUnitCost(params.batchId, params.companyId);
  }

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Get('product/:itemId/:companyId')
  async getProductUnitCost(@Param() params: UnitCostProductDto) {
    return this.unitCostService.getProductUnitCost(params.itemId, params.companyId);
  }

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Get('service/:itemId/:companyId')
  async getServiceUnitCost(@Param() params: UnitCostProductDto) {
    return this.unitCostService.getServiceUnitCost(params.itemId, params.companyId);
  }
}
