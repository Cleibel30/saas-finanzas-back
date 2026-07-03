import { Module } from '@nestjs/common';
import { UnitCostController } from './unit-cost.controller';
import { UnitCostService } from './unit-cost.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { CompanyModule } from '@/company/company.module';

@Module({
  controllers: [UnitCostController],
  providers: [UnitCostService],
  imports: [PrismaModule, CompanyModule],
  exports: [UnitCostService],
})
export class UnitCostModule {}
