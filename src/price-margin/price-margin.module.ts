import { Module } from '@nestjs/common';
import { PriceMarginController } from './price-margin.controller';
import { PriceMarginService } from './price-margin.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { CompanyModule } from '@/company/company.module';
import { UnitCostModule } from '@/unit-cost/unit-cost.module';

@Module({
  controllers: [PriceMarginController],
  providers: [PriceMarginService],
  imports: [PrismaModule, CompanyModule, UnitCostModule],
  exports: [PriceMarginService],
})
export class PriceMarginModule {}
