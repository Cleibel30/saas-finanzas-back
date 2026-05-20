import { Module } from '@nestjs/common';
import { BalancePointController } from './balance-point.controller';
import { BalancePointService } from './balance-point.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { ContributionMarginModule } from '@/contribution-margin/contribution-margin.module';
import { CompanyModule } from '@/company/company.module';

@Module({
  controllers: [BalancePointController],
  providers: [BalancePointService],
  imports: [PrismaModule, ContributionMarginModule, CompanyModule],
})
export class BalancePointModule {}
