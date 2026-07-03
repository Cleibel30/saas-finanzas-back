import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ContributionMarginService } from './contribution-margin.service';
import { AuthGuard } from '@nestjs/passport';
import { ValidateCompanyGuard } from '@/company/guards/validate-company/validate-company.guard';
import {
  ContributionMarginProductDto,
  ContributionMarginServiceDto,
  GeneralContributionMargin,
} from './dto/contribution-service.dto';

@Controller('contribution-margin')
export class ContributionMarginController {
  constructor(private contributionMarginService: ContributionMarginService) {}

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Get('global/:companyId/:startDate/:endDate')
  async getGlobalContributionMargin(
    @Param() params: GeneralContributionMargin,
  ) {
    return this.contributionMarginService.getGlobalContributionMargin(
      params.companyId,
      params.startDate,
      params.endDate,
    );
  }

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Get('product-global/:itemId/:companyId/:startDate/:endDate')
  async getContributionMarginByProduct(
    @Param() params: ContributionMarginProductDto,
  ) {
    return this.contributionMarginService.getContributionMarginByProductDates(
      params.itemId,
      params.companyId,
      params.startDate,
      params.endDate,
    );
  }

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Get('product/:batchId/:companyId')
  async getContributionMarginByBatch(
    @Param('batchId') batchId: string,
    @Param('companyId') companyId: string,
  ) {
    return this.contributionMarginService.getContributionMarginByBatch(
      batchId,
      companyId,
    );
  }

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Get('service/:itemId/:companyId/:startDate/:endDate')
  async getContributionMarginByService(
    @Param() params: ContributionMarginServiceDto,
  ) {
    return this.contributionMarginService.getContributionMarginByService(
      params.itemId,
      params.companyId,
      params.startDate,
      params.endDate,
    );
  }
}
