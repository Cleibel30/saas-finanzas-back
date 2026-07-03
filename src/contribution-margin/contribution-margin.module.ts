import { Module } from '@nestjs/common';
import { ContributionMarginController } from './contribution-margin.controller';
import { ContributionMarginService } from './contribution-margin.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { CompanyModule } from '@/company/company.module';

@Module({
  controllers: [ContributionMarginController],
  providers: [ContributionMarginService],
  imports: [PrismaModule, CompanyModule],
  exports: [ContributionMarginService],
})
export class ContributionMarginModule {}
