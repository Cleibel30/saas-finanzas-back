import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ValidateCompanyGuard } from '@/company/guards/validate-company/validate-company.guard';
import { PriceMarginService } from './price-margin.service';
import { PriceMarginDto } from './dto/price-margin.dto';

@Controller('price')
export class PriceMarginController {
  constructor(private readonly priceMarginService: PriceMarginService) {}

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Post('margin-target/:companyId')
  async calculateMarginTarget(
    @Param('companyId') companyId: string,
    @Body() body: Omit<PriceMarginDto, 'companyId'>,
  ) {
    return this.priceMarginService.calculateMarginTarget(
      body.itemId,
      companyId,
      body.targetMarginPercent,
    );
  }
}
