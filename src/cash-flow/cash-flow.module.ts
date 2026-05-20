import { Module } from '@nestjs/common';
import { CashFlowController } from './cash-flow.controller';
import { CashFlowService } from './cash-flow.service';
import { CompanyModule } from '@/company/company.module';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  controllers: [CashFlowController],
  providers: [CashFlowService],
  imports: [CompanyModule, PrismaModule],
})
export class CashFlowModule {}
