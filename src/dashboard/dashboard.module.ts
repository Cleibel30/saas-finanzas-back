import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { TransactionModule } from '@/transaction/transaction.module';
import { NetProfitModule } from '@/net-profit/net-profit.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { CompanyModule } from '@/company/company.module';

@Module({
  imports: [TransactionModule, NetProfitModule, CompanyModule, PrismaModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
