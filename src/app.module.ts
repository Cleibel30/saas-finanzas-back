import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { CompanyModule } from './company/company.module';
import { PrismaModule } from './prisma/prisma.module';
import { TransactionModule } from './transaction/transaction.module';
import { CategoryModule } from './category/category.module';
import { ItemModule } from './item/item.module';
import { ProductionBatchModule } from './production_batch/production_batch.module';
import { CashFlowModule } from './cash-flow/cash-flow.module';
import { ContributionMarginModule } from './contribution-margin/contribution-margin.module';
import { GrossProfitModule } from './gross-profit/gross-profit.module';
import { NetProfitModule } from './net-profit/net-profit.module';
import { UnitCostModule } from './unit-cost/unit-cost.module';
import { PriceMarginModule } from './price-margin/price-margin.module';
import { BalancePointModule } from './balance-point/balance-point.module';
import { McpModule } from './mcp/mcp.module';
import { GroqAgentModule } from './groq-agent/groq-agent.module';
import { FinanceChatModule } from './finance-chat/finance-chat.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { CacheModule } from './common/cache/cache.module';

@Module({
  imports: [
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    CompanyModule,
    PrismaModule,
    TransactionModule,
    CategoryModule,
    ItemModule,
    ProductionBatchModule,
    CashFlowModule,
    ContributionMarginModule,
    GrossProfitModule,
    NetProfitModule,
    UnitCostModule,
    PriceMarginModule,
    BalancePointModule,
    McpModule,
    GroqAgentModule,
    FinanceChatModule,
    CacheModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
