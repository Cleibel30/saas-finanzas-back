import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { CompanyModule } from '@/company/company.module';
import { ContributionMarginModule } from '@/contribution-margin/contribution-margin.module';
import { BalancePointModule } from '@/balance-point/balance-point.module';
import { CategoryModule } from '@/category/category.module';
import { ItemModule } from '@/item/item.module';
import { TransactionModule } from '@/transaction/transaction.module';
import { ProductionBatchModule } from '@/production_batch/production_batch.module';
import { CashFlowModule } from '@/cash-flow/cash-flow.module';
import { GrossProfitModule } from '@/gross-profit/gross-profit.module';
import { NetProfitModule } from '@/net-profit/net-profit.module';
import { UnitCostModule } from '@/unit-cost/unit-cost.module';
import { PriceMarginModule } from '@/price-margin/price-margin.module';

@Module({
  controllers: [McpController],
  providers: [McpService],
  imports: [
    PrismaModule,
    CompanyModule,
    ContributionMarginModule,
    BalancePointModule,
    CategoryModule,
    ItemModule,
    TransactionModule,
    ProductionBatchModule,
    CashFlowModule,
    GrossProfitModule,
    NetProfitModule,
    UnitCostModule,
    PriceMarginModule,
  ],
  exports: [McpService],
})
export class McpModule {}
